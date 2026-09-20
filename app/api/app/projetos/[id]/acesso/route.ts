// src/api/app/projetos/:id/acesso/route.ts
// GET  /api/app/projetos/:id/acesso — lista o acesso configurado + usuários do tenant
// POST /api/app/projetos/:id/acesso — adiciona/atualiza o nível de acesso de um usuário

import { LogCategoria, ProjetoAcessoNivel } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeGerenciarProjeto } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const projetoId = (await params).id

  const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, tenantId } })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acesso = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeGerenciarProjeto(auth.ctx, acesso)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar o acesso deste projeto.' }, { status: 403 })
  }

  const [acessos, usuarios] = await Promise.all([
    prisma.projetoAcesso.findMany({
      where:   { projetoId },
      include: { usuario: { select: { id: true, nome: true, email: true, perfil: true, status: true } } },
      orderBy: { criadoEm: 'asc' },
    }),
    prisma.usuario.findMany({
      where:  { tenantId, status: 'ATIVO' },
      select: { id: true, nome: true, email: true, perfil: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  return NextResponse.json({ acessos, usuarios })
}

export async function POST(req: NextRequest, { params }: Params) {
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
  if (!podeGerenciarProjeto(auth.ctx, acesso)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar o acesso deste projeto.' }, { status: 403 })
  }

  let body: { usuarioId?: string; nivel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.usuarioId) {
    return NextResponse.json({ erro: 'usuarioId é obrigatório.' }, { status: 400 })
  }
  if (!body.nivel || !Object.values(ProjetoAcessoNivel).includes(body.nivel as ProjetoAcessoNivel)) {
    return NextResponse.json({ erro: 'Nível inválido.' }, { status: 400 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: body.usuarioId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const registro = await prisma.projetoAcesso.upsert({
    where:  { projetoId_usuarioId: { projetoId, usuarioId: body.usuarioId } },
    update: { nivel: body.nivel as ProjetoAcessoNivel },
    create: { projetoId, usuarioId: body.usuarioId, nivel: body.nivel as ProjetoAcessoNivel },
    include: { usuario: { select: { id: true, nome: true, email: true, perfil: true, status: true } } },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Acesso de "${alvo.nome}" ao projeto "${projeto.nome}" definido como ${body.nivel}`,
    detalhe:   { projetoId, alvoId: alvo.id, nivel: body.nivel },
    ipAddress, userAgent,
  })

  return NextResponse.json(registro)
}
