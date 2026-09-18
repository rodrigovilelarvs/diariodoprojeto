// src/api/app/usuarios/:id/acessos/route.ts
// GET  /api/app/usuarios/:id/acessos — projetos do tenant + nível de acesso deste usuário em cada um
// POST /api/app/usuarios/:id/acessos — define (cria/atualiza) o nível de acesso do usuário a um projeto
//
// Visão inversa de /api/app/projetos/:id/acesso — aqui o ponto de partida é o
// usuário, não o projeto (pra gerenciar tudo direto da tela de Usuários).

import { LogCategoria, ProjetoAcessoNivel } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx
  const alvoId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const [projetos, todosAcessos, meusAcessos] = await Promise.all([
    prisma.projeto.findMany({
      where:   { tenantId },
      select:  { id: true, nome: true, cor: true, grupo: true, status: true },
      orderBy: { nome: 'asc' },
    }),
    // Quais projetos têm ALGUMA restrição configurada (por qualquer pessoa) —
    // um projeto sem nenhuma linha aqui é visível a todo o time por padrão.
    prisma.projetoAcesso.findMany({
      where:  { projeto: { tenantId } },
      select: { projetoId: true },
    }),
    prisma.projetoAcesso.findMany({
      where:  { usuarioId: alvoId, projeto: { tenantId } },
      select: { projetoId: true, nivel: true },
    }),
  ])

  const restritos = new Set(todosAcessos.map((a: any) => a.projetoId as string))
  const mapaMeu   = new Map(meusAcessos.map((a: any) => [a.projetoId as string, a.nivel as string]))

  return NextResponse.json({
    projetos: projetos.map((p: any) => ({
      ...p,
      restrito: restritos.has(p.id),
      nivel:    mapaMeu.get(p.id) ?? null,
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const alvoId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  let body: { projetoId?: string; nivel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.projetoId) {
    return NextResponse.json({ erro: 'projetoId é obrigatório.' }, { status: 400 })
  }
  if (!body.nivel || !Object.values(ProjetoAcessoNivel).includes(body.nivel as ProjetoAcessoNivel)) {
    return NextResponse.json({ erro: 'Nível inválido.' }, { status: 400 })
  }

  const projeto = await prisma.projeto.findFirst({ where: { id: body.projetoId, tenantId } })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const registro = await prisma.projetoAcesso.upsert({
    where:  { projetoId_usuarioId: { projetoId: body.projetoId, usuarioId: alvoId } },
    update: { nivel: body.nivel as ProjetoAcessoNivel },
    create: { projetoId: body.projetoId, usuarioId: alvoId, nivel: body.nivel as ProjetoAcessoNivel },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Acesso de "${alvo.nome}" ao projeto "${projeto.nome}" definido como ${body.nivel}`,
    detalhe:   { alvoId, projetoId: body.projetoId, nivel: body.nivel },
    ipAddress, userAgent,
  })

  return NextResponse.json(registro)
}
