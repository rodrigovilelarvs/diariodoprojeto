// lib/prisma.ts
// Mock para build sem banco real — em produção, substituir pelo cliente Prisma gerado

import { LogNivel, LogCategoria } from '@/lib/prisma-enums'

// Mock do PrismaClient para o build funcionar sem banco
const mockPrisma = new Proxy({} as any, {
  get: (_, prop) => {
    if (prop === '$transaction') return async (fn: any) => fn(mockPrisma)
    if (prop === '$queryRaw') return async () => []
    if (prop === '$disconnect') return async () => {}
    // Retorna objeto com métodos mock para qualquer modelo
    return new Proxy({} as any, {
      get: (_, method) => {
        if (['findMany', 'findFirst', 'findUnique', 'count', 'groupBy', 'aggregate']
            .includes(String(method))) {
          return async () => method === 'count' ? 0
            : method === 'aggregate' ? { _sum: {}, _count: 0, _avg: {} }
            : method === 'groupBy' ? []
            : []
        }
        if (['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany']
            .includes(String(method))) {
          return async (args: any) => args?.data ?? {}
        }
        return () => {}
      }
    })
  }
})

const globalForPrisma = globalThis as unknown as { prisma: any }

export const prisma = globalForPrisma.prisma ?? (() => {
  // Banco falso pros testes de ponta a ponta (ver lib/fake-db-test.ts e
  // playwright.config.ts) e pra depuração manual local. A Vercel nunca
  // define FAKE_DB, então este branch nunca roda em produção.
  if (process.env.FAKE_DB === '1') {
    const { fakeDb } = require('./fake-db-test')
    return fakeDb
  }
  // Em produção com Prisma gerado, usar PrismaClient real
  try {
    const { PrismaClient } = require('@prisma/client')
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    })
    return client
  } catch {
    // Fallback para mock se Prisma não estiver gerado
    console.warn('[PRISMA] Client não encontrado — usando mock. Execute: npx prisma generate')
    return mockPrisma
  }
})()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

interface LogParams {
  tenantId?:  string
  usuarioId?: string
  nivel?:     LogNivel
  categoria:  LogCategoria
  mensagem:   string
  detalhe?:   Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function registrarLog(params: LogParams): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: {
        tenantId:  params.tenantId,
        usuarioId: params.usuarioId,
        nivel:     params.nivel ?? LogNivel.INFO,
        categoria: params.categoria,
        mensagem:  params.mensagem,
        detalhe:   params.detalhe ? JSON.stringify(params.detalhe) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err)
  }
}

export function getRequestMeta(req: Request) {
  const ip =
    (req.headers as Headers).get('x-forwarded-for')?.split(',')[0] ??
    (req.headers as Headers).get('x-real-ip') ??
    'unknown'
  const ua = (req.headers as Headers).get('user-agent') ?? 'unknown'
  return { ipAddress: ip, userAgent: ua }
}
