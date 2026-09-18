// src/api/app/projetos/[id]/resumo/route.ts
// GET /api/app/projetos/:id/resumo — resumo geral do projeto (KPIs + conteúdo agregado de todos os RDOs)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeVerProjeto, podeGerenciarProjeto } from '@/lib/auth'
import { calcPctPlanejado, calcProgressoPonderado } from '@/lib/rdo-display'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx
  const projetoId = (await params).id

  const projeto = await prisma.projeto.findFirst({
    where:   { id: projetoId, tenantId },
    include: { gestor: { select: { id: true, nome: true } } },
  })
  if (!projeto) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeVerProjeto(acessoProjeto)) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }
  const podeGerenciar = podeGerenciarProjeto(acessoProjeto)

  const atividades = await prisma.atividade.findMany({
    where:  { etapa: { projetoId } },
    select: { pctAcumulado: true, dataInicio: true, dataFim: true },
  })
  const totalAtividades = atividades.length
  const pctReal = calcProgressoPonderado(atividades as any[])
  const pctPlanejado = calcPctPlanejado(atividades as any[])

  const rdos = await prisma.rdo.findMany({
    where: { projetoId },
    select: {
      id: true, numero: true, data: true, status: true,
      climaManha: true, climaTarde: true, climaNoite: true, precipitacaoMm: true, climaImpacto: true,
      assinaturas: { select: { status: true } },
      midias: { select: { id: true, tipo: true, url: true, nomeArq: true, descricao: true } },
      ocorrencias: { select: { id: true, tipo: true, descricao: true, resolvida: true } },
      maoDeObra: { select: { funcaoNome: true, quantidade: true, horaEntrada: true, horaSaida: true, totalHH: true } },
      equipamentos: { select: { equipamentoNome: true, quantidade: true, observacao: true } },
      atividadeRegistros: {
        select: {
          id: true, pctAnterior: true, pctAtual: true, deltaHoje: true,
          atividade: { select: { nome: true } },
        },
      },
      comentarios: {
        where: { parentId: null },
        select: {
          id: true, texto: true, criadoEm: true,
          autor: { select: { nome: true } },
          _count: { select: { respostas: true } },
        },
      },
    },
    orderBy: { data: 'desc' },
  })

  const fotos: any[] = []
  const videos: any[] = []
  const anexos: any[] = []
  const atividadesFeed: any[] = []
  const ocorrenciasFeed: any[] = []
  const comentariosFeed: any[] = []
  const clima: any[] = []
  const maoDeObraFeed: any[] = []
  const equipamentosFeed: any[] = []
  let ocorrenciasAbertas = 0
  let totalHH = 0

  for (const r of rdos as any[]) {
    for (const m of r.midias) {
      const item = { id: m.id, url: m.url, nomeArq: m.nomeArq, descricao: m.descricao, rdoId: r.id, rdoNumero: r.numero, rdoData: r.data }
      if (m.tipo === 'FOTO') fotos.push(item)
      else if (m.tipo === 'VIDEO') videos.push(item)
      else anexos.push(item)
    }
    for (const oc of r.ocorrencias) {
      if (!oc.resolvida) ocorrenciasAbertas++
      ocorrenciasFeed.push({ ...oc, rdoId: r.id, rdoNumero: r.numero, rdoData: r.data })
    }
    for (const reg of r.atividadeRegistros) {
      atividadesFeed.push({
        id: reg.id, nome: reg.atividade?.nome ?? '(atividade removida)',
        pctAnterior: reg.pctAnterior, pctAtual: reg.pctAtual, deltaHoje: reg.deltaHoje,
        rdoId: r.id, rdoNumero: r.numero, rdoData: r.data,
      })
    }
    for (const c of r.comentarios) {
      comentariosFeed.push({
        id: c.id, texto: c.texto, criadoEm: c.criadoEm, autorNome: c.autor.nome,
        totalRespostas: c._count.respostas, rdoId: r.id, rdoNumero: r.numero, rdoData: r.data,
      })
    }
    for (const mo of r.maoDeObra) {
      // mo.totalHH vem como Prisma Decimal — Number() evita concatenar como string
      totalHH += Number(mo.totalHH)
      maoDeObraFeed.push({ ...mo, rdoId: r.id, rdoNumero: r.numero, rdoData: r.data })
    }
    for (const eq of r.equipamentos) {
      equipamentosFeed.push({ ...eq, rdoId: r.id, rdoNumero: r.numero, rdoData: r.data })
    }
    if (r.climaManha || r.climaTarde || r.climaNoite || r.precipitacaoMm != null) {
      clima.push({
        rdoId: r.id, rdoNumero: r.numero, rdoData: r.data,
        climaManha: r.climaManha, climaTarde: r.climaTarde, climaNoite: r.climaNoite,
        precipitacaoMm: r.precipitacaoMm, climaImpacto: r.climaImpacto,
      })
    }
  }

  // Prévia dos RDOs mais recentes para a visão geral (já vem ordenado desc por data)
  const rdosRecentes = (rdos as any[]).slice(0, 8).map(r => ({
    id: r.id, numero: r.numero, data: r.data, status: r.status,
    assinaturas: r.assinaturas,
    totalFotos: r.midias.filter((m: any) => m.tipo === 'FOTO').length,
  }))

  return NextResponse.json({
    projeto: {
      id: projeto.id, nome: projeto.nome, descricao: projeto.descricao,
      pedidoCompraContrato: projeto.pedidoCompraContrato,
      empresaContratada: projeto.empresaContratada,
      status: projeto.status, grupo: projeto.grupo, fotoUrl: projeto.fotoUrl, cor: projeto.cor,
      dataInicioContrato: projeto.dataInicioContrato, dataFimContrato: projeto.dataFimContrato,
      gestor: projeto.gestor,
      podeGerenciar,
    },
    kpis: {
      totalRdos: rdos.length,
      pctReal, pctPlanejado, desvio: pctReal - pctPlanejado,
      ocorrenciasAbertas, totalHH: Math.round(totalHH * 100) / 100,
    },
    rdosRecentes,
    fotos, videos, anexos,
    atividades: atividadesFeed,
    ocorrencias: ocorrenciasFeed,
    comentarios: comentariosFeed,
    clima,
    maoDeObra: maoDeObraFeed,
    equipamentos: equipamentosFeed,
  })
}
