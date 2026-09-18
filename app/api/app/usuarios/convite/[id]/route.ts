// src/api/app/usuarios/convite/[id]/route.ts
// DELETE /api/app/usuarios/convite/:id — cancelar convite pendente

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const conviteId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const convite = await prisma.convite.findFirst({ where: { id: conviteId, tenantId } })
  if (!convite) {
    return NextResponse.json({ erro: 'Convite não encontrado.' }, { status: 404 })
  }

  if (convite.aceitoEm) {
    return NextResponse.json({ erro: 'Este convite já foi aceito e não pode ser cancelado.' }, { status: 400 })
  }

  await prisma.convite.delete({ where: { id: conviteId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  `Convite cancelado (${convite.email})`,
    detalhe:   { conviteId, email: convite.email },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
