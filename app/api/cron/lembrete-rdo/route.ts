// src/api/cron/lembrete-rdo/route.ts
// GET /api/cron/lembrete-rdo — disparado pelo Vercel Cron às 18h (America/Sao_Paulo)
// Verifica projetos ativos sem RDO emitido no dia anterior e envia lembrete por e-mail.
// Não dispara se o dia anterior foi sábado, domingo ou feriado nacional.

import { LogCategoria, LogNivel, ProjetoStatus, TenantStatus, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { enviarEmailSeguro, enviarLembreteDiario } from '@/lib/email'
import { ehDiaUtil } from '@/lib/feriados'
import { filtrarEEnfileirar } from '@/lib/notificacoes'

// Aceita apenas o disparo do Vercel Cron (header Authorization com CRON_SECRET).
// Sem CRON_SECRET configurado, só libera fora de produção (facilita testes locais).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// "Hoje" no fuso de Brasília (UTC-3, sem horário de verão), como data pura (para bater com Rdo.data, que é @db.Date)
function hojeBR(): Date {
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate()))
}

function diaAnterior(data: Date): Date {
  const d = new Date(data)
  d.setUTCDate(d.getUTCDate() - 1)
  return d
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const dataVerificada = diaAnterior(hojeBR())

  // Fim de semana ou feriado nacional — nenhum RDO é esperado, não há o que cobrar
  if (!ehDiaUtil(dataVerificada)) {
    return NextResponse.json({
      ok: true, pulado: true,
      motivo: 'Dia anterior não é dia útil (fim de semana ou feriado nacional).',
      dataVerificada: dataVerificada.toISOString().slice(0, 10),
    })
  }

  type ProjetoComDestinatarios = {
    id: string; nome: string; tenantId: string
    tenant: { nome: string; usuarios: Array<{ id: string; nome: string; email: string }> }
  }

  const projetos: ProjetoComDestinatarios[] = await prisma.projeto.findMany({
    where: {
      status: ProjetoStatus.ATIVO,
      tenant: { status: TenantStatus.ATIVO },
    },
    select: {
      id: true,
      nome: true,
      tenantId: true,
      tenant: {
        select: {
          nome: true,
          usuarios: {
            where: {
              status: UsuarioStatus.ATIVO,
              OR: [{ perfil: UsuarioPerfil.ADMIN }, { permEmitirRdo: true }],
            },
            select: { id: true, nome: true, email: true },
          },
        },
      },
    },
  })

  let verificados = 0
  let lembretesEnviados = 0
  const detalhes: Array<{ projeto: string; tenant: string; destinatarios: number }> = []

  for (const projeto of projetos) {
    verificados++

    const rdoDoDia = await prisma.rdo.findFirst({
      where: { projetoId: projeto.id, data: dataVerificada },
      select: { id: true },
    })
    if (rdoDoDia) continue

    const dataFmt = dataVerificada.toISOString().slice(0, 10)
    const destinatarios = await filtrarEEnfileirar(projeto.tenant.usuarios, 'emailLembreteDiario', {
      tipo:   'emailLembreteDiario',
      titulo: `RDO de ${dataFmt} não foi emitido`,
      resumo: `Projeto "${projeto.nome}" ficou sem RDO nesse dia.`,
      link:   `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/rdos/novo`,
    })
    if (destinatarios.length === 0) continue

    await enviarEmailSeguro(() => enviarLembreteDiario({
      destinatarios,
      projeto: projeto.nome,
      data:    dataVerificada,
    }))

    await registrarLog({
      tenantId:  projeto.tenantId,
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.RDO,
      mensagem:  `Lembrete de RDO não emitido (${dataVerificada.toISOString().slice(0, 10)}) enviado — projeto "${projeto.nome}"`,
      detalhe:   { projetoId: projeto.id, dataVerificada: dataVerificada.toISOString().slice(0, 10), destinatarios: destinatarios.map((d) => d.email) },
    })

    lembretesEnviados++
    detalhes.push({ projeto: projeto.nome, tenant: projeto.tenant.nome, destinatarios: destinatarios.length })
  }

  return NextResponse.json({
    ok: true, pulado: false,
    dataVerificada: dataVerificada.toISOString().slice(0, 10),
    verificados, lembretesEnviados, detalhes,
  })
}
