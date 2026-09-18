// src/api/app/equipamentos/route.ts
// GET  /api/app/equipamentos — lista equipamentos cadastrados do tenant (semeia equipamentos comuns no primeiro acesso)
// POST /api/app/equipamentos — cadastrar novo equipamento

import { EquipamentoTipo } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// Equipamentos comuns de canteiro de obra — semeados automaticamente no primeiro acesso do tenant
const EQUIPAMENTOS_PADRAO: Array<{ nome: string; tipo: EquipamentoTipo }> = [
  { nome: 'Betoneira 400L',          tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Andaime',                 tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Vibrador de concreto',    tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Compactador de solo',     tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Serra circular',          tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Furadeira',               tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Rompedor',                tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Gerador',                 tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Nível a laser',           tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Guincho de coluna',       tipo: EquipamentoTipo.PROPRIO },
  { nome: 'Retroescavadeira',        tipo: EquipamentoTipo.ALUGADO },
  { nome: 'Caminhão pipa',           tipo: EquipamentoTipo.ALUGADO },
  { nome: 'Betoneira estacionária',  tipo: EquipamentoTipo.ALUGADO },
  { nome: 'Grua',                    tipo: EquipamentoTipo.ALUGADO },
  { nome: 'Munck',                   tipo: EquipamentoTipo.TERCEIRIZADO },
  { nome: 'Caçamba de entulho',      tipo: EquipamentoTipo.TERCEIRIZADO },
]

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  const total = await prisma.equipamentoCadastro.count({ where: { tenantId } })
  if (total === 0) {
    await prisma.equipamentoCadastro.createMany({
      data: EQUIPAMENTOS_PADRAO.map(e => ({ tenantId, nome: e.nome, tipo: e.tipo })),
      skipDuplicates: true,
    })
  }

  const equipamentos = await prisma.equipamentoCadastro.findMany({
    where:   { tenantId },
    select:  { id: true, nome: true, tipo: true },
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json(equipamentos)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  let body: { nome?: string; tipo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
  if (!nome) {
    return NextResponse.json({ erro: 'Nome do equipamento é obrigatório.' }, { status: 400 })
  }
  if (!Object.values(EquipamentoTipo).includes(body.tipo as EquipamentoTipo)) {
    return NextResponse.json({ erro: 'Tipo inválido.' }, { status: 400 })
  }

  const existente = await prisma.equipamentoCadastro.findFirst({ where: { tenantId, nome } })
  if (existente) {
    return NextResponse.json(existente, { status: 200 })
  }

  const equipamento = await prisma.equipamentoCadastro.create({
    data: { tenantId, nome, tipo: body.tipo as EquipamentoTipo },
    select: { id: true, nome: true, tipo: true },
  })

  return NextResponse.json(equipamento, { status: 201 })
}
