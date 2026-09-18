// src/api/app/perfil/route.ts
// GET   /api/app/perfil — dados da conta do usuário logado
// PATCH /api/app/perfil — atualizar nome/foto da própria conta (autoatendimento,
//                         sem exigir permissão de gestão de usuários)

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { LogCategoria } from '@/lib/prisma-enums'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId, tenantId } = auth.ctx

  const usuario = await prisma.usuario.findFirst({
    where:  { id: usuarioId, tenantId },
    select: {
      id: true, nome: true, email: true, avatarUrl: true, perfil: true, funcao: true,
      permEmitirRdo: true, permAprovarRdo: true,
      permGerenciarProjetos: true, permGerenciarEquipe: true, permVerRelatorios: true,
      permGerenciarTarefas: true,
      criadoEm: true, ultimoAcessoEm: true,
    },
  })
  if (!usuario) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(usuario)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId, tenantId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { nome?: string; avatarUrl?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { nome, avatarUrl } = body

  if (nome != null && !nome.trim()) {
    return NextResponse.json({ erro: 'Nome não pode ficar vazio.' }, { status: 400 })
  }

  const atualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      ...(nome != null && { nome: nome.trim() }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
    },
    select: { id: true, nome: true, email: true, avatarUrl: true, perfil: true },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  'Perfil atualizado pelo próprio usuário',
    detalhe:   body,
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}
