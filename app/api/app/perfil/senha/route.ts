// src/api/app/perfil/senha/route.ts
// POST /api/app/perfil/senha — trocar a própria senha (exige a senha atual)

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, hashSenha, verificarSenha } from '@/lib/auth'
import { LogCategoria, LogNivel } from '@/lib/prisma-enums'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId, tenantId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { senhaAtual?: string; novaSenha?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { senhaAtual, novaSenha } = body

  if (!senhaAtual || !novaSenha) {
    return NextResponse.json({ erro: 'Informe a senha atual e a nova senha.' }, { status: 400 })
  }
  if (novaSenha.length < 8) {
    return NextResponse.json({ erro: 'A nova senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, tenantId } })
  if (!usuario?.senha) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const senhaOk = await verificarSenha(senhaAtual, usuario.senha)
  if (!senhaOk) {
    await registrarLog({
      tenantId, usuarioId,
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.USUARIO,
      mensagem:  'Tentativa de troca de senha com senha atual incorreta',
      ipAddress, userAgent,
    })
    // 403, não 401: o cliente trata 401 como "sessão expirada" e deslogava o
    // usuário por errar a senha atual
    return NextResponse.json({ erro: 'Senha atual incorreta.', codigo: 'SENHA_ATUAL_INCORRETA' }, { status: 403 })
  }

  const novaHash = await hashSenha(novaSenha)
  // A senha é uma só por e-mail: troca também nas contas dele em outras empresas
  // que guardam a MESMA credencial. Contas com outra credencial (ex.: cadastradas
  // à parte por um administrador) não são tocadas.
  const atualizadas: { count: number } = await prisma.usuario.updateMany({
    where: { email: usuario.email, senha: usuario.senha },
    data:  { senha: novaHash },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  'Senha alterada pelo próprio usuário',
    detalhe:   { contasAtualizadas: atualizadas.count },
    ipAddress, userAgent,
  })

  return NextResponse.json({ ok: true })
}
