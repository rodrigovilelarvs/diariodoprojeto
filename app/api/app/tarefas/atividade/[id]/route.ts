// src/api/app/tarefas/atividade/[id]/route.ts
// PATCH  /api/app/tarefas/atividade/:id — editar nome/datas/status/% da atividade
// DELETE /api/app/tarefas/atividade/:id — remover atividade (só se nunca apareceu em um RDO)

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarTarefas } from '@/lib/auth'
import { LogCategoria, AtividadeStatus } from '@/lib/prisma-enums'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const atividadeId = (await params).id

  if (!podeGerenciarTarefas(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar a lista de tarefas.' }, { status: 403 })
  }

  const atividade = await prisma.atividade.findFirst({
    where: { id: atividadeId, etapa: { projeto: { tenantId } } },
  })
  if (!atividade) {
    return NextResponse.json({ erro: 'Atividade não encontrada.' }, { status: 404 })
  }

  let body: {
    nome?: string
    dataInicio?: string
    dataFim?: string
    status?: string
    pctAcumulado?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (body.nome != null && !body.nome.trim()) {
    return NextResponse.json({ erro: 'Nome não pode ficar vazio.' }, { status: 400 })
  }
  if (body.status != null && !Object.values(AtividadeStatus).includes(body.status as AtividadeStatus)) {
    return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
  }

  const atualizada = await prisma.atividade.update({
    where: { id: atividadeId },
    data: {
      ...(body.nome != null && { nome: body.nome }),
      ...(body.dataInicio != null && { dataInicio: new Date(body.dataInicio) }),
      ...(body.dataFim != null && { dataFim: new Date(body.dataFim) }),
      ...(body.status != null && { status: body.status as AtividadeStatus }),
      ...(body.pctAcumulado != null && { pctAcumulado: Number(body.pctAcumulado) }),
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Atividade "${atividade.nome}" editada`,
    detalhe:   { atividadeId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizada)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const atividadeId = (await params).id

  if (!podeGerenciarTarefas(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar a lista de tarefas.' }, { status: 403 })
  }

  const atividade = await prisma.atividade.findFirst({
    where: { id: atividadeId, etapa: { projeto: { tenantId } } },
  })
  if (!atividade) {
    return NextResponse.json({ erro: 'Atividade não encontrada.' }, { status: 404 })
  }

  const usosEmRdo = await prisma.registroRdoAtividade.count({ where: { atividadeId } })
  if (usosEmRdo > 0) {
    return NextResponse.json(
      { erro: 'Esta atividade já foi registrada em RDOs e não pode ser excluída.' },
      { status: 400 },
    )
  }

  await prisma.atividade.delete({ where: { id: atividadeId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Atividade "${atividade.nome}" removida`,
    detalhe:   { atividadeId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
