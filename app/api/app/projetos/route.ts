// src/api/app/projetos/route.ts
// GET  /api/app/projetos — listar projetos do tenant
// POST /api/app/projetos — criar projeto

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarProjetos } from '@/lib/auth'
import { calcPctPlanejado, calcProgressoPonderado } from '@/lib/rdo-display'
import type { Projeto } from '@/lib/types'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — a query ainda não tem os campos de progresso calculados
// abaixo, daí o Omit.
type ProjetoSemProgresso = Omit<Projeto, 'pctReal' | 'pctPlanejado' | 'desvio' | 'ocorrenciasAbertas'>

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx

  let projetos: ProjetoSemProgresso[] = await prisma.projeto.findMany({
    where: { tenantId },
    include: {
      gestor: { select: { id: true, nome: true } },
      _count: {
        select: { rdos: true, etapas: true },
      },
    },
    orderBy: { criadoEm: 'desc' },
  })

  // Projetos com lista de acesso configurada só aparecem para quem está nela
  // (admin/gestor sempre veem tudo; projeto sem restrição continua aberto ao tenant)
  if (!podeGerenciarProjetos(auth.ctx) && projetos.length > 0) {
    const acessos: Array<{ projetoId: string; usuarioId: string }> = await prisma.projetoAcesso.findMany({
      where:  { projetoId: { in: projetos.map((p) => p.id) } },
      select: { projetoId: true, usuarioId: true },
    })
    const projetosRestritos = new Set(acessos.map((a) => a.projetoId))
    const meusProjetos = new Set(acessos.filter((a) => a.usuarioId === usuarioId).map((a) => a.projetoId))
    projetos = projetos.filter((p) => !projetosRestritos.has(p.id) || meusProjetos.has(p.id))
  }

  // Calcula % real vs planejado e ocorrências abertas por projeto
  const projetosComProgresso: Projeto[] = await Promise.all(
    projetos.map(async (p) => {
      const atividades: Array<{ pctAcumulado: number; dataInicio: Date | null; dataFim: Date | null }> = await prisma.atividade.findMany({
        where: { etapa: { projetoId: p.id } },
        select: { pctAcumulado: true, dataInicio: true, dataFim: true },
      })

      const pctReal = calcProgressoPonderado(atividades)

      // % planejado: pela duração de cada atividade (dataInicio → dataFim)
      const pctPlanejado = calcPctPlanejado(atividades)

      const [ocorrenciasAbertas, totalOcorrencias, totalComentarios, totalFotos, totalVideos] = await Promise.all([
        prisma.ocorrencia.count({ where: { resolvida: false, rdo: { projetoId: p.id } } }),
        prisma.ocorrencia.count({ where: { rdo: { projetoId: p.id } } }),
        prisma.comentario.count({ where: { rdo: { projetoId: p.id } } }),
        prisma.midia.count({ where: { rdo: { projetoId: p.id }, tipo: 'FOTO' } }),
        prisma.midia.count({ where: { rdo: { projetoId: p.id }, tipo: 'VIDEO' } }),
      ])

      return {
        ...p,
        pctReal,
        pctPlanejado,
        desvio: pctReal - pctPlanejado,
        ocorrenciasAbertas,
        totalAtividades: atividades.length,
        totalOcorrencias,
        totalComentarios,
        totalFotos,
        totalVideos,
      }
    }),
  )

  return NextResponse.json(projetosComProgresso)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeGerenciarProjetos(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  // Verifica limite de projetos do plano
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { limiteProjetos: true },
  })

  if (tenant && tenant.limiteProjetos > 0) {
    const totalProjetos = await prisma.projeto.count({
      where: { tenantId, status: 'ATIVO' },
    })

    if (totalProjetos >= tenant.limiteProjetos) {
      return NextResponse.json(
        {
          erro: `Limite de ${tenant.limiteProjetos} projetos ativos atingido. Faça upgrade do plano.`,
          codigo: 'LIMITE_PROJETO',
        },
        { status: 402 },
      )
    }
  }

  let body: {
    nome:               string
    descricao?:         string
    pedidoCompraContrato?: string
    empresaContratada?: string
    grupo?:             string
    fotoUrl?:           string
    dataInicioContrato?: string
    dataFimContrato?:    string
    gestorId?:           string
    cor?:                string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.nome) {
    return NextResponse.json(
      { erro: 'Nome do projeto é obrigatório.' },
      { status: 400 },
    )
  }

  const projeto = await prisma.projeto.create({
    data: {
      tenantId,
      nome:               body.nome,
      descricao:          body.descricao          ?? undefined,
      pedidoCompraContrato: body.pedidoCompraContrato ?? undefined,
      empresaContratada:  body.empresaContratada  ?? undefined,
      grupo:              body.grupo              ?? undefined,
      fotoUrl:            body.fotoUrl            ?? undefined,
      status:             'NAO_INICIADO',
      dataInicioContrato: body.dataInicioContrato
        ? new Date(body.dataInicioContrato)
        : undefined,
      dataFimContrato: body.dataFimContrato
        ? new Date(body.dataFimContrato)
        : undefined,
      gestorId: body.gestorId ?? undefined,
      cor:      body.cor      ?? '#29B6D8',
    },
  })

  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Projeto "${projeto.nome}" criado`,
    detalhe:   { projetoId: projeto.id },
    ipAddress,
    userAgent,
  })

  return NextResponse.json(projeto, { status: 201 })
}
