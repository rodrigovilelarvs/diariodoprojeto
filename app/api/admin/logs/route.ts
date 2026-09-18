// src/api/admin/logs/route.ts
// GET   /api/admin/logs             — listar logs (toda plataforma)
// PATCH /api/admin/logs/:id/resolver — marcar como resolvido

import { LogCategoria, LogNivel } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
// ── GET — log geral ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)

  const tenantId  = searchParams.get('tenantId')  ?? undefined
  const nivel     = searchParams.get('nivel')     as LogNivel     | null
  const categoria = searchParams.get('categoria') as LogCategoria | null
  const busca     = searchParams.get('busca')     ?? undefined
  const resolvido = searchParams.get('resolvido')
  const periodo   = Number(searchParams.get('periodo') ?? 7)   // dias
  const pagina    = Number(searchParams.get('pagina')  ?? 1)
  const por       = Number(searchParams.get('por')     ?? 50)

  const dataInicio = new Date()
  dataInicio.setDate(dataInicio.getDate() - periodo)

  const logs = await prisma.logAuditoria.findMany({
    where: {
      ...(tenantId  ? { tenantId }                       : {}),
      ...(nivel     ? { nivel }                          : {}),
      ...(categoria ? { categoria }                      : {}),
      ...(busca     ? { mensagem: { contains: busca, mode: 'insensitive' } } : {}),
      ...(resolvido === 'true'  ? { resolvido: true }   : {}),
      ...(resolvido === 'false' ? { resolvido: false }  : {}),
      criadoEm: { gte: dataInicio },
    },
    include: {
      tenant:  { select: { id: true, nome: true } },
      usuario: { select: { id: true, nome: true, email: true } },
    },
    orderBy: [
      { nivel:    'desc' },   // CRITICO primeiro
      { criadoEm: 'desc' },
    ],
    skip: (pagina - 1) * por,
    take: por,
  })

  const total = await prisma.logAuditoria.count({
    where: {
      ...(tenantId  ? { tenantId }  : {}),
      ...(nivel     ? { nivel }     : {}),
      ...(categoria ? { categoria } : {}),
      criadoEm: { gte: dataInicio },
    },
  })

  // Contadores por nível para os KPIs do painel
  // `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
  // lib/prisma.ts) — anotado aqui localmente com a forma do `groupBy` acima.
  const contadores: Array<{ nivel: LogNivel; _count: number }> = await prisma.logAuditoria.groupBy({
    by:    ['nivel'],
    where: { criadoEm: { gte: dataInicio } },
    _count: true,
  })

  const alertasNaoResolvidos = await prisma.logAuditoria.count({
    where: {
      nivel:     { in: [LogNivel.ERRO, LogNivel.CRITICO] },
      resolvido: false,
      criadoEm:  { gte: dataInicio },
    },
  })

  return NextResponse.json({
    logs,
    total,
    pagina,
    por,
    kpis: {
      total,
      alertasNaoResolvidos,
      porNivel: Object.fromEntries(
        contadores.map((c) => [c.nivel, c._count]),
      ),
    },
  })
}
