// src/api/app/rdos/:id/log/route.ts
// GET /api/app/rdos/:id/log — histórico de edições e visualizações do RDO
// (reaproveita o LogAuditoria já gravado em cada ação, sem tabela nova)

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeVerProjeto } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx
  const rdoId = (await params).id

  const rdo = await prisma.rdo.findFirst({
    where:  { id: rdoId, projeto: { tenantId } },
    select: { id: true, projetoId: true },
  })
  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(rdo.projetoId, auth.ctx)
  if (!podeVerProjeto(acessoProjeto)) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const marcador = `"rdoId":"${rdoId}"`
  const logs: Array<{ mensagem: string; criadoEm: Date; detalhe: string | null; usuario: { nome: string } | null }> = await prisma.logAuditoria.findMany({
    where: {
      tenantId,
      categoria: LogCategoria.RDO,
      detalhe:   { contains: marcador },
    },
    select: {
      mensagem: true, criadoEm: true, detalhe: true,
      usuario:  { select: { nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })

  const visualizacoes = logs.filter((l) => l.detalhe?.includes('"tipo":"visualizacao"'))
  const edicoes       = logs.filter((l) => !l.detalhe?.includes('"tipo":"visualizacao"'))

  const formatar = (l: (typeof logs)[number]) => ({
    mensagem: l.mensagem,
    criadoEm: l.criadoEm,
    usuario:  l.usuario?.nome ?? 'Sistema',
  })

  return NextResponse.json({
    edicoes:       edicoes.map(formatar),
    visualizacoes: visualizacoes.map(formatar),
  })
}
