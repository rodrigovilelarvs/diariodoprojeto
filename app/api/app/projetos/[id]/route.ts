// src/api/app/projetos/[id]/route.ts
// PATCH /api/app/projetos/:id — editar projeto (nome, grupo, status, datas, etc.)

import { LogCategoria, ProjetoStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeGerenciarProjeto } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const projetoId = (await params).id

  const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, tenantId } })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(auth.ctx, acessoProjeto)) {
    return NextResponse.json({ erro: 'Sem permissão para editar projetos.' }, { status: 403 })
  }

  let body: {
    nome?:               string
    descricao?:          string
    pedidoCompraContrato?: string
    empresaContratada?:  string
    grupo?:              string
    status?:             string
    fotoUrl?:            string
    dataInicioContrato?: string
    dataFimContrato?:    string
    gestorId?:           string
    cor?:                string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (body.nome != null && !body.nome.trim()) {
    return NextResponse.json({ erro: 'Nome não pode ficar vazio.' }, { status: 400 })
  }

  if (body.status != null && !Object.values(ProjetoStatus).includes(body.status as ProjetoStatus)) {
    return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
  }

  const atualizado = await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      ...(body.nome != null && { nome: body.nome }),
      ...(body.descricao != null && { descricao: body.descricao }),
      ...(body.pedidoCompraContrato != null && { pedidoCompraContrato: body.pedidoCompraContrato || null }),
      ...(body.empresaContratada != null && { empresaContratada: body.empresaContratada || null }),
      ...(body.grupo != null && { grupo: body.grupo || null }),
      ...(body.fotoUrl != null && { fotoUrl: body.fotoUrl || null }),
      ...(body.status != null && { status: body.status as ProjetoStatus }),
      ...(body.dataInicioContrato != null && { dataInicioContrato: body.dataInicioContrato ? new Date(body.dataInicioContrato) : null }),
      ...(body.dataFimContrato != null && { dataFimContrato: body.dataFimContrato ? new Date(body.dataFimContrato) : null }),
      ...(body.gestorId != null && { gestorId: body.gestorId || null }),
      ...(body.cor != null && { cor: body.cor }),
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Projeto "${projeto.nome}" editado`,
    detalhe:   { projetoId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}

// DELETE /api/app/projetos/:id — exclui o projeto e todo o conteúdo vinculado
// (RDOs, etapas/atividades, ocorrências, comentários, mídias, assinaturas, acessos — via cascade no banco)
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const projetoId = (await params).id

  const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, tenantId } })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(auth.ctx, acessoProjeto)) {
    return NextResponse.json({ erro: 'Sem permissão para excluir projetos.' }, { status: 403 })
  }

  await prisma.projeto.delete({ where: { id: projetoId } })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Projeto "${projeto.nome}" excluído`,
    detalhe:   { projetoId },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
