// src/api/app/rdos/route.ts
// GET  /api/app/rdos  — listar RDOs do tenant
// POST /api/app/rdos  — criar novo RDO

import { AtividadeStatus, LogCategoria, LogNivel, RdoStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, podeGerenciarProjetos, resolverAcessoProjeto, podeEditarProjetoConteudo } from '@/lib/auth'
// ── GET — lista RDOs ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { searchParams } = new URL(req.url)

  const projetoId = searchParams.get('projetoId') ?? undefined
  const status    = searchParams.get('status')    as RdoStatus | null
  const pagina    = Number(searchParams.get('pagina')  ?? 1)
  const por       = Number(searchParams.get('por')     ?? 20)
  const sortBy    = searchParams.get('sortBy')  ?? 'numero'
  const sortDir   = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const dataParam = searchParams.get('data') ?? undefined

  const orderBy: any =
    sortBy === 'projeto' ? [{ projeto: { nome: sortDir } }] :
    sortBy === 'gestor'  ? [{ emissor: { nome: sortDir } }] :
    sortBy === 'status'  ? [{ status: sortDir }, { data: 'desc' }] :
    sortBy === 'data'    ? [{ data: sortDir }, { numero: sortDir }] :
    // padrão (e clique em "#"): número do RDO, com a data como desempate
    [{ numero: sortDir }, { data: sortDir }]

  // Projetos com acesso restrito que este usuário não integra ficam de fora
  let projetosExcluidos: string[] = []
  if (!podeGerenciarProjetos(auth.ctx)) {
    const todosProjetos = await prisma.projeto.findMany({ where: { tenantId }, select: { id: true } })
    const acessos = await prisma.projetoAcesso.findMany({
      where:  { projetoId: { in: todosProjetos.map((p: any) => p.id) } },
      select: { projetoId: true, usuarioId: true },
    })
    const restritos: Set<string> = new Set(acessos.map((a: any) => a.projetoId as string))
    const meus: Set<string> = new Set(acessos.filter((a: any) => a.usuarioId === usuarioId).map((a: any) => a.projetoId as string))
    projetosExcluidos = Array.from(restritos).filter((id: string) => !meus.has(id))
  }

  if (projetoId && projetosExcluidos.includes(projetoId)) {
    return NextResponse.json({ rdos: [], total: 0, pagina, por })
  }

  const whereBase = {
    projeto: { tenantId },
    ...(projetoId ? { projetoId } : projetosExcluidos.length > 0 ? { projetoId: { notIn: projetosExcluidos } } : {}),
    ...(status    ? { status }    : {}),
    ...(dataParam ? { data: new Date(dataParam) } : {}),
  }

  const rdos = await prisma.rdo.findMany({
    where: whereBase,
    include: {
      projeto:  { select: { id: true, nome: true } },
      emissor:  { select: { id: true, nome: true } },
      assinaturas: { select: { status: true } },
      _count:   { select: { midias: true, comentarios: true, ocorrencias: true } },
    },
    orderBy,
    skip:  (pagina - 1) * por,
    take:  por,
  })

  const total = await prisma.rdo.count({ where: whereBase })

  return NextResponse.json({ rdos, total, pagina, por })
}

