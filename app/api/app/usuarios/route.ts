// src/api/app/usuarios/route.ts
// GET  /api/app/usuarios  — listar usuários do tenant
// POST /api/app/usuarios  — convidar por e-mail OU cadastrar direto com senha inicial

import { LogCategoria, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'
import { enviarEmailSeguro, enviarConviteUsuario } from '@/lib/email'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe, hashSenha } from '@/lib/auth'
import { addDays } from 'date-fns'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — anotados aqui localmente com a forma dos `select` abaixo.
type UsuarioListado = {
  id: string; nome: string; email: string; funcao: string | null
  perfil: UsuarioPerfil
  permEmitirRdo: boolean; permAprovarRdo: boolean
  permGerenciarProjetos: boolean; permGerenciarEquipe: boolean; permVerRelatorios: boolean
  permGerenciarTarefas: boolean
  status: UsuarioStatus
  ultimoAcessoEm: Date | null; criadoEm: Date
  _count: { projetoAcessos: number }
}
type ConviteListado = {
  id: string; email: string; funcao: string | null
  perfil: UsuarioPerfil
  permEmitirRdo: boolean; permAprovarRdo: boolean
  permGerenciarProjetos: boolean; permGerenciarEquipe: boolean; permVerRelatorios: boolean
  permGerenciarTarefas: boolean
  criadoEm: Date; expiradoEm: Date
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  const [usuarios, convites]: [UsuarioListado[], ConviteListado[]] = await Promise.all([
    prisma.usuario.findMany({
      where:   { tenantId },
      select: {
        id:            true,
        nome:          true,
        email:         true,
        funcao:        true,
        perfil:        true,
        permEmitirRdo: true, permAprovarRdo: true,
        permGerenciarProjetos: true, permGerenciarEquipe: true, permVerRelatorios: true,
        permGerenciarTarefas: true,
        status:        true,
        ultimoAcessoEm: true,
        criadoEm:      true,
        _count: { select: { projetoAcessos: true } },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.convite.findMany({
      where: {
        tenantId,
        aceitoEm:   null,
        expiradoEm: { gt: new Date() },
      },
      select: {
        id:          true,
        email:       true,
        funcao:      true,
        perfil:      true,
        permEmitirRdo: true, permAprovarRdo: true,
        permGerenciarProjetos: true, permGerenciarEquipe: true, permVerRelatorios: true,
        permGerenciarTarefas: true,
        criadoEm:    true,
        expiradoEm:  true,
      },
      orderBy: { criadoEm: 'desc' },
    }),
  ])

  // Verifica uso do plano
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { limiteUsuarios: true },
  })

  return NextResponse.json({
    usuarios,
    convites,
    uso: {
      atual:  usuarios.filter((u) => u.status === UsuarioStatus.ATIVO).length,
      limite: tenant?.limiteUsuarios ?? 999,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json(
      { erro: 'Sem permissão para convidar usuários.' },
      { status: 403 },
    )
  }

  let body: {
    email?: string; perfil?: string; nome?: string; senha?: string; funcao?: string
    permEmitirRdo?: boolean; permAprovarRdo?: boolean
    permGerenciarProjetos?: boolean; permGerenciarEquipe?: boolean; permVerRelatorios?: boolean
    permGerenciarTarefas?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.email || !body.perfil) {
    return NextResponse.json(
      { erro: 'E-mail e perfil são obrigatórios.' },
      { status: 400 },
    )
  }

  // Valida perfil
  const perfilValido = Object.values(UsuarioPerfil).includes(
    body.perfil as UsuarioPerfil,
  )
  if (!perfilValido) {
    return NextResponse.json({ erro: 'Perfil inválido.' }, { status: 400 })
  }

  if (body.senha && !body.nome) {
    return NextResponse.json({ erro: 'Nome é obrigatório ao cadastrar com senha inicial.' }, { status: 400 })
  }
  if (body.senha && body.senha.length < 8) {
    return NextResponse.json({ erro: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  const flags = {
    permEmitirRdo:         !!body.permEmitirRdo,
    permAprovarRdo:        !!body.permAprovarRdo,
    permGerenciarProjetos: !!body.permGerenciarProjetos,
    permGerenciarEquipe:   !!body.permGerenciarEquipe,
    permVerRelatorios:     !!body.permVerRelatorios,
    permGerenciarTarefas:  !!body.permGerenciarTarefas,
  }
  const dadosPerfil = {
    perfil: body.perfil as UsuarioPerfil,
    ...(body.perfil === UsuarioPerfil.PERSONALIZADO ? flags : {
      permEmitirRdo: false, permAprovarRdo: false,
      permGerenciarProjetos: false, permGerenciarEquipe: false, permVerRelatorios: false,
      permGerenciarTarefas: false,
    }),
  }

  // Verifica limite de usuários
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { limiteUsuarios: true },
  })

  if (tenant && tenant.limiteUsuarios > 0) {
    const ativos = await prisma.usuario.count({
      where: { tenantId, status: 'ATIVO' },
    })
    if (ativos >= tenant.limiteUsuarios) {
      return NextResponse.json(
        {
          erro: `Limite de ${tenant.limiteUsuarios} usuários atingido.`,
          codigo: 'LIMITE_USUARIO',
        },
        { status: 402 },
      )
    }
  }

  // Verifica se já existe usuário com esse e-mail no tenant
  const existe = await prisma.usuario.findFirst({
    where: { tenantId, email: body.email.toLowerCase() },
  })
  if (existe) {
    return NextResponse.json(
      { erro: 'Já existe um usuário com esse e-mail.' },
      { status: 409 },
    )
  }

  // ── Cadastro direto com senha inicial — pula o convite por e-mail, igual
  // ao fluxo do super-admin ao criar uma empresa (app/api/admin/tenants) ──
  if (body.senha) {
    const senhaHash = await hashSenha(body.senha)

    const usuario = await prisma.usuario.create({
      data: {
        tenantId,
        nome:  body.nome!.trim(),
        email: body.email.toLowerCase(),
        senha: senhaHash,
        funcao: body.funcao?.trim() || null,
        status: UsuarioStatus.ATIVO,
        ...dadosPerfil,
      },
    })

    await registrarLog({
      tenantId,
      usuarioId,
      categoria: LogCategoria.USUARIO,
      mensagem:  `Usuário "${usuario.nome}" cadastrado com senha inicial (${body.perfil})`,
      detalhe:   { email: body.email, perfil: body.perfil },
      ipAddress,
      userAgent,
    })

    return NextResponse.json(
      {
        ok: true,
        usuario: {
          id: usuario.id, nome: usuario.nome, email: usuario.email, funcao: usuario.funcao, perfil: usuario.perfil,
        },
        senhaDefinida: true,
      },
      { status: 201 },
    )
  }

  // ── Convite por e-mail (fluxo original) ──────────────────────────────
  // Reaproveita convite pendente para o mesmo e-mail no tenant, se existir (renova prazo/perfil);
  // senão cria um novo. Sem índice único no schema, então fazemos findFirst + create/update.
  const conviteExistente = await prisma.convite.findFirst({
    where: { tenantId, email: body.email.toLowerCase(), aceitoEm: null },
  })

  const funcaoConvite = body.funcao?.trim() || null
  const convite = conviteExistente
    ? await prisma.convite.update({
        where: { id: conviteExistente.id },
        data:  { ...dadosPerfil, funcao: funcaoConvite, expiradoEm: addDays(new Date(), 7) },
      })
    : await prisma.convite.create({
        data: {
          tenantId,
          email: body.email.toLowerCase(),
          funcao: funcaoConvite,
          ...dadosPerfil,
          expiradoEm: addDays(new Date(), 7),
        },
      })

  // Busca nome da empresa para o e-mail
  const tenantInfo = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { nome: true },
  })

  // Envia e-mail de convite com link de aceite
  await enviarEmailSeguro(() => enviarConviteUsuario({
    email:       convite.email,
    nomeEmpresa: tenantInfo?.nome ?? 'sua empresa',
    perfil:      convite.perfil,
    token:       convite.token,
    expiradoEm:  convite.expiradoEm,
  }))

  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  `Convite enviado para ${body.email} (${body.perfil})`,
    detalhe:   { email: body.email, perfil: body.perfil },
    ipAddress,
    userAgent,
  })

  return NextResponse.json(
    {
      ok:      true,
      convite: {
        id:         convite.id,
        email:      convite.email,
        funcao:     convite.funcao,
        perfil:     convite.perfil,
        permEmitirRdo: convite.permEmitirRdo, permAprovarRdo: convite.permAprovarRdo,
        permGerenciarProjetos: convite.permGerenciarProjetos,
        permGerenciarEquipe: convite.permGerenciarEquipe, permVerRelatorios: convite.permVerRelatorios,
        permGerenciarTarefas: convite.permGerenciarTarefas,
        expiradoEm: convite.expiradoEm,
      },
      senhaDefinida: false,
    },
    { status: 201 },
  )
}
