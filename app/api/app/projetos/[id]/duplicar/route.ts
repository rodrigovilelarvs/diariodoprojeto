// src/api/app/projetos/[id]/duplicar/route.ts
// POST /api/app/projetos/:id/duplicar — cria uma cópia do projeto
// body: { comConteudo?: boolean } — false/ausente: só as configurações do projeto;
//                                    true: também copia a estrutura de etapas/atividades (EAP)
// RDOs, ocorrências, comentários, mídias e assinaturas de RDO nunca são copiados —
// são histórico operacional do projeto original, não fazem parte de um "molde".

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarProjetos } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const projetoId = (await params).id

  if (!podeGerenciarProjetos(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para criar projetos.' }, { status: 403 })
  }

  const original = await prisma.projeto.findFirst({
    where: { id: projetoId, tenantId },
    include: { etapas: { include: { atividades: true }, orderBy: { ordem: 'asc' } } },
  })
  if (!original) {
    return NextResponse.json({ erro: 'Projeto não encontrado.' }, { status: 404 })
  }

  let body: { comConteudo?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    // corpo vazio é aceitável — comConteudo default false
  }

  // Mesmo limite de plano aplicado à criação normal de projeto
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { limiteProjetos: true } })
  if (tenant && tenant.limiteProjetos > 0) {
    const totalProjetos = await prisma.projeto.count({ where: { tenantId, status: 'ATIVO' } })
    if (totalProjetos >= tenant.limiteProjetos) {
      return NextResponse.json(
        { erro: `Limite de ${tenant.limiteProjetos} projetos ativos atingido. Faça upgrade do plano.`, codigo: 'LIMITE_PROJETO' },
        { status: 402 },
      )
    }
  }

  const copia = await prisma.projeto.create({
    data: {
      tenantId,
      nome:                 `${original.nome} (cópia)`,
      descricao:            original.descricao,
      pedidoCompraContrato: original.pedidoCompraContrato,
      empresaContratada:    original.empresaContratada,
      grupo:                original.grupo,
      fotoUrl:              original.fotoUrl,
      cor:                  original.cor,
      dataInicioContrato:   original.dataInicioContrato,
      dataFimContrato:      original.dataFimContrato,
      gestorId:             original.gestorId,
      status:               'NAO_INICIADO',
      assinaturaModo:       original.assinaturaModo,
      assinante1Id:         original.assinante1Id,
      assinante2Id:         original.assinante2Id,
      assinante3Id:         original.assinante3Id,
      ...(body.comConteudo && {
        etapas: {
          create: original.etapas.map((etapa: any) => ({
            numero: etapa.numero,
            nome:   etapa.nome,
            ordem:  etapa.ordem,
            atividades: {
              create: etapa.atividades.map((a: any) => ({
                numero:       a.numero,
                nome:         a.nome,
                ordem:        a.ordem,
                dataInicio:   a.dataInicio,
                dataFim:      a.dataFim,
                // status e pctAcumulado ficam no padrão (não iniciada / 0%) — a cópia começa do zero
              })),
            },
          })),
        },
      }),
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Projeto "${original.nome}" duplicado como "${copia.nome}"${body.comConteudo ? ' (com conteúdo)' : ''}`,
    detalhe:   { projetoOrigemId: projetoId, projetoNovoId: copia.id, comConteudo: !!body.comConteudo },
    ipAddress, userAgent,
  })

  return NextResponse.json(copia, { status: 201 })
}
