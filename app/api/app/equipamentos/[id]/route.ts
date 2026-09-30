// src/api/app/equipamentos/[id]/route.ts
// PATCH  /api/app/equipamentos/:id — editar nome/tipo do equipamento
// DELETE /api/app/equipamentos/:id — remover equipamento do catálogo (RDOs que
//        já o usam mantêm o nome gravado na própria linha — não são afetados)

import { EquipamentoTipo } from '@/lib/prisma-enums'
import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo } from '@/lib/auth'
import { LogCategoria } from '@/lib/prisma-enums'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const equipamentoId = (await params).id

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const equipamento = await prisma.equipamentoCadastro.findFirst({ where: { id: equipamentoId, tenantId } })
  if (!equipamento) {
    return NextResponse.json({ erro: 'Equipamento não encontrado.' }, { status: 404 })
  }

  let body: { nome?: string; tipo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  if (body.nome != null && !nome) {
    return NextResponse.json({ erro: 'Nome do equipamento é obrigatório.' }, { status: 400 })
  }
  if (body.tipo != null && !Object.values(EquipamentoTipo).includes(body.tipo as EquipamentoTipo)) {
    return NextResponse.json({ erro: 'Tipo inválido.' }, { status: 400 })
  }

  if (nome && nome !== equipamento.nome) {
    const conflito = await prisma.equipamentoCadastro.findFirst({ where: { tenantId, nome, id: { not: equipamentoId } } })
    if (conflito) {
      return NextResponse.json({ erro: 'Já existe um equipamento com esse nome.' }, { status: 409 })
    }
  }

  const atualizado = await prisma.equipamentoCadastro.update({
    where: { id: equipamentoId },
    data: {
      ...(nome && { nome }),
      ...(body.tipo != null && { tipo: body.tipo as EquipamentoTipo }),
    },
    select: { id: true, nome: true, tipo: true },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Equipamento "${equipamento.nome}" editado`,
    detalhe:   { equipamentoId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const equipamentoId = (await params).id

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const equipamento = await prisma.equipamentoCadastro.findFirst({ where: { id: equipamentoId, tenantId } })
  if (!equipamento) {
    return NextResponse.json({ erro: 'Equipamento não encontrado.' }, { status: 404 })
  }

  await prisma.equipamentoCadastro.delete({ where: { id: equipamentoId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Equipamento "${equipamento.nome}" removido do catálogo`,
    detalhe:   { equipamentoId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
