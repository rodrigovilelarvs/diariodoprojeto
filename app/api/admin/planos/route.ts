// src/api/admin/planos/route.ts
// GET   /api/admin/planos          — listar configurações dos planos
// PATCH /api/admin/planos          — atualizar preço, limites e funcionalidades de um
//                                     plano (limites alterados valem pras empresas dele)

import { LogCategoria, PlanoTipo } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
import { CAMPOS_LIMITE, limitesAlterados, type LimitesPlano } from '@/lib/planos'
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

  // Os números do plano valem pra todas as empresas dele: valida antes de gravar
  for (const campo of CAMPOS_LIMITE) {
    const v = dados[campo]
    if (v != null && (!Number.isInteger(v) || v < 0)) {
      return NextResponse.json(
        { erro: `Limite inválido (${campo}): use um número inteiro, 0 ou maior (0 = ilimitado).` },
        { status: 400 },
      )
    }
  }
  if (dados.precoMensal != null && (!Number.isFinite(dados.precoMensal) || dados.precoMensal < 0)) {
    return NextResponse.json({ erro: 'Preço inválido.' }, { status: 400 })
  }

  // Limites que de fato mudam nesta edição → aplicados às empresas do plano.
  // Preço e funcionalidades não precisam de cópia: a tela da empresa, o MRR e
  // os avisos leem direto do plano.
  const existente: (LimitesPlano & { tenantId: string | null }) | null = await prisma.planoConfig.findUnique({ where: { tipo } })
  const mudancasLimite = limitesAlterados(existente, dados)
  // Configuração própria de uma empresa específica (tenantId) não é a do plano
  const propagar = Object.keys(mudancasLimite).length > 0 && !existente?.tenantId

  const salvarPlano = prisma.planoConfig.upsert({
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

  // Plano e empresas mudam juntos (tudo ou nada): nunca fica um plano novo com
  // empresas presas no limite antigo.
  const [atualizado, empresas] = propagar
    ? await prisma.$transaction([salvarPlano, prisma.tenant.updateMany({ where: { plano: tipo }, data: mudancasLimite })])
    : [await salvarPlano, { count: 0 }]
  const empresasAtualizadas: number = empresas.count

  await registrarLog({
    categoria: LogCategoria.PLANO,
    mensagem:  empresasAtualizadas > 0
      ? `Configuração do plano ${tipo} atualizada — limites aplicados a ${empresasAtualizadas} empresa(s)`
      : `Configuração do plano ${tipo} atualizada`,
    detalhe:   { tipo, alteracoes: dados, limitesAplicados: mudancasLimite, empresasAtualizadas, adminId },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ ...atualizado, empresasAtualizadas })
}
