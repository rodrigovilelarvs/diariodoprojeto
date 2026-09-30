// src/api/app/funcoes/[id]/route.ts
// PATCH  /api/app/funcoes/:id — editar nome/categoria da função
// DELETE /api/app/funcoes/:id — remover função do catálogo (RDOs que já a usam
//        mantêm o nome/categoria gravados na própria linha — não são afetados)

import { MaoDeObraCategoria } from '@/lib/prisma-enums'
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
  const funcaoId = (await params).id

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const funcao = await prisma.funcaoCadastro.findFirst({ where: { id: funcaoId, tenantId } })
  if (!funcao) {
    return NextResponse.json({ erro: 'Função não encontrada.' }, { status: 404 })
  }

  let body: { nome?: string; categoria?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  if (body.nome != null && !nome) {
    return NextResponse.json({ erro: 'Nome da função é obrigatório.' }, { status: 400 })
  }
  if (body.categoria != null && !Object.values(MaoDeObraCategoria).includes(body.categoria as MaoDeObraCategoria)) {
    return NextResponse.json({ erro: 'Categoria inválida.' }, { status: 400 })
  }

  if (nome && nome !== funcao.nome) {
    const conflito = await prisma.funcaoCadastro.findFirst({ where: { tenantId, nome, id: { not: funcaoId } } })
    if (conflito) {
      return NextResponse.json({ erro: 'Já existe uma função com esse nome.' }, { status: 409 })
    }
  }

  const atualizada = await prisma.funcaoCadastro.update({
    where: { id: funcaoId },
    data: {
      ...(nome && { nome }),
      ...(body.categoria != null && { categoria: body.categoria as MaoDeObraCategoria }),
    },
    select: { id: true, nome: true, categoria: true },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Função "${funcao.nome}" editada`,
    detalhe:   { funcaoId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizada)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const funcaoId = (await params).id

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const funcao = await prisma.funcaoCadastro.findFirst({ where: { id: funcaoId, tenantId } })
  if (!funcao) {
    return NextResponse.json({ erro: 'Função não encontrada.' }, { status: 404 })
  }

  await prisma.funcaoCadastro.delete({ where: { id: funcaoId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Função "${funcao.nome}" removida do catálogo`,
    detalhe:   { funcaoId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
