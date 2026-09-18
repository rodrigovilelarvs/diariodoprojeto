// src/api/auth/convite/route.ts
// GET  /api/auth/convite?token=...  — consultar dados do convite (para exibir antes de aceitar)
// POST /api/auth/convite  — aceitar convite e definir senha

import { LogCategoria, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { hashSenha, signToken } from '@/lib/auth'

const PERFIL_L: Record<string, string> = {
  ADMIN: 'Administrador', PERSONALIZADO: 'Personalizado',
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ erro: 'Token não informado.' }, { status: 400 })
  }

  const convite = await prisma.convite.findUnique({
    where:   { token },
    include: { tenant: { select: { nome: true } } },
  })

  if (!convite) {
    return NextResponse.json({ erro: 'Convite não encontrado ou já utilizado.' }, { status: 404 })
  }
  if (convite.aceitoEm) {
    return NextResponse.json({ erro: 'Este convite já foi aceito.' }, { status: 400 })
  }
  if (convite.expiradoEm < new Date()) {
    return NextResponse.json({ erro: 'Convite expirado. Solicite um novo convite ao administrador.' }, { status: 400 })
  }

  return NextResponse.json({
    email:       convite.email,
    nomeEmpresa: convite.tenant.nome,
    perfil:      convite.perfil,
    perfilLabel: PERFIL_L[convite.perfil] ?? convite.perfil,
    expiradoEm:  convite.expiradoEm,
  })
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { token?: string; nome?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { token, nome, senha } = body

  if (!token || !nome || !senha) {
    return NextResponse.json(
      { erro: 'Token, nome e senha são obrigatórios.' },
      { status: 400 },
    )
  }

  if (senha.length < 8) {
    return NextResponse.json(
      { erro: 'Senha deve ter no mínimo 8 caracteres.' },
      { status: 400 },
    )
  }

  // Busca o convite
  const convite = await prisma.convite.findUnique({
    where:   { token },
    include: { tenant: true },
  })

  if (!convite) {
    return NextResponse.json(
      { erro: 'Convite não encontrado ou já utilizado.' },
      { status: 404 },
    )
  }

  if (convite.aceitoEm) {
    return NextResponse.json(
      { erro: 'Este convite já foi aceito.' },
      { status: 400 },
    )
  }

  if (convite.expiradoEm < new Date()) {
    return NextResponse.json(
      { erro: 'Convite expirado. Solicite um novo convite ao administrador.' },
      { status: 400 },
    )
  }

  // Cria ou ativa o usuário
  const senhaHash = await hashSenha(senha)

  const flagsConvite = {
    perfil:                convite.perfil,
    funcao:                convite.funcao,
    permEmitirRdo:         convite.permEmitirRdo,
    permAprovarRdo:        convite.permAprovarRdo,
    permGerenciarProjetos: convite.permGerenciarProjetos,
    permGerenciarEquipe:   convite.permGerenciarEquipe,
    permVerRelatorios:     convite.permVerRelatorios,
    permGerenciarTarefas:  convite.permGerenciarTarefas,
  }

  const usuario = await prisma.usuario.upsert({
    where:  { tenantId_email: { tenantId: convite.tenantId, email: convite.email } },
    update: { nome, senha: senhaHash, status: UsuarioStatus.ATIVO, ...flagsConvite },
    create: {
      tenantId: convite.tenantId,
      nome,
      email:    convite.email,
      senha:    senhaHash,
      status:   UsuarioStatus.ATIVO,
      ...flagsConvite,
    },
  })

  // Marca convite como aceito
  await prisma.convite.update({
    where: { id: convite.id },
    data:  { aceitoEm: new Date() },
  })

  await registrarLog({
    tenantId:  convite.tenantId,
    usuarioId: usuario.id,
    categoria: LogCategoria.USUARIO,
    mensagem:  `Convite aceito por ${nome} (${convite.email})`,
    ipAddress,
    userAgent,
  })

  const jwtToken = signToken({
    usuarioId: usuario.id,
    tenantId:  convite.tenantId,
    perfil:    usuario.perfil,
  })

  return NextResponse.json({
    token: jwtToken,
    usuario: {
      id:     usuario.id,
      nome:   usuario.nome,
      email:  usuario.email,
      funcao: usuario.funcao,
      perfil: usuario.perfil,
      permEmitirRdo: usuario.permEmitirRdo, permAprovarRdo: usuario.permAprovarRdo,
      permGerenciarProjetos: usuario.permGerenciarProjetos,
      permGerenciarEquipe: usuario.permGerenciarEquipe, permVerRelatorios: usuario.permVerRelatorios,
      permGerenciarTarefas: usuario.permGerenciarTarefas,
    },
    tenant: {
      id:   convite.tenant.id,
      nome: convite.tenant.nome,
    },
  })
}
