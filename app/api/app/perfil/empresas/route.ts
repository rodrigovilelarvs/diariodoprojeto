// src/api/app/perfil/empresas/route.ts
// GET /api/app/perfil/empresas — lista as empresas (tenants) onde existe uma
// conta com o mesmo e-mail do usuário logado. Um mesmo e-mail pode ter uma
// conta (Usuario) independente em cada empresa — nome, senha, foto e perfil
// não são compartilhados entre elas, só o e-mail de login coincide.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId, tenantId } = auth.ctx

  const eu = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { email: true },
  })
  if (!eu) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const contas = await prisma.usuario.findMany({
    where:  { email: eu.email },
    select: {
      tenantId: true, perfil: true, status: true,
      tenant: { select: { id: true, nome: true, status: true } },
    },
  })

  const empresas = contas
    .map((c: any) => ({
      tenantId:     c.tenant.id,
      nome:         c.tenant.nome,
      tenantStatus: c.tenant.status,
      perfil:       c.perfil,
      statusConta:  c.status,
      atual:        c.tenantId === tenantId,
    }))
    .sort((a: any, b: any) => (a.atual === b.atual ? a.nome.localeCompare(b.nome) : a.atual ? -1 : 1))

  return NextResponse.json({ empresas })
}
