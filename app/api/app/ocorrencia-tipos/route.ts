// src/api/app/ocorrencia-tipos/route.ts
// GET  /api/app/ocorrencia-tipos — lista tipos de ocorrência cadastrados do tenant (semeia tipos padrão no primeiro acesso)
// POST /api/app/ocorrencia-tipos — cadastrar novo tipo

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// Tipos padrão de ocorrência — semeados automaticamente no primeiro acesso do tenant
const TIPOS_PADRAO = [
  'Acidente / incidente',
  'Atraso de material',
  'Problema técnico',
  'Paralisação',
  'Condição climática',
  'Falta de mão de obra',
  'Outro',
]

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  const total = await prisma.ocorrenciaTipoCadastro.count({ where: { tenantId } })
  if (total === 0) {
    await prisma.ocorrenciaTipoCadastro.createMany({
      data: TIPOS_PADRAO.map(nome => ({ tenantId, nome })),
      skipDuplicates: true,
    })
  }

  const tipos = await prisma.ocorrenciaTipoCadastro.findMany({
    where:   { tenantId },
    select:  { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json(tipos)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  let body: { nome?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  if (!nome) {
    return NextResponse.json({ erro: 'Nome do tipo é obrigatório.' }, { status: 400 })
  }

  const existente = await prisma.ocorrenciaTipoCadastro.findFirst({ where: { tenantId, nome } })
  if (existente) {
    return NextResponse.json(existente, { status: 200 })
  }

  const tipo = await prisma.ocorrenciaTipoCadastro.create({
    data: { tenantId, nome },
    select: { id: true, nome: true },
  })

  return NextResponse.json(tipo, { status: 201 })
}
