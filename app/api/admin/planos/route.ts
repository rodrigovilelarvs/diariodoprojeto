// src/api/admin/planos/route.ts
// GET   /api/admin/planos          — listar configurações dos planos
// PATCH /api/admin/planos/:tipo    — atualizar limites e preço de um plano

import { LogCategoria, PlanoTipo } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
import type { PlanoConfig } from '@/lib/types'
// ── GET ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  // `prisma` não carrega os tipos gerados do Prisma Client neste projeto
  // (ver lib/prisma.ts) — anota localmente com a forma real da tabela.
  type DistribuicaoRow = { plano: PlanoTipo; _count: number }

  const planos: PlanoConfig[] = await prisma.planoConfig.findMany({
    orderBy: { precoMensal: 'asc' },
  })

  // Conta empresas em cada plano
  const distribuicao: DistribuicaoRow[] = await prisma.tenant.groupBy({
    by:     ['plano'],
    where:  { status: 'ATIVO' },
    _count: true,
  })

  // Empresas e receita mensal recorrente por plano — a tela de planos usa
  // isso pro card "Distribuição" (array, não um Record por tipo).
  const distribuicaoPorPlano = distribuicao.map((d) => {
    const plano = planos.find((p) => p.tipo === d.plano)
    const receita = Number(plano?.precoMensal ?? 0) * d._count
    return { plano: d.plano, empresas: d._count, receita }
  })
  const mrr = distribuicaoPorPlano.reduce((acc, d) => acc + d.receita, 0)

  return NextResponse.json({
    planos,
    distribuicao: distribuicaoPorPlano,
    mrr,
  })
}

// ── PATCH /api/admin/planos/:tipo ────────────────────────────
// (rota separada abaixo via arquivo [tipo]/route.ts — aqui para referência)
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { adminId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  // Tipo vem no body pois rota não tem param neste arquivo
  let body: {
    tipo:               PlanoTipo
    precoMensal?:       number
    limiteUsuarios?:    number
    limiteRdosMes?:     number
    limiteProjetos?:    number
    temRelatorios?:     boolean
    temExportPdf?:      boolean
    temApi?:            boolean
    temSuporteDedicado?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.tipo || !Object.values(PlanoTipo).includes(body.tipo)) {
    return NextResponse.json({ erro: 'Tipo de plano inválido.' }, { status: 400 })
  }

  const { tipo, ...dados } = body

  const atualizado = await prisma.planoConfig.upsert({
    where:  { tipo },
    update: {
      ...(dados.precoMensal        != null && { precoMensal:        dados.precoMensal }),
      ...(dados.limiteUsuarios     != null && { limiteUsuarios:     dados.limiteUsuarios }),
      ...(dados.limiteRdosMes      != null && { limiteRdosMes:      dados.limiteRdosMes }),
      ...(dados.limiteProjetos     != null && { limiteProjetos:     dados.limiteProjetos }),
      ...(dados.temRelatorios      != null && { temRelatorios:      dados.temRelatorios }),
      ...(dados.temExportPdf       != null && { temExportPdf:       dados.temExportPdf }),
      ...(dados.temApi             != null && { temApi:             dados.temApi }),
      ...(dados.temSuporteDedicado != null && { temSuporteDedicado: dados.temSuporteDedicado }),
    },
    create: {
      tipo,
      precoMensal:        dados.precoMensal        ?? 0,
      limiteUsuarios:     dados.limiteUsuarios     ?? 3,
      limiteRdosMes:      dados.limiteRdosMes      ?? 30,
      limiteProjetos:     dados.limiteProjetos     ?? 2,
      temRelatorios:      dados.temRelatorios      ?? false,
      temExportPdf:       dados.temExportPdf       ?? true,
      temApi:             dados.temApi             ?? false,
      temSuporteDedicado: dados.temSuporteDedicado ?? false,
    },
  })

  await registrarLog({
    categoria: LogCategoria.PLANO,
    mensagem:  `Configuração do plano ${tipo} atualizada`,
    detalhe:   { tipo, alteracoes: dados, adminId },
    ipAddress,
    userAgent,
  })

  // NOTA: a mudança de PlanoConfig NÃO afeta automaticamente tenants existentes.
  // Ela só vale para novas contratações. Para ajustar tenants existentes, use
  // PATCH /api/admin/tenants/:id/plano individualmente.

  return NextResponse.json(atualizado)
}
