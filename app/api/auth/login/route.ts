// src/api/auth/login/route.ts
// POST /api/auth/login

import { LogCategoria, LogNivel, TenantStatus, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import {
  verificarSenha,
  signToken,
} from '@/lib/auth'
const MAX_TENTATIVAS = 5      // bloqueio temporário após N falhas
const BLOQUIO_MINUTOS = 30

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { email?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { email, senha } = body

  if (!email || !senha) {
    return NextResponse.json(
      { erro: 'E-mail e senha são obrigatórios.' },
      { status: 400 },
    )
  }

  // Busca usuário + tenant
  const usuario = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase().trim() },
    include: {
      tenant: {
        select: {
          id:       true,
          nome:     true,
          status:   true,
          limiteRdosMes: true,
          limiteUsuarios: true,
          limiteProjetos: true,
        },
      },
    },
  })

  // Contagem de tentativas recentes para este IP (últimos 30 min)
  const tentativasRecentes = await prisma.logAuditoria.count({
    where: {
      ipAddress,
      categoria: LogCategoria.LOGIN,
      nivel:     LogNivel.AVISO,
      criadoEm:  {
        gte: new Date(Date.now() - BLOQUIO_MINUTOS * 60 * 1000),
      },
    },
  })

  if (tentativasRecentes >= MAX_TENTATIVAS) {
    await registrarLog({
      tenantId:   usuario?.tenantId,
      usuarioId:  usuario?.id,
      nivel:      LogNivel.CRITICO,
      categoria:  LogCategoria.LOGIN,
      mensagem:   `Bloqueio temporário: ${tentativasRecentes} tentativas falhas em ${BLOQUIO_MINUTOS}min`,
      detalhe:    { email, ip: ipAddress },
      ipAddress,
      userAgent,
    })

    return NextResponse.json(
      {
        erro: `Muitas tentativas. Tente novamente em ${BLOQUIO_MINUTOS} minutos.`,
      },
      { status: 429 },
    )
  }

  // Usuário não existe ou sem senha (convite pendente)
  if (!usuario || !usuario.senha) {
    await registrarLog({
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Tentativa de login com e-mail não encontrado: ${email}`,
      detalhe:   { email },
      ipAddress,
      userAgent,
    })
    // Mensagem genérica — não revela se o e-mail existe
    return NextResponse.json(
      { erro: 'E-mail ou senha incorretos.' },
      { status: 401 },
    )
  }

  // Verifica status do tenant
  if (usuario.tenant.status === TenantStatus.SUSPENSO) {
    return NextResponse.json(
      { erro: 'Acesso suspenso. Entre em contato com o suporte.' },
      { status: 403 },
    )
  }

  if (usuario.tenant.status === TenantStatus.AGUARDANDO) {
    return NextResponse.json(
      { erro: 'Empresa aguardando ativação. Em breve você receberá um e-mail.' },
      { status: 403 },
    )
  }

  // Verifica status do usuário
  if (usuario.status !== UsuarioStatus.ATIVO) {
    return NextResponse.json(
      { erro: 'Usuário inativo. Contate o administrador da sua empresa.' },
      { status: 403 },
    )
  }

  // Verifica senha
  const senhaCorreta = await verificarSenha(senha, usuario.senha)

  if (!senhaCorreta) {
    await registrarLog({
      tenantId:  usuario.tenantId,
      usuarioId: usuario.id,
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Senha incorreta para ${email} (tentativa ${tentativasRecentes + 1})`,
      detalhe:   { email, tentativa: tentativasRecentes + 1 },
      ipAddress,
      userAgent,
    })

    return NextResponse.json(
      { erro: 'E-mail ou senha incorretos.' },
      { status: 401 },
    )
  }

  // Atualiza último acesso
  await prisma.usuario.update({
    where: { id: usuario.id },
    data:  { ultimoAcessoEm: new Date() },
  })

  // Log de login bem-sucedido
  await registrarLog({
    tenantId:  usuario.tenantId,
    usuarioId: usuario.id,
    nivel:     LogNivel.INFO,
    categoria: LogCategoria.LOGIN,
    mensagem:  `Login realizado por ${usuario.nome}`,
    ipAddress,
    userAgent,
  })

  // Gera token
  const token = signToken({
    usuarioId: usuario.id,
    tenantId:  usuario.tenantId,
    perfil:    usuario.perfil,
  })

  return NextResponse.json({
    token,
    usuario: {
      id:       usuario.id,
      nome:     usuario.nome,
      email:    usuario.email,
      funcao:   usuario.funcao,
      perfil:   usuario.perfil,
      permEmitirRdo: usuario.permEmitirRdo, permAprovarRdo: usuario.permAprovarRdo,
      permGerenciarProjetos: usuario.permGerenciarProjetos,
      permGerenciarEquipe: usuario.permGerenciarEquipe, permVerRelatorios: usuario.permVerRelatorios,
      permGerenciarTarefas: usuario.permGerenciarTarefas,
      avatarUrl: usuario.avatarUrl,
    },
    tenant: {
      id:   usuario.tenant.id,
      nome: usuario.tenant.nome,
    },
  })
}
