// src/api/app/relatorios/horas/route.ts
// GET /api/app/relatorios/horas?projetoId=&dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&status=APROVADO|TODOS
//
// Horas por dia dos projetos por HOMEM-HORA: para cada data, o tipo do dia (útil, sábado, domingo ou
// feriado), as horas normais e extras e, quando as funções têm valor da hora, o custo. Não há cadastro
// de feriados: um dia de semana com hora extra de 100% marcada no H/H é tratado como feriado. O período é pela
// DATA DO RDO (o dia trabalhado), e por padrão só entram RDOs aprovados — a base da medição.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, podeVerRelatorios, projetosSemAcesso, soVeRdosEnviados, STATUS_RDO_VISIVEIS_AO_VISUALIZADOR } from '@/lib/auth'
import { arredonda2, custoDaLinha, horasNoturnas, numeroOuNull } from '@/lib/homem-hora'
import { infoDoDia } from '@/lib/feriados'

type RdoHoras = {
  data: Date
  projeto: { id: string; nome: string }
  maoDeObra: Array<{
    funcaoNome: string; quantidade: number; horaEntrada: string; horaSaida: string; totalHH: unknown; tipoHora: string; percentualExtra: number | null
    funcaoCadastro: { valorHora: unknown } | null
  }>
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  if (!podeVerRelatorios(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para ver relatórios.' }, { status: 403 })
  }
  const { tenantId } = auth.ctx
  const q = req.nextUrl.searchParams

  const hoje = new Date()
  const padraoInicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const padraoFim = hoje.toISOString().slice(0, 10)
  const dataInicio = /^\d{4}-\d{2}-\d{2}$/.test(q.get('dataInicio') ?? '') ? q.get('dataInicio')! : padraoInicio
  const dataFim = /^\d{4}-\d{2}-\d{2}$/.test(q.get('dataFim') ?? '') ? q.get('dataFim')! : padraoFim
  const projetoId = q.get('projetoId') || undefined
  const todos = q.get('status') === 'TODOS'

  const ocultos = await projetosSemAcesso(tenantId, auth.ctx)
  if (projetoId && ocultos.includes(projetoId)) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  // Aprovados (padrão: medição) ou todos os RDOs; o visualizador só enxerga enviados/aprovados de qualquer forma
  const filtroStatus = todos
    ? (soVeRdosEnviados(auth.ctx) ? { status: { in: STATUS_RDO_VISIVEIS_AO_VISUALIZADOR } } : {})
    : { status: 'APROVADO' }

  const rdos: RdoHoras[] = await prisma.rdo.findMany({
    where: {
      ...filtroStatus,
      projeto: {
        tenantId, modalidade: 'HOMEM_HORA',
        ...(projetoId ? { id: projetoId } : ocultos.length > 0 ? { id: { notIn: ocultos } } : {}),
      },
      data: { gte: new Date(dataInicio), lte: new Date(dataFim) },
    },
    select: {
      data: true,
      projeto: { select: { id: true, nome: true } },
      maoDeObra: {
        select: {
          funcaoNome: true, quantidade: true, horaEntrada: true, horaSaida: true, totalHH: true, tipoHora: true, percentualExtra: true,
          funcaoCadastro: { select: { valorHora: true } },
        },
      },
    },
    orderBy: { data: 'asc' },
  })

  const semValor = new Set<string>()

  type Linha = { funcao: string; projeto: string; quantidade: number; tipoHora: string; percentualExtra: number | null; horas: number; noturnas: number; valor: number | null }
  const porDia = new Map<string, { normais: number; extras: number; noturnas: number; pessoas: number; valor: number; temValor: boolean; linhas: Linha[] }>()

  for (const r of rdos) {
    const dia = r.data.toISOString().slice(0, 10)
    if (r.maoDeObra.length === 0) continue // RDO sem mão de obra não tem horas: não vira linha do relatório
    const acc = porDia.get(dia) ?? { normais: 0, extras: 0, noturnas: 0, pessoas: 0, valor: 0, temValor: false, linhas: [] }
    for (const mo of r.maoDeObra) {
      const horas = Number(mo.totalHH)
      const noturnas = horasNoturnas(mo.horaEntrada, mo.horaSaida, mo.quantidade)
      const valor = custoDaLinha(horas, numeroOuNull(mo.funcaoCadastro?.valorHora), mo.tipoHora, mo.percentualExtra, noturnas)
      if (mo.tipoHora === 'EXTRA') acc.extras += horas; else acc.normais += horas
      acc.noturnas += noturnas
      acc.pessoas += mo.quantidade
      if (valor == null) semValor.add(mo.funcaoNome); else { acc.valor += valor; acc.temValor = true }
      acc.linhas.push({ funcao: mo.funcaoNome, projeto: r.projeto.nome, quantidade: mo.quantidade, tipoHora: mo.tipoHora, percentualExtra: mo.percentualExtra, horas: arredonda2(horas), noturnas: arredonda2(noturnas), valor })
    }
    porDia.set(dia, acc)
  }

  const dias = Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([data, a]) => {
    const info = infoDoDia(data)
    // dia de semana com hora extra de 100% (ou mais) = feriado, conforme marcado por quem preencheu o RDO
    const feriado = info.tipo === 'UTIL' && a.linhas.some((l) => l.tipoHora === 'EXTRA' && (l.percentualExtra ?? 0) >= 100)
    return {
      data, diaSemana: info.diaSemana, tipoDia: feriado ? 'FERIADO' : info.tipo,
      pessoas: a.pessoas, normais: arredonda2(a.normais), extras: arredonda2(a.extras), noturnas: arredonda2(a.noturnas), total: arredonda2(a.normais + a.extras),
      valor: a.temValor ? arredonda2(a.valor) : null, linhas: a.linhas,
    }
  })

  const soma = (f: (d: (typeof dias)[number]) => number) => arredonda2(dias.reduce((s, d) => s + f(d), 0))
  const doTipo = (tipo: string) => dias.filter((d) => d.tipoDia === tipo)
  const horasDe = (lista: typeof dias) => arredonda2(lista.reduce((s, d) => s + d.total, 0))

  return NextResponse.json({
    periodo: { dataInicio, dataFim }, status: todos ? 'TODOS' : 'APROVADO',
    dias,
    totais: {
      dias: dias.length, normais: soma(d => d.normais), extras: soma(d => d.extras), noturnas: soma(d => d.noturnas), total: soma(d => d.total),
      sabados: horasDe(doTipo('SABADO')), domingos: horasDe(doTipo('DOMINGO')), feriados: horasDe(doTipo('FERIADO')),
      valor: dias.some(d => d.valor != null) ? soma(d => d.valor ?? 0) : null,
    },
    funcoesSemValor: Array.from(semValor).sort(),
  })
}
