// src/api/app/usuarios/[id]/route.ts
// PATCH /api/app/usuarios/:id — editar nome/perfil ou ativar/desativar usuário

import { LogCategoria, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe, violacaoDeDelegacao } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const alvoId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const usuario = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!usuario) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  let body: {
    nome?: string; perfil?: string; status?: string; funcao?: string
    permEmitirRdo?: boolean; permAprovarRdo?: boolean
    permGerenciarProjetos?: boolean; permGerenciarEquipe?: boolean; permVerRelatorios?: boolean
    permGerenciarTarefas?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { nome, perfil: novoPerfil, status, funcao } = body

  if (novoPerfil != null) {
    const valido = Object.values(UsuarioPerfil).includes(novoPerfil as UsuarioPerfil)
    if (!valido) {
      return NextResponse.json({ erro: 'Perfil inválido.' }, { status: 400 })
    }
  }

  if (status != null) {
    if (!Object.values(UsuarioStatus).includes(status as UsuarioStatus)) {
      return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 })
    }
    if (alvoId === usuarioId && status !== UsuarioStatus.ATIVO) {
      return NextResponse.json({ erro: 'Você não pode desativar sua própria conta.' }, { status: 400 })
    }
  }

  const { permEmitirRdo, permAprovarRdo, permGerenciarProjetos, permGerenciarEquipe, permVerRelatorios, permGerenciarTarefas } = body

  const violacao = violacaoDeDelegacao(auth.ctx, {
    perfilAtualDoAlvo: usuario.perfil,
    flagsAtuais: usuario,
    novoPerfil,
    flags: { permEmitirRdo, permAprovarRdo, permGerenciarProjetos, permGerenciarEquipe, permVerRelatorios, permGerenciarTarefas },
  })
  if (violacao) {
    return NextResponse.json({ erro: violacao }, { status: 403 })
  }

  const atualizado = await prisma.usuario.update({
    where: { id: alvoId },
    data: {
      ...(nome != null && { nome: String(nome) }),
      ...(funcao != null && { funcao: funcao.trim() || null }),
      ...(novoPerfil != null && { perfil: novoPerfil as UsuarioPerfil }),
      ...(status != null && { status: status as UsuarioStatus }),
      ...(permEmitirRdo != null && { permEmitirRdo }),
      ...(permAprovarRdo != null && { permAprovarRdo }),
      ...(permGerenciarProjetos != null && { permGerenciarProjetos }),
      ...(permGerenciarEquipe != null && { permGerenciarEquipe }),
      ...(permVerRelatorios != null && { permVerRelatorios }),
      ...(permGerenciarTarefas != null && { permGerenciarTarefas }),
    },
    select: {
      id: true, nome: true, email: true, funcao: true, perfil: true,
      permEmitirRdo: true, permAprovarRdo: true,
      permGerenciarProjetos: true, permGerenciarEquipe: true, permVerRelatorios: true,
      permGerenciarTarefas: true,
      status: true, ultimoAcessoEm: true, criadoEm: true,
    },
  })

  const mensagem =
    status === UsuarioStatus.INATIVO ? `Usuário "${usuario.nome}" desativado` :
    status === UsuarioStatus.ATIVO && usuario.status === UsuarioStatus.INATIVO ? `Usuário "${usuario.nome}" reativado` :
    `Usuário "${usuario.nome}" atualizado`

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem,
    detalhe: { alvoId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}
