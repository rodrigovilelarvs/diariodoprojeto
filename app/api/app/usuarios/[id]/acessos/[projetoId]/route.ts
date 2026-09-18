// src/api/app/usuarios/:id/acessos/:projetoId/route.ts
// DELETE /api/app/usuarios/:id/acessos/:projetoId — remove o acesso do usuário a um projeto

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe } from '@/lib/auth'

type Params = { params: Promise<{ id: string; projetoId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const { id: alvoId, projetoId } = await params

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const registro = await prisma.projetoAcesso.findUnique({
    where:   { projetoId_usuarioId: { projetoId, usuarioId: alvoId } },
    include: { projeto: { select: { nome: true, tenantId: true } } },
  })
  if (!registro || registro.projeto.tenantId !== tenantId) {
    return NextResponse.json({ erro: 'Registro de acesso não encontrado.' }, { status: 404 })
  }

  await prisma.projetoAcesso.delete({
    where: { projetoId_usuarioId: { projetoId, usuarioId: alvoId } },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Acesso de "${alvo.nome}" ao projeto "${registro.projeto.nome}" removido`,
    detalhe:   { alvoId, projetoId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
