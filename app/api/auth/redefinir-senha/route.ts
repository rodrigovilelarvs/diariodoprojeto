// src/api/auth/redefinir-senha/route.ts
// POST /api/auth/redefinir-senha — confirma o token e define a nova senha

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { verifyResetToken, hashSenha } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { token?: string; novaSenha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { token, novaSenha } = body
  if (!token || !novaSenha) {
    return NextResponse.json({ erro: 'Token e nova senha são obrigatórios.' }, { status: 400 })
  }

  if (novaSenha.length < 8) {
    return NextResponse.json({ erro: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
  }

  let payload
  try {
    payload = verifyResetToken(token)
  } catch {
    return NextResponse.json({ erro: 'Link inválido ou expirado. Solicite uma nova redefinição.' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: payload.usuarioId } })
  if (!usuario) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const senhaHash = await hashSenha(novaSenha)
  await prisma.usuario.update({
    where: { id: usuario.id },
    data:  { senha: senhaHash },
  })

  await registrarLog({
    tenantId:  usuario.tenantId,
    usuarioId: usuario.id,
    categoria: LogCategoria.LOGIN,
    mensagem:  `Senha redefinida por ${usuario.nome} via link de recuperação`,
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ ok: true, mensagem: 'Senha redefinida com sucesso.' })
}
