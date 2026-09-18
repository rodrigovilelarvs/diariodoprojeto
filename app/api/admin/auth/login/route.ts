// src/api/admin/auth/login/route.ts
// POST /api/admin/auth/login
// Autenticação exclusiva do super-admin — JWT separado, chave separada

import { LogCategoria, LogNivel } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { signAdminToken, verificarSenha } from '@/lib/auth-admin'
const MAX_TENTATIVAS  = 3     // mais restritivo que a empresa
const BLOQUEIO_MIN    = 60    // 1 hora de bloqueio

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

  // Bloqueia IP com muitas tentativas
  const tentativas = await prisma.logAuditoria.count({
    where: {
      ipAddress,
      categoria: LogCategoria.LOGIN,
      nivel:     LogNivel.CRITICO,
      mensagem:  { contains: 'admin' },
      criadoEm:  { gte: new Date(Date.now() - BLOQUEIO_MIN * 60 * 1000) },
    },
  })

  if (tentativas >= MAX_TENTATIVAS) {
    await registrarLog({
      nivel:     LogNivel.CRITICO,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Bloqueio de IP no painel admin: ${tentativas} tentativas`,
      detalhe:   { email, ip: ipAddress },
      ipAddress,
      userAgent,
    })
    return NextResponse.json(
      { erro: `Acesso bloqueado por ${BLOQUEIO_MIN} minutos.` },
      { status: 429 },
    )
  }

  const admin = await prisma.superAdmin.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!admin) {
    await registrarLog({
      nivel:     LogNivel.CRITICO,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Tentativa de login admin com e-mail inexistente: ${email}`,
      detalhe:   { email, ip: ipAddress },
      ipAddress,
      userAgent,
    })
    return NextResponse.json(
      { erro: 'Credenciais inválidas.' },
      { status: 401 },
    )
  }

  const senhaCorreta = await verificarSenha(senha, admin.senha)

  if (!senhaCorreta) {
    await registrarLog({
      nivel:     LogNivel.CRITICO,
      categoria: LogCategoria.LOGIN,
      mensagem:  `Senha incorreta no painel admin (tentativa ${tentativas + 1})`,
      detalhe:   { email, tentativa: tentativas + 1, ip: ipAddress },
      ipAddress,
      userAgent,
    })
    return NextResponse.json(
      { erro: 'Credenciais inválidas.' },
      { status: 401 },
    )
  }

  await registrarLog({
    nivel:     LogNivel.INFO,
    categoria: LogCategoria.LOGIN,
    mensagem:  `Login no painel admin por ${admin.nome}`,
    detalhe:   { adminId: admin.id },
    ipAddress,
    userAgent,
  })

  const token = signAdminToken({
    adminId: admin.id,
    email:   admin.email,
    role:    'SUPER_ADMIN',
  })

  return NextResponse.json({
    token,
    admin: {
      id:   admin.id,
      nome: admin.nome,
      email: admin.email,
    },
    expiraEm: '8h',
  })
}
