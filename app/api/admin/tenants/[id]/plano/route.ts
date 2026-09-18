// src/api/admin/tenants/[id]/plano/route.ts
// PATCH /api/admin/tenants/:id/plano — mudar plano da empresa

import { LogCategoria, PlanoTipo } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { adminId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  const tenant = await prisma.tenant.findUnique({ where: { id: (await params).id } })
  if (!tenant) {
    return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }

  let body: {
    plano:              PlanoTipo
    limiteUsuarios?:    number   // override manual (ex: Enterprise negociado)
    limiteRdosMes?:     number
    limiteProjetos?:    number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.plano || !Object.values(PlanoTipo).includes(body.plano)) {
    return NextResponse.json({ erro: 'Plano inválido.' }, { status: 400 })
  }

  const planoAntigo = tenant.plano

  // Busca limites padrão do plano escolhido
  const planoConfig = await prisma.planoConfig.findUnique({
    where: { tipo: body.plano },
  })

  // Override manual tem prioridade — útil para Enterprise negociado
  const novosLimites = {
    limiteUsuarios: body.limiteUsuarios ?? planoConfig?.limiteUsuarios ?? tenant.limiteUsuarios,
    limiteRdosMes:  body.limiteRdosMes  ?? planoConfig?.limiteRdosMes  ?? tenant.limiteRdosMes,
    limiteProjetos: body.limiteProjetos ?? planoConfig?.limiteProjetos ?? tenant.limiteProjetos,
  }

  const atualizado = await prisma.tenant.update({
    where: { id: (await params).id },
    data:  {
      plano: body.plano,
      ...novosLimites,
    },
  })

  const precos: Record<PlanoTipo, number> = {
    STARTER:    0,
    PRO:        297,
    ENTERPRISE: 1485,
  }

  await registrarLog({
    tenantId:  (await params).id,
    categoria: LogCategoria.PLANO,
    mensagem:  `Plano alterado: ${planoAntigo} → ${body.plano} (R$ ${precos[body.plano]}/mês)`,
    detalhe:   {
      planoAntigo,
      planoNovo:  body.plano,
      novosLimites,
      adminId,
    },
    ipAddress,
    userAgent,
  })

  // TODO: notificar admin da empresa sobre a mudança de plano
  // TODO: integrar com sistema de cobrança (Stripe / Iugu)

  return NextResponse.json({
    ok: true,
    tenant: {
      id:    atualizado.id,
      nome:  atualizado.nome,
      plano: atualizado.plano,
      ...novosLimites,
    },
    transicao: {
      de:    planoAntigo,
      para:  body.plano,
      valor: precos[body.plano],
    },
  })
}
