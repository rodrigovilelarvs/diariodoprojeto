// src/api/auth/recuperar-senha/route.ts
// POST /api/auth/recuperar-senha — solicita o e-mail de redefinição de senha

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { signResetToken } from '@/lib/auth'
import { enviarEmailSeguro, enviarRecuperacaoSenha } from '@/lib/email'

// Mensagem sempre igual, exista ou não o e-mail — evita revelar quais e-mails estão cadastrados
const MENSAGEM_GENERICA = 'Se este e-mail estiver cadastrado, você receberá um link de redefinição em instantes.'

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { email } = body
  if (!email) {
    return NextResponse.json({ erro: 'E-mail é obrigatório.' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase().trim() },
  })

  // Só envia se o usuário existe e já tem senha definida (não é um convite pendente)
  if (usuario && usuario.senha) {
    const token = signResetToken(usuario.id)

    await enviarEmailSeguro(() => enviarRecuperacaoSenha({
      email: usuario.email, nome: usuario.nome, token,
    }))

    await registrarLog({
      tenantId:  usuario.tenantId,
      usuarioId: usuario.id,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Recuperação de senha solicitada por ${usuario.nome}`,
      ipAddress,
      userAgent,
    })
  }

  return NextResponse.json({ ok: true, mensagem: MENSAGEM_GENERICA })
}
