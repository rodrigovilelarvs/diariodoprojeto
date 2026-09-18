// src/api/app/tarefas/etapa/[id]/route.ts
// PATCH  /api/app/tarefas/etapa/:id — editar nome/número da etapa
// DELETE /api/app/tarefas/etapa/:id — remover etapa (só se não tiver atividades)

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarTarefas } from '@/lib/auth'
import { LogCategoria } from '@/lib/prisma-enums'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const etapaId = (await params).id

  if (!podeGerenciarTarefas(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar a lista de tarefas.' }, { status: 403 })
  }

  const etapa = await prisma.etapa.findFirst({
    where: { id: etapaId, projeto: { tenantId } },
  })
  if (!etapa) {
    return NextResponse.json({ erro: 'Etapa não encontrada.' }, { status: 404 })
  }

  let body: { nome?: string; numero?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (body.nome != null && !body.nome.trim()) {
    return NextResponse.json({ erro: 'Nome não pode ficar vazio.' }, { status: 400 })
  }

  const atualizada = await prisma.etapa.update({
    where: { id: etapaId },
    data: {
      ...(body.nome != null && { nome: body.nome }),
      ...(body.numero != null && { numero: body.numero }),
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Etapa "${etapa.nome}" editada`,
    detalhe:   { etapaId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizada)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const etapaId = (await params).id

  if (!podeGerenciarTarefas(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar a lista de tarefas.' }, { status: 403 })
  }

  const etapa = await prisma.etapa.findFirst({
    where: { id: etapaId, projeto: { tenantId } },
  })
  if (!etapa) {
    return NextResponse.json({ erro: 'Etapa não encontrada.' }, { status: 404 })
  }

  const totalAtividades = await prisma.atividade.count({ where: { etapaId } })
  if (totalAtividades > 0) {
    return NextResponse.json(
      { erro: 'Remova todas as atividades desta etapa antes de excluí-la.' },
      { status: 400 },
    )
  }

  await prisma.etapa.delete({ where: { id: etapaId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Etapa "${etapa.nome}" removida`,
    detalhe:   { etapaId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
