// src/api/app/funcoes/[id]/route.ts
// PATCH  /api/app/funcoes/:id — editar nome/categoria da função
// DELETE /api/app/funcoes/:id — remover função do catálogo (RDOs que já a usam
//        mantêm o nome/categoria gravados na própria linha — não são afetados)

import { MaoDeObraCategoria } from '@/lib/prisma-enums'
import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, podeGerenciarProjetos } from '@/lib/auth'
import { numeroOuNull, limparCampoCadastro, nomeComposto, mesmaFuncao } from '@/lib/homem-hora'
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

  let body: { nome?: string; pessoa?: string; funcao?: string; categoria?: string; valorHora?: number | string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  // Projetos H/H: Nome e Função separados (o texto exibido é recomposto)
  const hh = body.pessoa !== undefined || body.funcao !== undefined
  const pessoa = hh ? limparCampoCadastro(body.pessoa ?? funcao.pessoa) : null
  const funcaoSimples = hh ? limparCampoCadastro(body.funcao ?? funcao.funcao) : null
  if (hh && (!pessoa || !funcaoSimples)) {
    return NextResponse.json({ erro: 'Informe o nome e a função.' }, { status: 400 })
  }
  const nome = hh ? nomeComposto(pessoa!, funcaoSimples!) : body.nome?.trim()
  if (body.nome != null && !hh && !nome) {
    return NextResponse.json({ erro: 'Nome da função é obrigatório.' }, { status: 400 })
  }
  if (body.categoria != null && !Object.values(MaoDeObraCategoria).includes(body.categoria as MaoDeObraCategoria)) {
    return NextResponse.json({ erro: 'Categoria inválida.' }, { status: 400 })
  }

  // valor da hora (opcional; vazio apaga): só quem gerencia projetos altera
  const mudaValor = body.valorHora !== undefined
  if (mudaValor && !podeGerenciarProjetos(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para alterar o valor da hora.' }, { status: 403 })
  }
  const valorHora = numeroOuNull(body.valorHora)
  if (valorHora != null && valorHora < 0) {
    return NextResponse.json({ erro: 'O valor da hora não pode ser negativo.' }, { status: 400 })
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
      ...(hh && { pessoa, funcao: funcaoSimples }),
      ...(body.categoria != null && { categoria: body.categoria as MaoDeObraCategoria }),
      ...(mudaValor && { valorHora }),
    },
    select: { id: true, nome: true, categoria: true, pessoa: true, funcao: true },
  })

  // O valor da hora é da função: vale para todos os cadastros com a mesma função
  const funcaoDoValor = atualizada.funcao as string | null
  if (mudaValor && funcaoDoValor) {
    const todos: Array<{ id: string; funcao: string | null }> = await prisma.funcaoCadastro.findMany({ where: { tenantId }, select: { id: true, funcao: true } })
    for (const f of todos) {
      if (f.id !== funcaoId && mesmaFuncao(f.funcao, funcaoDoValor)) await prisma.funcaoCadastro.update({ where: { id: f.id }, data: { valorHora } })
    }
  }

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
