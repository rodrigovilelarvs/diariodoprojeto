// app/api/app/midias/route.ts
// POST /api/app/midias  — registra mídia no banco após upload no Storage
// PATCH /api/app/midias?id= — atualiza a descrição/legenda
// DELETE /api/app/midias?id= — remove do banco e do Storage

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { LogCategoria } from '@/lib/prisma-enums'
import { supabaseAdmin } from '@/lib/storage'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId, usuarioId } = auth.ctx

  let body: {
    rdoId: string; tipo: string; nomeArq: string; url: string
    tamanhoBytes?: number; descricao?: string; ordem?: number
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }) }

  const rdo = await prisma.rdo.findFirst({
    where: { id: body.rdoId, projeto: { tenantId } }, select: { id: true },
  })
  if (!rdo) return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })

  const midia = await (prisma as any).midia.create({
    data: {
      rdoId: body.rdoId, tipo: body.tipo, nomeArq: body.nomeArq,
      url: body.url, tamanhoBytes: body.tamanhoBytes,
      descricao: body.descricao, ordem: body.ordem ?? 0,
    },
  })

  await registrarLog({
    tenantId, usuarioId, categoria: LogCategoria.RDO,
    mensagem: `Mídia "${body.nomeArq}" adicionada ao RDO`,
    detalhe: { midiaId: midia.id, rdoId: body.rdoId, tipo: body.tipo },
  })

  return NextResponse.json(midia, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId } = auth.ctx
  const midiaId = new URL(req.url).searchParams.get('id')
  if (!midiaId) return NextResponse.json({ erro: 'id obrigatório.' }, { status: 400 })

  let body: { descricao?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }) }

  const midia = await (prisma as any).midia.findFirst({
    where: { id: midiaId, rdo: { projeto: { tenantId } } },
  })
  if (!midia) return NextResponse.json({ erro: 'Mídia não encontrada.' }, { status: 404 })

  const atualizada = await (prisma as any).midia.update({
    where: { id: midiaId },
    data:  { descricao: body.descricao ?? '' },
  })

  return NextResponse.json(atualizada)
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId, usuarioId } = auth.ctx
  const midiaId = new URL(req.url).searchParams.get('id')
  if (!midiaId) return NextResponse.json({ erro: 'id obrigatório.' }, { status: 400 })

  const midia = await (prisma as any).midia.findFirst({
    where: { id: midiaId, rdo: { projeto: { tenantId } } },
  })
  if (!midia) return NextResponse.json({ erro: 'Mídia não encontrada.' }, { status: 404 })

  try {
    const path = new URL(midia.url).pathname.split('/rdos-midias/')[1]
    if (path) await supabaseAdmin().storage.from('rdos-midias').remove([path])
  } catch { /* ignora erro storage */ }

  await (prisma as any).midia.delete({ where: { id: midiaId } })
  await registrarLog({
    tenantId, usuarioId, categoria: LogCategoria.RDO,
    mensagem: `Mídia "${midia.nomeArq}" removida`,
    detalhe: { midiaId, rdoId: midia.rdoId },
  })

  return NextResponse.json({ ok: true })
}
