// src/api/auth/trocar-empresa/route.ts
// POST /api/auth/trocar-empresa — quem está logado passa para a conta do
// MESMO e-mail em outra empresa.
// body: { tenantId: string, senha?: string }
//
// Sem digitar senha só quando as duas contas guardam exatamente a mesma
// credencial (o caso normal: uma senha por e-mail, ver lib/contas.ts). Se a
// conta de destino tiver outra credencial, exige a senha dela — assim, quem
// controla uma conta cadastrada com o e-mail de outra pessoa não consegue
// pular pra conta dela. Erros de senha usam 403 (não 401): o cliente trata
// 401 como sessão expirada e derrubaria o usuário.

import { LogCategoria, LogNivel, TenantStatus, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, verificarSenha } from '@/lib/auth'
import {
  MAX_TENTATIVAS, BLOQUEIO_MINUTOS, falhasRecentesDoIp,
  respostaDeSessao, motivoDeBloqueio, type ContaSessao,
} from '@/lib/contas'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — anotado aqui com a forma da consulta abaixo.
type ContaDestino = ContaSessao & {
  senha: string | null
  status: UsuarioStatus
  tenant: { id: string; nome: string; status: TenantStatus }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId, tenantId: tenantAtual } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { tenantId?: string; senha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.tenantId) {
    return NextResponse.json({ erro: 'Informe a empresa.' }, { status: 400 })
  }
  if (body.tenantId === tenantAtual) {
    return NextResponse.json({ erro: 'Você já está nesta empresa.' }, { status: 400 })
  }

  // Digitar a senha de outra empresa vale como tentativa de login: mesmo limite
  const tentativas = await falhasRecentesDoIp(ipAddress)
  if (tentativas >= MAX_TENTATIVAS) {
    return NextResponse.json(
      { erro: `Muitas tentativas. Tente novamente em ${BLOQUEIO_MINUTOS} minutos.` },
      { status: 429 },
    )
  }

  const atual: { email: string; senha: string | null } | null = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { email: true, senha: true },
  })
  if (!atual) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const alvo: ContaDestino | null = await prisma.usuario.findFirst({
    where:   { email: atual.email, tenantId: body.tenantId },
    include: { tenant: { select: { id: true, nome: true, status: true } } },
  })
  // Sem conta com esse e-mail na empresa, ou convite ainda não aceito (sem senha)
  if (!alvo || !alvo.senha) {
    return NextResponse.json({ erro: 'Você não tem acesso a essa empresa.' }, { status: 404 })
  }

  const mesmaCredencial = !!atual.senha && alvo.senha === atual.senha
  if (!mesmaCredencial) {
    if (!body.senha) {
      return NextResponse.json(
        { erro: 'Informe a senha que você usa nesta empresa.', codigo: 'PEDIR_SENHA' },
        { status: 403 },
      )
    }
    if (!(await verificarSenha(body.senha, alvo.senha))) {
      await registrarLog({
        tenantId:  alvo.tenantId,
        usuarioId: alvo.id,
        nivel:     LogNivel.AVISO,
        categoria: LogCategoria.LOGIN,
        mensagem:  `Senha incorreta ao trocar de empresa (${alvo.email})`,
        ipAddress,
        userAgent,
      })
      return NextResponse.json(
        { erro: 'Senha incorreta para esta empresa.', codigo: 'SENHA_INCORRETA' },
        { status: 403 },
      )
    }
  }

  const bloqueio = motivoDeBloqueio(alvo)
  if (bloqueio) {
    return NextResponse.json({ erro: bloqueio.erro }, { status: bloqueio.status })
  }

  await prisma.usuario.update({
    where: { id: alvo.id },
    data:  { ultimoAcessoEm: new Date() },
  })

  await registrarLog({
    tenantId:  alvo.tenantId,
    usuarioId: alvo.id,
    nivel:     LogNivel.INFO,
    categoria: LogCategoria.LOGIN,
    mensagem:  `Troca de empresa: ${alvo.nome} entrou em ${alvo.tenant.nome}`,
    ipAddress,
    userAgent,
  })

  return NextResponse.json(respostaDeSessao(alvo, alvo.tenant))
}
