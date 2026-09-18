// src/api/cron/contrato-vencendo/route.ts
// GET /api/cron/contrato-vencendo — disparado 1x/dia pelo Vercel Cron.
// Avisa quando o contrato de um projeto ativo vence em exatamente 30 dias —
// notifica os administradores do tenant e o gestor do projeto (se houver).

import { LogCategoria, LogNivel, ProjetoStatus, TenantStatus, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { enviarEmailSeguro, enviarContratoVencendo } from '@/lib/email'
import { filtrarEEnfileirar } from '@/lib/notificacoes'

const DIAS_AVISO = 30

// Aceita apenas o disparo do Vercel Cron (header Authorization com CRON_SECRET).
// Sem CRON_SECRET configurado, só libera fora de produção (facilita testes locais).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// "Hoje" no fuso de Brasília, como data pura (bate com Projeto.dataFimContrato, @db.Date)
function hojeBR(): Date {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate()))
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const hoje = hojeBR()
  const alvo = new Date(hoje)
  alvo.setUTCDate(alvo.getUTCDate() + DIAS_AVISO)
  const alvoFim = new Date(alvo)
  alvoFim.setUTCDate(alvoFim.getUTCDate() + 1)

  const projetos = await prisma.projeto.findMany({
    where: {
      status: ProjetoStatus.ATIVO,
      // dataFimContrato é DateTime (não @db.Date) — compara por faixa do dia
      // alvo em vez de igualdade exata, pra não depender da hora salva.
      dataFimContrato: { gte: alvo, lt: alvoFim },
      tenant: { status: TenantStatus.ATIVO },
    },
    select: {
      id: true, nome: true, tenantId: true, dataFimContrato: true,
      gestor: { select: { id: true, nome: true, email: true, status: true } },
      tenant: {
        select: {
          nome: true,
          usuarios: {
            where:  { status: UsuarioStatus.ATIVO, perfil: UsuarioPerfil.ADMIN },
            select: { id: true, nome: true, email: true },
          },
        },
      },
    },
  })

  let verificados = 0
  let avisosEnviados = 0
  const detalhes: Array<{ projeto: string; tenant: string; destinatarios: number }> = []

  for (const projeto of projetos) {
    verificados++

    const alvos = [...projeto.tenant.usuarios]
    if (projeto.gestor && projeto.gestor.status === UsuarioStatus.ATIVO && !alvos.some(u => u.id === projeto.gestor!.id)) {
      alvos.push(projeto.gestor)
    }

    const destinatarios = await filtrarEEnfileirar(alvos, 'emailContratoVencendo', {
      tipo:   'emailContratoVencendo',
      titulo: `Contrato de "${projeto.nome}" vence em ${DIAS_AVISO} dias`,
      resumo: `Vencimento em ${projeto.dataFimContrato!.toISOString().slice(0, 10)}.`,
      link:   `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/painel`,
    })
    if (destinatarios.length === 0) continue

    await enviarEmailSeguro(() => enviarContratoVencendo({
      destinatarios,
      projeto:       projeto.nome,
      dataFim:       projeto.dataFimContrato!,
      diasRestantes: DIAS_AVISO,
    }))

    await registrarLog({
      tenantId:  projeto.tenantId,
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.EMPRESA,
      mensagem:  `Aviso de contrato vencendo em ${DIAS_AVISO} dias enviado — projeto "${projeto.nome}"`,
      detalhe:   { projetoId: projeto.id, dataFimContrato: projeto.dataFimContrato!.toISOString().slice(0, 10), destinatarios: destinatarios.map((d: any) => d.email) },
    })

    avisosEnviados++
    detalhes.push({ projeto: projeto.nome, tenant: projeto.tenant.nome, destinatarios: destinatarios.length })
  }

  return NextResponse.json({
    ok: true,
    dataAlvo: alvo.toISOString().slice(0, 10),
    verificados, avisosEnviados, detalhes,
  })
}
