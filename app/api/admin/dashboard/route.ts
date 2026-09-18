// src/api/admin/dashboard/route.ts
// GET /api/admin/dashboard — todos os KPIs do painel do super-admin

import { LogNivel } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — criadoEm ainda é Date aqui (LogEntry, em lib/types.ts, já
// é a forma pós-serialização JSON, com criadoEm como string).
type LogRow = {
  id: string; nivel: string; categoria: string; mensagem: string; criadoEm: Date; resolvido: boolean
  tenant: { nome: string } | null
  usuario: { nome: string; email: string } | null
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const hoje     = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const fimMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0)

  const [
    // Empresas
    totalEmpresas,
    empresasAtivas,
    empresasAguardando,
    novasEmpresasMes,
    novasEmpresasMesPassado,

    // Usuários
    totalUsuarios,
    usuariosAtivos,
    novosUsuariosMes,

    // RDOs
    rdosMes,
    rdosMesPassado,

    // Planos para MRR
    distribuicaoPlanos,
    planosConfig,

    // Alertas
    alertasAbertos,
    alertasCriticos,

    // Logs recentes para o feed
    logsRecentes,

    // Uso por tenant (para gráfico)
    rdosPorTenant,
  ]: [
    number, number, number, number, number,
    number, number, number,
    number, number,
    Array<{ plano: string; _count: number }>,
    Array<{ tipo: string; precoMensal: number }>,
    number, number,
    LogRow[],
    Array<{ projetoId: string; _count: number }>,
  ] = await Promise.all([

    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ATIVO' } }),
    prisma.tenant.count({ where: { status: 'AGUARDANDO' } }),
    prisma.tenant.count({ where: { criadoEm: { gte: inicioMes } } }),
    prisma.tenant.count({ where: { criadoEm: { gte: mesPassado, lte: fimMesPassado } } }),

    prisma.usuario.count({ where: { status: 'ATIVO' } }),
    prisma.usuario.count({
      where: {
        status:        'ATIVO',
        ultimoAcessoEm: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.usuario.count({ where: { criadoEm: { gte: inicioMes } } }),

    prisma.rdo.count({ where: { criadoEm: { gte: inicioMes } } }),
    prisma.rdo.count({ where: { criadoEm: { gte: mesPassado, lte: fimMesPassado } } }),

    prisma.tenant.groupBy({
      by:    ['plano'],
      where: { status: 'ATIVO' },
      _count: true,
    }),

    prisma.planoConfig.findMany({ orderBy: { precoMensal: 'asc' } }),

    prisma.logAuditoria.count({
      where: { nivel: { in: [LogNivel.ERRO, LogNivel.CRITICO] }, resolvido: false },
    }),
    prisma.logAuditoria.count({
      where: { nivel: LogNivel.CRITICO, resolvido: false },
    }),

    prisma.logAuditoria.findMany({
      where:   { nivel: { in: [LogNivel.ERRO, LogNivel.CRITICO, LogNivel.AVISO] } },
      orderBy: { criadoEm: 'desc' },
      take:    8,
      include: {
        tenant:  { select: { nome: true } },
        usuario: { select: { nome: true, email: true } },
      },
    }),

    // RDOs por empresa no mês (top 5)
    prisma.rdo.groupBy({
      by:    ['projetoId'],
      where: { criadoEm: { gte: inicioMes } },
      _count: true,
      orderBy: { _count: { projetoId: 'desc' } },
      take:  5,
    }),
  ])

  // Calcula MRR
  const precoPorPlano: Record<string, number> = Object.fromEntries(
    planosConfig.map((p) => [p.tipo, Number(p.precoMensal)]),
  )
  const mrr = distribuicaoPlanos.reduce((acc: number, d) => {
    return acc + (precoPorPlano[d.plano] ?? 0) * d._count
  }, 0)

  const mrrMesPassado = mrr  // simplificado — em produção buscaria histórico de pagamentos

  // Tendências (comparando mês atual vs mês passado)
  const tendencias = {
    empresas: calcTendencia(novasEmpresasMes, novasEmpresasMesPassado),
    rdos:     calcTendencia(rdosMes, rdosMesPassado),
    mrr:      calcTendencia(mrr, mrrMesPassado),
  }

  return NextResponse.json({
    kpis: {
      empresas: {
        total:      totalEmpresas,
        ativas:     empresasAtivas,
        aguardando: empresasAguardando,
        novasMes:   novasEmpresasMes,
        tendencia:  tendencias.empresas,
      },
      usuarios: {
        total:      totalUsuarios,
        ativos7d:   usuariosAtivos,
        novosMes:   novosUsuariosMes,
      },
      rdos: {
        mes:           rdosMes,
        mesPassado:    rdosMesPassado,
        tendencia:     tendencias.rdos,
      },
      receita: {
        mrr,
        tendencia: tendencias.mrr,
        porPlano:  Object.fromEntries(
          distribuicaoPlanos.map((d) => [
            d.plano,
            {
              empresas: d._count,
              receita:  (precoPorPlano[d.plano] ?? 0) * d._count,
            },
          ]),
        ),
      },
      alertas: {
        abertos:  alertasAbertos,
        criticos: alertasCriticos,
      },
    },
    logsRecentes,
    distribuicaoPlanos: distribuicaoPlanos.map((d) => ({
      plano:    d.plano,
      empresas: d._count,
      receita:  (precoPorPlano[d.plano] ?? 0) * d._count,
    })),
  })
}

// ── Helpers ──────────────────────────────────────────────────
function calcTendencia(
  atual:    number,
  anterior: number,
): { valor: number; percentual: number; direcao: 'up' | 'down' | 'stable' } {
  if (anterior === 0) return { valor: atual, percentual: 0, direcao: 'stable' }
  const diff = atual - anterior
  const pct  = Math.round((diff / anterior) * 100)
  return {
    valor:     diff,
    percentual: pct,
    direcao:   pct > 0 ? 'up' : pct < 0 ? 'down' : 'stable',
  }
}
