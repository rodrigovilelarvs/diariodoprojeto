// src/api/cron/convite-pendente/route.ts
// GET /api/cron/convite-pendente — disparado 1x/dia pelo Vercel Cron.
// Avisa quem gerencia a equipe (ADMIN ou permGerenciarEquipe) quando um
// convite enviado está pendente há alguns dias sem ser aceito — pra lembrar
// de reenviar ou cancelar. Não repete o aviso a cada disparo: só de novo
// depois que passar REPETIR_A_CADA dias do último lembrete.

import { LogCategoria, LogNivel, TenantStatus, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { enviarEmailSeguro, enviarConvitePendente } from '@/lib/email'
import { filtrarEEnfileirar } from '@/lib/notificacoes'

const DIAS_MINIMO_PENDENTE = 3 // só cobra depois de alguns dias — dá tempo da pessoa ver o e-mail
const REPETIR_A_CADA_DIAS  = 3 // evita mandar o mesmo aviso todo dia enquanto ninguém age

// Aceita apenas o disparo do Vercel Cron (header Authorization com CRON_SECRET).
// Sem CRON_SECRET configurado, só libera fora de produção (facilita testes locais).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function diasEntre(de: Date, ate: Date): number {
  return Math.floor((ate.getTime() - de.getTime()) / (24 * 60 * 60 * 1000))
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const agora = new Date()
  const limiteIdade      = new Date(agora.getTime() - DIAS_MINIMO_PENDENTE * 24 * 60 * 60 * 1000)
  const limiteRepeticao  = new Date(agora.getTime() - REPETIR_A_CADA_DIAS * 24 * 60 * 60 * 1000)

  const convites = await prisma.convite.findMany({
    where: {
      aceitoEm:   null,
      expiradoEm: { gt: agora }, // convite expirado não adianta cobrar — só reenviando de novo
      criadoEm:   { lte: limiteIdade },
      OR: [{ lembreteEnviadoEm: null }, { lembreteEnviadoEm: { lte: limiteRepeticao } }],
      tenant: { status: TenantStatus.ATIVO },
    },
    select: {
      id: true, email: true, criadoEm: true, tenantId: true,
      tenant: {
        select: {
          nome: true,
          usuarios: {
            where:  { status: UsuarioStatus.ATIVO, OR: [{ perfil: UsuarioPerfil.ADMIN }, { permGerenciarEquipe: true }] },
            select: { id: true, nome: true, email: true },
          },
        },
      },
    },
  })

  // Agrupa por tenant — um único e-mail por administrador, mesmo com vários convites parados
  type ConviteItem = (typeof convites)[number]
  const porTenant = new Map<string, { nomeTenant: string; usuarios: Array<{ id: string; nome: string; email: string }>; convites: ConviteItem[] }>()
  for (const c of convites) {
    if (!porTenant.has(c.tenantId)) {
      porTenant.set(c.tenantId, { nomeTenant: c.tenant.nome, usuarios: c.tenant.usuarios, convites: [] as ConviteItem[] })
    }
    porTenant.get(c.tenantId)!.convites.push(c)
  }

  let tenantsVerificados = 0
  let avisosEnviados = 0
  const detalhes: Array<{ tenant: string; convites: number; destinatarios: number }> = []

  for (const [tenantId, grupo] of porTenant) {
    tenantsVerificados++

    const destinatarios = await filtrarEEnfileirar(grupo.usuarios, 'emailConvitePendente', {
      tipo:   'emailConvitePendente',
      titulo: grupo.convites.length === 1
        ? `Convite para ${grupo.convites[0].email} ainda não foi aceito`
        : `${grupo.convites.length} convites aguardando aceite`,
      resumo: grupo.convites.map(c => `${c.email} (${diasEntre(c.criadoEm, agora)}d)`).join(', '),
      link:   `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/usuarios`,
    })

    if (destinatarios.length > 0) {
      await enviarEmailSeguro(() => enviarConvitePendente({
        destinatarios,
        convites: grupo.convites.map(c => ({ email: c.email, diasPendente: diasEntre(c.criadoEm, agora) })),
      }))

      await registrarLog({
        tenantId,
        nivel:     LogNivel.AVISO,
        categoria: LogCategoria.USUARIO,
        mensagem:  `Lembrete de convite(s) pendente(s) enviado (${grupo.convites.length})`,
        detalhe:   { convites: grupo.convites.map(c => c.email), destinatarios: destinatarios.map((d: any) => d.email) },
      })

      avisosEnviados++
      detalhes.push({ tenant: grupo.nomeTenant, convites: grupo.convites.length, destinatarios: destinatarios.length })
    }

    // Marca o lembrete como enviado (checado ou não, pra não reavaliar amanhã)
    await prisma.convite.updateMany({
      where: { id: { in: grupo.convites.map(c => c.id) } },
      data:  { lembreteEnviadoEm: agora },
    })
  }

  return NextResponse.json({
    ok: true,
    tenantsVerificados, avisosEnviados, detalhes,
  })
}
