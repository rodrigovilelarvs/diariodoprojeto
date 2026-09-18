// src/api/app/projetos/:id/assinaturas/route.ts
// GET   /api/app/projetos/:id/assinaturas — configuração atual + usuários elegíveis
// PATCH /api/app/projetos/:id/assinaturas — define o modo (aberta/definida) e os até 3 assinantes

import { LogCategoria, ProjetoAssinaturaModo, UsuarioPerfil } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeGerenciarProjeto } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

const SELECT_ASSINANTE = { id: true, nome: true, email: true, perfil: true } as const

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const projetoId = (await params).id

  const projeto = await prisma.projeto.findFirst({
    where:   { id: projetoId, tenantId },
    include: {
      assinante1: { select: SELECT_ASSINANTE },
      assinante2: { select: SELECT_ASSINANTE },
      assinante3: { select: SELECT_ASSINANTE },
    },
  })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acesso = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(acesso)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar as assinaturas deste projeto.' }, { status: 403 })
  }

  // Elegível a assinar: administrador, ou quem tem permissão de aprovar RDO
  const usuariosElegiveis = await prisma.usuario.findMany({
    where: {
      tenantId, status: 'ATIVO',
      OR: [{ perfil: UsuarioPerfil.ADMIN }, { permAprovarRdo: true }],
    },
    select: SELECT_ASSINANTE,
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json({
    assinaturaModo: projeto.assinaturaModo,
    assinante1: projeto.assinante1,
    assinante2: projeto.assinante2,
    assinante3: projeto.assinante3,
    usuariosElegiveis,
  })
}

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

  const acesso = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(acesso)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar as assinaturas deste projeto.' }, { status: 403 })
  }

  let body: {
    assinaturaModo?: string
    assinante1Id?:   string | null
    assinante2Id?:   string | null
    assinante3Id?:   string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (body.assinaturaModo != null && !Object.values(ProjetoAssinaturaModo).includes(body.assinaturaModo as ProjetoAssinaturaModo)) {
    return NextResponse.json({ erro: 'Modo de assinatura inválido.' }, { status: 400 })
  }

  const ids = [body.assinante1Id, body.assinante2Id, body.assinante3Id].filter((v): v is string => !!v)
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ erro: 'Cada assinante só pode ser escolhido uma vez.' }, { status: 400 })
  }
  if (ids.length > 0) {
    const encontrados = await prisma.usuario.count({ where: { id: { in: ids }, tenantId } })
    if (encontrados !== ids.length) {
      return NextResponse.json({ erro: 'Um ou mais assinantes selecionados são inválidos.' }, { status: 400 })
    }
  }

  const atualizado = await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      ...(body.assinaturaModo != null && { assinaturaModo: body.assinaturaModo as ProjetoAssinaturaModo }),
      ...(body.assinante1Id !== undefined && { assinante1Id: body.assinante1Id || null }),
      ...(body.assinante2Id !== undefined && { assinante2Id: body.assinante2Id || null }),
      ...(body.assinante3Id !== undefined && { assinante3Id: body.assinante3Id || null }),
    },
    include: {
      assinante1: { select: SELECT_ASSINANTE },
      assinante2: { select: SELECT_ASSINANTE },
      assinante3: { select: SELECT_ASSINANTE },
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Configuração de assinaturas do projeto "${projeto.nome}" alterada`,
    detalhe:   { projetoId, ...body },
    ipAddress, userAgent,
  })

  return NextResponse.json({
    assinaturaModo: atualizado.assinaturaModo,
    assinante1: atualizado.assinante1,
    assinante2: atualizado.assinante2,
    assinante3: atualizado.assinante3,
  })
}
