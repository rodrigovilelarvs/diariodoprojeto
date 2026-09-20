// src/api/app/projetos/:id/acesso/:usuarioId/route.ts
// DELETE /api/app/projetos/:id/acesso/:usuarioId — remove o acesso de um usuário ao projeto

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeGerenciarProjeto } from '@/lib/auth'

type Params = { params: Promise<{ id: string; usuarioId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const { id: projetoId, usuarioId: alvoId } = await params

  const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, tenantId } })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acesso = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(auth.ctx, acesso)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar o acesso deste projeto.' }, { status: 403 })
  }

  const registro = await prisma.projetoAcesso.findUnique({
    where:   { projetoId_usuarioId: { projetoId, usuarioId: alvoId } },
    include: { usuario: { select: { nome: true } } },
  })
  if (!registro) {
    return NextResponse.json({ erro: 'Registro de acesso não encontrado.' }, { status: 404 })
  }

  await prisma.projetoAcesso.delete({
    where: { projetoId_usuarioId: { projetoId, usuarioId: alvoId } },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Acesso de "${registro.usuario.nome}" ao projeto "${projeto.nome}" removido`,
    detalhe:   { projetoId, alvoId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
