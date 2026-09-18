// src/api/app/rdos/[id]/comentarios/[comentarioId]/route.ts
// PATCH  /api/app/rdos/:id/comentarios/:comentarioId — edita o texto (autor ou ADMIN)
// DELETE /api/app/rdos/:id/comentarios/:comentarioId — remove um comentário (apenas ADMIN)

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { LogCategoria, UsuarioPerfil } from '@/lib/prisma-enums'

type Params = { params: Promise<{ id: string; comentarioId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId, perfil } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const { id: rdoId, comentarioId } = await params

  const comentario = await prisma.comentario.findFirst({
    where: { id: comentarioId, rdoId, rdo: { projeto: { tenantId } } },
  })
  if (!comentario) {
    return NextResponse.json({ erro: 'Comentário não encontrado.' }, { status: 404 })
  }

  if (comentario.autorId !== usuarioId && perfil !== UsuarioPerfil.ADMIN) {
    return NextResponse.json({ erro: 'Você só pode editar seus próprios comentários.' }, { status: 403 })
  }

  let body: { texto?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.texto?.trim()) {
    return NextResponse.json({ erro: 'Texto do comentário é obrigatório.' }, { status: 400 })
  }

  const atualizado = await prisma.comentario.update({
    where: { id: comentarioId },
    data:  { texto: body.texto.trim(), editadoEm: new Date() },
    include: {
      autor: { select: { id: true, nome: true, avatarUrl: true } },
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Comentário editado no RDO`,
    detalhe:   { rdoId, comentarioId },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId, perfil } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const { id: rdoId, comentarioId } = await params

  if (perfil !== UsuarioPerfil.ADMIN) {
    return NextResponse.json({ erro: 'Apenas o administrador da empresa pode excluir comentários.' }, { status: 403 })
  }

  const comentario = await prisma.comentario.findFirst({
    where: { id: comentarioId, rdoId, rdo: { projeto: { tenantId } } },
  })
  if (!comentario) {
    return NextResponse.json({ erro: 'Comentário não encontrado.' }, { status: 404 })
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.comentario.deleteMany({ where: { parentId: comentarioId } })
    await tx.comentario.delete({ where: { id: comentarioId } })
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Comentário excluído do RDO`,
    detalhe:   { rdoId, comentarioId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
