// src/api/admin/logs/[id]/route.ts
// PATCH /api/admin/logs/:id — marcar como resolvido + nota interna

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const log = await prisma.logAuditoria.findUnique({ where: { id: (await params).id } })
  if (!log) {
    return NextResponse.json({ erro: 'Log não encontrado.' }, { status: 404 })
  }

  let body: { resolvido?: boolean; notaInterna?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const atualizado = await prisma.logAuditoria.update({
    where: { id: (await params).id },
    data:  {
      ...(body.resolvido     != null && {
        resolvido:   body.resolvido,
        resolvidoEm: body.resolvido ? new Date() : null,
      }),
      ...(body.notaInterna != null && { notaInterna: body.notaInterna }),
    },
  })

  return NextResponse.json(atualizado)
}
