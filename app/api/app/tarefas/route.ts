// src/api/app/tarefas/route.ts
// GET  /api/app/tarefas?projetoId=  — EAP completa do projeto
// POST /api/app/tarefas/etapa       — criar etapa
// POST /api/app/tarefas/atividade   — criar atividade
// PATCH /api/app/tarefas/atividade/:id — atualizar % / status

import { NextRequest, NextResponse } from 'next/server'
import { prisma, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarTarefas } from '@/lib/auth'
import { calcPctPlanejado, calcProgressoPonderado, calcStatusEfetivo } from '@/lib/rdo-display'
import type { AtividadeStatus } from '@/lib/types'

// ── GET — EAP completa ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx
  const projetoId = new URL(req.url).searchParams.get('projetoId')

  if (!projetoId) {
    return NextResponse.json(
      { erro: 'projetoId é obrigatório.' },
      { status: 400 },
    )
  }

  // Garante que o projeto pertence ao tenant
  const projeto = await prisma.projeto.findFirst({
    where: { id: projetoId, tenantId },
  })

  if (!projeto) {
    return NextResponse.json(
      { erro: 'Projeto não encontrado.' },
      { status: 404 },
    )
  }

  const etapas = await prisma.etapa.findMany({
    where:   { projetoId },
    orderBy: { ordem: 'asc' },
    include: {
      atividades: {
        orderBy: { ordem: 'asc' },
        include: {
          // Últimos 5 registros para o histórico do acordeão
          registrosRdo: {
            orderBy: { criadoEm: 'desc' },
            take:    5,
            include: {
              rdo: { select: { numero: true, data: true } },
            },
          },
        },
      },
    },
  })

  // KPIs calculados — status efetivo considera prazo, não só o que foi lançado
  const todasAtividades = etapas.flatMap((e: any) => e.atividades)
  const efetivos: AtividadeStatus[] = todasAtividades.map((a: any) => calcStatusEfetivo(a))
  const kpis = {
    total:    todasAtividades.length,
    nao:      efetivos.filter((s: AtividadeStatus) => s === 'NAO_INICIADA').length,
    andamento: efetivos.filter((s: AtividadeStatus) => s === 'EM_ANDAMENTO').length,
    concluida: efetivos.filter((s: AtividadeStatus) => s === 'CONCLUIDA').length,
    atraso:   efetivos.filter((s: AtividadeStatus) => s === 'EM_ATRASO').length,
    pctMedio: calcProgressoPonderado(todasAtividades as any[]),
    pctPlanejado: calcPctPlanejado(todasAtividades as any[]),
  }

  return NextResponse.json({ etapas, kpis })
}

// ── POST — criar etapa ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  if (!podeGerenciarTarefas(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar a lista de tarefas.' }, { status: 403 })
  }

  let body: {
    tipo:      'etapa' | 'atividade'
    projetoId: string
    // etapa
    numero?: string
    nome?:   string
    // atividade
    etapaId?:    string
    dataInicio?: string
    dataFim?:    string
    status?:     string
    pctAcumulado?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  // Valida que o projeto pertence ao tenant
  const projeto = await prisma.projeto.findFirst({
    where: { id: body.projetoId, tenantId },
  })
  if (!projeto) {
    return NextResponse.json(
      { erro: 'Projeto não encontrado.' },
      { status: 404 },
    )
  }

  // ── Criar ETAPA
  if (body.tipo === 'etapa') {
    if (!body.nome) {
      return NextResponse.json(
        { erro: 'Nome da etapa é obrigatório.' },
        { status: 400 },
      )
    }

    const ultimaOrdem = await prisma.etapa.findFirst({
      where:   { projetoId: body.projetoId },
      orderBy: { ordem: 'desc' },
      select:  { ordem: true },
    })

    const novaOrdem = (ultimaOrdem?.ordem ?? 0) + 1
    const numero =
      body.numero ?? `${novaOrdem}.0`

    const etapa = await prisma.etapa.create({
      data: {
        projetoId: body.projetoId,
        numero,
        nome:  body.nome,
        ordem: novaOrdem,
      },
    })

    return NextResponse.json(etapa, { status: 201 })
  }

  // ── Criar ATIVIDADE
  if (body.tipo === 'atividade') {
    if (!body.etapaId || !body.nome) {
      return NextResponse.json(
        { erro: 'etapaId e nome são obrigatórios.' },
        { status: 400 },
      )
    }

    // Numera automaticamente
    const ultimaAtiv = await prisma.atividade.findFirst({
      where:   { etapaId: body.etapaId },
      orderBy: { ordem: 'desc' },
      select:  { ordem: true },
    })

    const etapa = await prisma.etapa.findUnique({
      where:  { id: body.etapaId },
      select: { numero: true },
    })

    const novaOrdem = (ultimaAtiv?.ordem ?? 0) + 1
    const prefixo   = etapa?.numero.replace('.0', '') ?? '0'
    const numero    = `${prefixo}.${novaOrdem}`

    const atividade = await prisma.atividade.create({
      data: {
        etapaId:     body.etapaId,
        numero,
        nome:        body.nome,
        status:      (body.status as any) ?? 'NAO_INICIADA',
        pctAcumulado: body.pctAcumulado ?? 0,
        dataInicio:  body.dataInicio ? new Date(body.dataInicio) : undefined,
        dataFim:     body.dataFim    ? new Date(body.dataFim)    : undefined,
        ordem:       novaOrdem,
      },
    })

    return NextResponse.json(atividade, { status: 201 })
  }

  return NextResponse.json({ erro: 'tipo deve ser "etapa" ou "atividade".' }, { status: 400 })
}
