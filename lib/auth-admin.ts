// src/lib/auth-admin.ts
// Guard exclusivo do super-admin — completamente separado do JWT da empresa

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN!  // chave diferente da empresa
const JWT_EXPIRES_ADMIN = '8h'                          // sessão mais curta por segurança

export interface AdminPayload {
  adminId: string
  email:   string
  role:    'SUPER_ADMIN'
  iat?:    number
  exp?:    number
}

// ── Token ───────────────────────────────────────────────────
export function signAdminToken(payload: Omit<AdminPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET_ADMIN, { expiresIn: JWT_EXPIRES_ADMIN })
}

export function verifyAdminToken(token: string): AdminPayload {
  return jwt.verify(token, JWT_SECRET_ADMIN) as AdminPayload
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 14)   // custo maior para o super-admin
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

// ── Guard — usado em TODOS os endpoints /api/admin/* ────────
export interface AdminContext {
  adminId: string
  email:   string
}

export async function requireAdmin(
  req: NextRequest,
): Promise<{ ctx: AdminContext } | { error: NextResponse }> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) {
    return {
      error: NextResponse.json(
        { erro: 'Token de administrador não informado.' },
        { status: 401 },
      ),
    }
  }

  let payload: AdminPayload
  try {
    payload = verifyAdminToken(token)
  } catch {
    return {
      error: NextResponse.json(
        { erro: 'Token inválido ou expirado.' },
        { status: 401 },
      ),
    }
  }

  if (payload.role !== 'SUPER_ADMIN') {
    return {
      error: NextResponse.json(
        { erro: 'Acesso negado.' },
        { status: 403 },
      ),
    }
  }

  // Confirma que o super-admin ainda existe no banco
  const admin = await prisma.superAdmin.findUnique({
    where:  { id: payload.adminId },
    select: { id: true, email: true },
  })

  if (!admin) {
    return {
      error: NextResponse.json(
        { erro: 'Super-admin não encontrado.' },
        { status: 403 },
      ),
    }
  }

  return { ctx: { adminId: admin.id, email: admin.email } }
}
