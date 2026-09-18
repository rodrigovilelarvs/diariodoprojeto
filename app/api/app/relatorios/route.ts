// src/api/app/relatorios/route.ts
// GET /api/app/relatorios?projetoId=&grupo=&periodo=30
//                        &dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
//
// periodo (dias) é usado quando dataInicio/dataFim não são informados —
// mantido para os presets rápidos (7/30/90) da tela.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, podeVerRelatorios } from '@/lib/auth'
import { calcPctPlanejado, calcProgressoPonderado } from '@/lib/rdo-display'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — anotados aqui localmente com a forma real de cada query.
type GroupByCount = { _count: number }
type RdoPorStatus = { status: string } & GroupByCount
type OcorrenciaPorTipo = { tipo: string; _sum: { duracaoMin: number | null } } & GroupByCount
type Atividade = { pctAcumulado: number; dataInicio: Date | null; dataFim: Date | null; status: string }
type ProjetoProgresso = { id: string; nome: string; cor: string; etapas: Array<{ atividades: Atividade[] }>; _count: { rdos: number } }
type HHPorFuncao = { funcaoNome: string; _sum: { totalHH: number | null } }
type HHPorCategoria = { categoria: string; _sum: { totalHH: number | null; quantidade: number | null } }
type MidiaStat = { tipo: string; _sum: { tamanhoBytes: number | null } } & GroupByCount
type RdoDecidido = { enviadoEm: Date | null; atualizadoEm: Date }

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  if (!podeVerRelatorios(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para ver relatórios.' }, { status: 403 })
  }

  const { tenantId } = auth.ctx
  const { searchParams } = new URL(req.url)

  const projetoId      = searchParams.get('projetoId') ?? undefined
  const grupo          = searchParams.get('grupo') ?? undefined
  const periodo        = Number(searchParams.get('periodo') ?? 30) // dias
  const dataInicioParam = searchParams.get('dataInicio')
  const dataFimParam    = searchParams.get('dataFim')

  const dataInicio = dataInicioParam
    ? new Date(`${dataInicioParam}T00:00:00`)
    : (() => { const d = new Date(); d.setDate(d.getDate() - periodo); return d })()

  const dataFim = dataFimParam
    ? new Date(`${dataFimParam}T23:59:59`)
    : new Date()

  // Filtro base — sempre scoped ao tenant
  const whereRdo = {
    projeto: {
      tenantId,
      ...(projetoId ? { id: projetoId } : {}),
      ...(grupo ? { grupo } : {}),
    },
    criadoEm: { gte: dataInicio, lte: dataFim },
  }
  const whereProjeto = {
    tenantId,
    ...(projetoId ? { id: projetoId } : {}),
    ...(grupo ? { grupo } : {}),
  }
  // Fotos/vídeos/anexos/armazenamento são acumulados — ignoram o período,
  // só respeitam o filtro de grupo/projeto (ver whereProjeto)
  const whereRdoSemPeriodo = { projeto: whereProjeto }

  const [
    totalRdos,
    rdosPorStatus,
    totalHH,
    ocorrenciasPorTipo,
    ocorrenciasAbertas,
    progressoPorProjeto,
    hhPorFuncao,
    hhPorCategoria,
    rdoDatas,
    totalProjetos,
    totalUsuarios,
    midiaStats,
    rdosDecididos,
  ]: [
    number,
    RdoPorStatus[],
    { _sum: { totalHH: number | null } },
    OcorrenciaPorTipo[],
    number,
    ProjetoProgresso[],
    HHPorFuncao[],
    HHPorCategoria[],
    Array<{ data: Date }>,
    number,
    number,
    MidiaStat[],
    RdoDecidido[],
  ] = await Promise.all([

    // Total de RDOs no período
    prisma.rdo.count({ where: whereRdo }),

    // RDOs por status
    prisma.rdo.groupBy({
      by:    ['status'],
      where: whereRdo,
      _count: true,
    }),

    // Total de H/H
    prisma.maoDeObra.aggregate({
      where: { rdo: whereRdo },
      _sum:  { totalHH: true },
    }),

    // Ocorrências por tipo — contagem e soma da duração (horas impactadas)
    prisma.ocorrencia.groupBy({
      by:    ['tipo'],
      where: { rdo: whereRdo },
      _count: true,
      _sum:  { duracaoMin: true },
      orderBy: { _count: { tipo: 'desc' } },
    }),

    // Ocorrências ainda não resolvidas (acionável — independe do período de criação)
    prisma.ocorrencia.count({
      where: { rdo: { projeto: whereProjeto }, resolvida: false },
    }),

    // Progresso por projeto (% real vs planejado)
    prisma.projeto.findMany({
      where: { ...whereProjeto, status: 'ATIVO' },
      select: {
        id:   true,
        nome: true,
        cor:  true,
        etapas: {
          select: {
            atividades: {
              select: {
                pctAcumulado: true,
                dataInicio:   true,
                dataFim:      true,
                status:       true,
              },
            },
          },
        },
        _count: { select: { rdos: true } },
      },
    }),

    // H/H por função
    prisma.maoDeObra.groupBy({
      by:    ['funcaoNome'],
      where: { rdo: whereRdo },
      _sum:  { totalHH: true },
      orderBy: { _sum: { totalHH: 'desc' } },
      take:  10,
    }),

    // H/H e pessoas por categoria (direta/indireta/terceirizado)
    prisma.maoDeObra.groupBy({
      by:    ['categoria'],
      where: { rdo: whereRdo },
      _sum:  { totalHH: true, quantidade: true },
    }),

    // Datas dos RDOs do período — agrupadas em JS (dia/semana/mês conforme
    // a amplitude do período, pra não gerar dezenas de barras minúsculas)
    prisma.rdo.findMany({
      where:  whereRdo,
      select: { data: true },
      orderBy: { data: 'asc' },
    }),

    // Quantidade de projetos no escopo do filtro (todos os status)
    prisma.projeto.count({ where: whereProjeto }),

    // Usuários ativos da empresa (não é escopado por período/projeto)
    prisma.usuario.count({ where: { tenantId, status: 'ATIVO' } }),

    // Fotos/vídeos/anexos + espaço ocupado — acumulado, não escopado por período
    prisma.midia.groupBy({
      by:    ['tipo'],
      where: { rdo: whereRdoSemPeriodo },
      _count: true,
      _sum:  { tamanhoBytes: true },
    }),

    // RDOs decididos (aprovados/rejeitados) com data de envio registrada —
    // base pro tempo médio de aprovação. enviadoEm só existe pra RDOs
    // enviados após esta feature existir; os mais antigos ficam de fora.
    prisma.rdo.findMany({
      where: {
        ...whereRdo,
        status:    { in: ['APROVADO', 'REJEITADO'] },
        enviadoEm: { not: null },
      },
      select: { enviadoEm: true, atualizadoEm: true },
    }),
  ])

  // Calcula progresso de cada projeto
  const progressoCalculado = progressoPorProjeto.map((proj) => {
    const atividades = proj.etapas.flatMap((e) => e.atividades)
    const pctReal    = calcProgressoPonderado(atividades)
    const pctPlanejado = calcPctPlanejado(atividades)

    return {
      id:          proj.id,
      nome:        proj.nome,
      cor:         proj.cor,
      pctReal,
      pctPlanejado,
      desvio:      pctReal - pctPlanejado,
      totalRdos:   proj._count.rdos,
    }
  })

  const desvioMedio = progressoCalculado.length
    ? Math.round(progressoCalculado.reduce((s, p) => s + p.desvio, 0) / progressoCalculado.length)
    : 0

  // Top 5 projetos com pior desvio (mais negativo = mais atrasado)
  const rankingPiorDesvio = [...progressoCalculado]
    .sort((a, b) => a.desvio - b.desvio)
    .slice(0, 5)

  // ── Tempo médio de aprovação — enviadoEm até a decisão (atualizadoEm,
  // que só muda de novo quando o RDO vira APROVADO/REJEITADO, já que a
  // edição é bloqueada nesses status) ──────────────────────────────
  const horasAprovacao = rdosDecididos
    .map(r => (r.atualizadoEm.getTime() - r.enviadoEm!.getTime()) / 3_600_000)
    .filter(h => h >= 0)

  const mediaHorasAprovacao = horasAprovacao.length
    ? Math.round((horasAprovacao.reduce((s, h) => s + h, 0) / horasAprovacao.length) * 10) / 10
    : null

  const FAIXAS_APROVACAO: Array<{ label: string; min: number; max: number }> = [
    { label: 'Até 4h',      min: 0,   max: 4 },
    { label: '4h – 24h',    min: 4,   max: 24 },
    { label: '1 – 3 dias',  min: 24,  max: 72 },
    { label: 'Mais de 3 dias', min: 72, max: Infinity },
  ]
  const distribuicaoAprovacao = FAIXAS_APROVACAO.map(f => ({
    faixa: f.label,
    total: horasAprovacao.filter(h => h >= f.min && h < f.max).length,
  }))

  const aprovados  = rdosPorStatus.find((s) => s.status === 'APROVADO')?._count ?? 0
  const pendentes  = rdosPorStatus.find((s) => s.status === 'PENDENTE_APROVACAO')?._count ?? 0
  const rascunhos  = rdosPorStatus.find((s) => s.status === 'RASCUNHO')?._count ?? 0
  const rejeitados = rdosPorStatus.find((s) => s.status === 'REJEITADO')?._count ?? 0
  const finalizados = aprovados + rejeitados // enviados que já receberam decisão
  const taxaAprovacao = finalizados > 0 ? Math.round((aprovados / finalizados) * 100) : 0

  const totalFotos  = midiaStats.find(m => m.tipo === 'FOTO')?._count ?? 0
  const totalVideos = midiaStats.find(m => m.tipo === 'VIDEO')?._count ?? 0
  const totalAnexos = midiaStats.find(m => m.tipo === 'ARQUIVO')?._count ?? 0
  const armazenamentoBytes = midiaStats.reduce((s, m) => s + Number(m._sum.tamanhoBytes ?? 0), 0)

  // ── Agrupamento de RDOs ao longo do tempo ──────────────────
  const diasNoIntervalo = Math.max(1, Math.round((dataFim.getTime() - dataInicio.getTime()) / 86_400_000))
  const agrupamento: 'dia' | 'semana' | 'mes' =
    diasNoIntervalo <= 31 ? 'dia' : diasNoIntervalo <= 180 ? 'semana' : 'mes'

  function chaveBucket(d: Date): string {
    if (agrupamento === 'dia') return d.toISOString().slice(0, 10)
    if (agrupamento === 'mes') return `${d.toISOString().slice(0, 7)}-01`
    // início da semana (segunda-feira)
    const dt = new Date(d)
    const diaSemana = (dt.getUTCDay() + 6) % 7 // 0 = segunda
    dt.setUTCDate(dt.getUTCDate() - diaSemana)
    return dt.toISOString().slice(0, 10)
  }

  const buckets = new Map<string, number>()
  for (const r of rdoDatas) {
    const chave = chaveBucket(new Date(r.data))
    buckets.set(chave, (buckets.get(chave) ?? 0) + 1)
  }
  const rdosPorPeriodo = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, total]) => ({ data, total }))

  return NextResponse.json({
    dataInicio: dataInicio.toISOString(),
    dataFim:    dataFim.toISOString(),
    kpis: {
      totalRdos,
      totalHH:     Number(totalHH._sum.totalHH ?? 0),
      aprovados, pendentes, rascunhos, rejeitados,
      desvioMedio,
      taxaAprovacao,
      ocorrenciasAbertas,
      totalProjetos,
      totalUsuarios,
      totalFotos,
      totalVideos,
      totalAnexos,
      armazenamentoBytes,
    },
    progressoPorProjeto: progressoCalculado,
    statusRdos: [
      { status: 'RASCUNHO',            total: rascunhos },
      { status: 'PENDENTE_APROVACAO',  total: pendentes },
      { status: 'APROVADO',            total: aprovados },
      { status: 'REJEITADO',           total: rejeitados },
    ],
    ocorrenciasPorTipo: ocorrenciasPorTipo.map((o) => ({
      tipo:  o.tipo,
      total: o._count,
      horas: Math.round((Number(o._sum.duracaoMin ?? 0) / 60) * 10) / 10,
    })),
    rankingPiorDesvio,
    tempoAprovacao: {
      mediaHoras: mediaHorasAprovacao,
      amostra:    horasAprovacao.length,
      distribuicao: distribuicaoAprovacao,
    },
    hhPorFuncao: hhPorFuncao.map((h) => ({
      funcao: h.funcaoNome,
      totalHH: Number(h._sum.totalHH ?? 0),
    })),
    hhPorCategoria: hhPorCategoria.map((h) => ({
      categoria:    h.categoria,
      totalHH:      Number(h._sum.totalHH ?? 0),
      totalPessoas: Number(h._sum.quantidade ?? 0),
    })),
    rdosPorPeriodo: { agrupamento, pontos: rdosPorPeriodo },
  })
}
