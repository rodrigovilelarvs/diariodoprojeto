// src/api/auth/login/route.ts
// POST /api/auth/login
//
// A senha é uma só por e-mail (ver lib/contas.ts). O e-mail pode ter conta em
// mais de uma empresa: a senha é conferida em TODAS as contas dele, e
//   - se só uma empresa estiver disponível, entra direto;
//   - se houver mais de uma, responde { escolherEmpresa: true, empresas } e a
//     tela pede a escolha (repetindo o login com `tenantId`).

import { LogCategoria, LogNivel, TenantStatus, UsuarioStatus } from '@/lib/prisma-enums'
import type { UsuarioPerfil } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { verificarSenha } from '@/lib/auth'
import {
  MAX_TENTATIVAS, BLOQUEIO_MINUTOS, falhasRecentesDoIp,
  respostaDeSessao, motivoDeBloqueio, type ContaSessao,
} from '@/lib/contas'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — anotado aqui com a forma da consulta abaixo.
type ContaLogin = ContaSessao & {
  senha: string | null
  status: UsuarioStatus
  tenant: { id: string; nome: string; status: TenantStatus }
}

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { email?: string; senha?: string; tenantId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { email, senha, tenantId } = body

  if (!email || !senha) {
    return NextResponse.json(
      { erro: 'E-mail e senha são obrigatórios.' },
      { status: 400 },
    )
  }

  // Todas as contas deste e-mail (uma por empresa)
  const contas: ContaLogin[] = await prisma.usuario.findMany({
    where:   { email: email.toLowerCase().trim() },
    include: { tenant: { select: { id: true, nome: true, status: true } } },
    orderBy: { criadoEm: 'asc' },
  })

  // Bloqueio temporário por excesso de tentativas falhas deste IP
  const tentativasRecentes = await falhasRecentesDoIp(ipAddress)

  if (tentativasRecentes >= MAX_TENTATIVAS) {
    await registrarLog({
      tenantId:   contas[0]?.tenantId,
      usuarioId:  contas[0]?.id,
      nivel:      LogNivel.CRITICO,
      categoria:  LogCategoria.LOGIN,
      mensagem:   `Bloqueio temporário: ${tentativasRecentes} tentativas falhas em ${BLOQUEIO_MINUTOS}min`,
      detalhe:    { email, ip: ipAddress },
      ipAddress,
      userAgent,
    })

    return NextResponse.json(
      {
        erro: `Muitas tentativas. Tente novamente em ${BLOQUEIO_MINUTOS} minutos.`,
      },
      { status: 429 },
    )
  }

  // Contas sem senha são convites ainda não aceitos
  const comSenha = contas.filter((c) => c.senha)

  if (comSenha.length === 0) {
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

  // Confere a senha uma vez por credencial distinta (contas que compartilham a
  // senha têm o mesmo hash, então é um bcrypt só)
  const confere = new Map<string, boolean>()
  for (const c of comSenha) {
    if (!confere.has(c.senha!)) confere.set(c.senha!, await verificarSenha(senha, c.senha!))
  }
  const corretas = comSenha.filter((c) => confere.get(c.senha!))

  // Só depois de a senha estar certa é que se fala de empresa suspensa ou
  // usuário inativo — antes disso, nada sobre a conta é revelado.
  if (corretas.length === 0) {
    await registrarLog({
      tenantId:  comSenha[0].tenantId,
      usuarioId: comSenha[0].id,
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

  // Empresas em que a pessoa pode entrar agora
  const disponiveis = corretas.filter((c) => !motivoDeBloqueio(c))

  if (disponiveis.length === 0) {
    const bloqueio = motivoDeBloqueio(corretas[0])!
    return NextResponse.json({ erro: bloqueio.erro }, { status: bloqueio.status })
  }

  let usuario = disponiveis[0]
  if (tenantId) {
    const escolhida = disponiveis.find((c) => c.tenantId === tenantId)
    if (!escolhida) {
      return NextResponse.json({ erro: 'Empresa inválida.' }, { status: 400 })
    }
    usuario = escolhida
  } else if (disponiveis.length > 1) {
    return NextResponse.json({
      escolherEmpresa: true,
      empresas: disponiveis.map((c) => ({
        tenantId: c.tenantId,
        nome:     c.tenant.nome,
        perfil:   c.perfil as UsuarioPerfil,
      })),
    })
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

  return NextResponse.json(respostaDeSessao(usuario, usuario.tenant))
}