// ── POST — criar RDO ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json(
      { erro: 'Sem permissão para criar RDOs.' },
      { status: 403 },
    )
  }

  let body: {
    projetoId: string
    data:      string
    copiarAnterior?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { projetoId, data, copiarAnterior = true } = body

  if (!projetoId || !data) {
    return NextResponse.json(
      { erro: 'projetoId e data são obrigatórios.' },
      { status: 400 },
    )
  }

  // Verifica se o projeto pertence ao tenant
  const projeto = await prisma.projeto.findFirst({
    where: { id: projetoId, tenantId },
  })

  if (!projeto) {
    return NextResponse.json(
      { erro: 'Projeto não encontrado.' },
      { status: 404 },
    )
  }

  const acessoProjeto = await resolverAcessoProjeto(projetoId, auth.ctx)
  if (!podeEditarProjetoConteudo(acessoProjeto)) {
    return NextResponse.json(
      { erro: 'Você não tem permissão de edição neste projeto.' },
      { status: 403 },
    )
  }

  // Verifica limite mensal de RDOs
  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { limiteRdosMes: true },
  })

  if (tenant && tenant.limiteRdosMes > 0) {
    const inicio = new Date()
    inicio.setDate(1)
    inicio.setHours(0, 0, 0, 0)

    const rdosNoMes = await prisma.rdo.count({
      where: {
        projeto: { tenantId },
        criadoEm: { gte: inicio },
      },
    })

    if (rdosNoMes >= tenant.limiteRdosMes) {
      await registrarLog({
        tenantId,
        usuarioId,
        nivel:     LogNivel.AVISO,
        categoria: LogCategoria.RDO,
        mensagem:  `Limite de RDOs atingido (${rdosNoMes}/${tenant.limiteRdosMes})`,
        detalhe:   { projetoId },
        ipAddress,
        userAgent,
      })

      return NextResponse.json(
        {
          erro: `Limite mensal de ${tenant.limiteRdosMes} RDOs atingido. Faça upgrade do plano.`,
          codigo: 'LIMITE_RDO',
        },
        { status: 402 },
      )
    }
  }

  // Próximo número sequencial
  const ultimo = await prisma.rdo.findFirst({
    where:   { projetoId },
    orderBy: { numero: 'desc' },
    select:  { numero: true },
  })
  const numero = (ultimo?.numero ?? 0) + 1

  // Busca RDO anterior para cópia
  const rdoAnterior = copiarAnterior
    ? await prisma.rdo.findFirst({
        where:   { projetoId, status: { in: ['APROVADO', 'PENDENTE_APROVACAO'] } },
        orderBy: { numero: 'desc' },
        include: {
          atividadeRegistros: {
            include: { atividade: true },
          },
          maoDeObra:   true,
          equipamentos: true,
        },
      })
    : null

  // Cria o RDO numa transação
  const rdo = await prisma.$transaction(async (tx: any) => {
    const novoRdo = await tx.rdo.create({
      data: {
        projetoId,
        emissorId: usuarioId,
        numero,
        data:   new Date(data),
        status: RdoStatus.RASCUNHO,
        // Copia horários do anterior
        horaInicio:    rdoAnterior?.horaInicio    ?? undefined,
        horaTermino:   rdoAnterior?.horaTermino   ?? undefined,
        intervaloHoras: rdoAnterior?.intervaloHoras ?? undefined,
        totalHoras:    rdoAnterior?.totalHoras    ?? undefined,
      },
    })

    if (rdoAnterior) {
      // Copia atividades EM ANDAMENTO (não copia concluídas)
      const atividadesParaCopiar = rdoAnterior.atividadeRegistros.filter(
        (r: any) => r.atividade.status !== AtividadeStatus.CONCLUIDA,
      )

      for (const reg of atividadesParaCopiar) {
        await tx.registroRdoAtividade.create({
          data: {
            rdoId:        novoRdo.id,
            atividadeId:  reg.atividadeId,
            pctAnterior:  reg.pctAtual,   // % do RDO anterior vira "anterior"
            pctAtual:     reg.pctAtual,   // começa igual (delta = 0)
            deltaHoje:    0,
            avulsa:       reg.avulsa,
            avulsaEtapa:  reg.avulsaEtapa ?? undefined,
            avulsaNome:   reg.avulsaNome  ?? undefined,
          },
        })
      }

      // Copia mão de obra
      for (const mo of rdoAnterior.maoDeObra) {
        await tx.maoDeObra.create({
          data: {
            rdoId:               novoRdo.id,
            funcaoCadastroId:    mo.funcaoCadastroId ?? undefined,
            funcaoNome:          mo.funcaoNome,
            quantidade:          mo.quantidade,
            horaEntrada:         mo.horaEntrada,
            horaSaida:           mo.horaSaida,
            totalHH:             mo.totalHH,
          },
        })
      }

      // Copia equipamentos
      for (const eq of rdoAnterior.equipamentos) {
        await tx.equipamentoUso.create({
          data: {
            rdoId:                    novoRdo.id,
            equipamentoCadastroId:    eq.equipamentoCadastroId ?? undefined,
            equipamentoNome:          eq.equipamentoNome,
            quantidade:               eq.quantidade,
            observacao:               eq.observacao ?? undefined,
          },
        })
      }
    }

    return novoRdo
  })

  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${numero} criado no projeto "${projeto.nome}"`,
    detalhe:   { rdoId: rdo.id, projetoId, copiado: !!rdoAnterior },
    ipAddress,
    userAgent,
  })

  // Retorna RDO criado com dados de contexto para o front. Inclui as
  // relações vazias (ocorrencias/midias/comentarios/assinaturas) pra que o
  // objeto pré-carregado no cache do detalhe tenha a mesma forma do GET.
  const rdoCompleto = await prisma.rdo.findUnique({
    where:   { id: rdo.id },
    include: {
      projeto:            { select: { id: true, nome: true, dataInicioContrato: true, dataFimContrato: true } },
      emissor:            { select: { id: true, nome: true } },
      atividadeRegistros: { include: { atividade: { include: { etapa: true } } } },
      maoDeObra:          true,
      equipamentos:       true,
      ocorrencias:        true,
      midias:             true,
      comentarios:        true,
      assinaturas:        true,
      aprovacoes:         true,
    },
  })

  return NextResponse.json(rdoCompleto, { status: 201 })
}
