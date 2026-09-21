// src/api/auth/convite/route.ts
// GET  /api/auth/convite?token=...  — consultar dados do convite (para exibir antes de aceitar)
// POST /api/auth/convite  — aceitar convite e definir senha

import { LogCategoria, LogNivel, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { hashSenha, verificarSenha } from '@/lib/auth'
import { MAX_TENTATIVAS, falhasRecentesDoIp, respostaDeSessao } from '@/lib/contas'

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

  // A senha é uma só por e-mail: se ele já tem senha (em outra empresa), a tela
  // pede a senha atual em vez de criar uma nova
  const contaExistente = (await prisma.usuario.count({ where: { email: convite.email, senha: { not: null } } })) > 0

  return NextResponse.json({
    email:       convite.email,
    contaExistente,
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

  // Senha: uma só por e-mail. Se o e-mail já tem senha em outra empresa, quem
  // aceita precisa DIGITAR essa senha (prova que é a mesma pessoa, já que o
  // link do convite sozinho não pode trocar a senha de uma conta que já
  // existe) e a nova conta reaproveita a mesma credencial. Só e-mail novo cria senha.
  const existentes: Array<{ senha: string | null }> = await prisma.usuario.findMany({
    where:  { email: convite.email, senha: { not: null } },
    select: { senha: true },
  })

  let senhaHash: string
  if (existentes.length > 0) {
    if ((await falhasRecentesDoIp(ipAddress)) >= MAX_TENTATIVAS) {
      return NextResponse.json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 })
    }
    let confirmada: string | null = null
    for (const hash of new Set(existentes.map((e) => e.senha!))) {
      if (await verificarSenha(senha, hash)) { confirmada = hash; break }
    }
    if (!confirmada) {
      await registrarLog({
        tenantId:  convite.tenantId,
        nivel:     LogNivel.AVISO,
        categoria: LogCategoria.LOGIN,
        mensagem:  `Senha incorreta ao aceitar convite (${convite.email})`,
        ipAddress,
        userAgent,
      })
      return NextResponse.json(
        { erro: 'Senha incorreta. Use a senha que você já usa no Diário do Projeto (ou recupere-a em "Esqueci minha senha").' },
        { status: 401 },
      )
    }
    senhaHash = confirmada
  } else {
    if (senha.length < 8) {
      return NextResponse.json({ erro: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
    }
    senhaHash = await hashSenha(senha)
  }

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

  return NextResponse.json(respostaDeSessao(usuario, convite.tenant))
}
