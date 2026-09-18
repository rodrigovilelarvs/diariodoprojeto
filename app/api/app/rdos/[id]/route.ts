// src/api/app/rdos/[id]/route.ts
// GET    /api/app/rdos/:id  — buscar RDO completo
// PATCH  /api/app/rdos/:id  — salvar rascunho / atualizar campos
// DELETE /api/app/rdos/:id  — excluir (rascunho por quem emite; qualquer status por quem aprova)

import { LogCategoria, LogNivel, RdoStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, podeAprovarRdo, resolverAcessoProjeto, podeVerProjeto, podeEditarProjetoConteudo } from '@/lib/auth'
type Params = { params: Promise<{ id: string }> }

// ── GET ─────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx

  const rdo = await prisma.rdo.findFirst({
    where: {
      id:      (await params).id,
      projeto: { tenantId },
    },
    include: {
      projeto: {
        select: {
          id: true, nome: true,
          dataInicioContrato: true,
          dataFimContrato:    true,
          pedidoCompraContrato: true,
          empresaContratada: true,
          assinaturaModo: true,
          assinante1: { select: { id: true, nome: true, email: true, perfil: true } },
          assinante2: { select: { id: true, nome: true, email: true, perfil: true } },
          assinante3: { select: { id: true, nome: true, email: true, perfil: true } },
        },
      },
      emissor:  { select: { id: true, nome: true } },
      atividadeRegistros: {
        include: {
          atividade: {
            include: { etapa: { select: { numero: true, nome: true } } },
          },
        },
        orderBy: { criadoEm: 'asc' },
      },
      maoDeObra:   { include: { funcaoCadastro: true } },
      equipamentos: { include: { equipamentoCadastro: true } },
      ocorrencias:  { orderBy: { horaInicio: 'asc' } },
      midias:       { orderBy: { ordem: 'asc' } },
      comentarios: {
        where:   { parentId: null },  // apenas comentários raiz
        include: {
          autor:    { select: { id: true, nome: true, avatarUrl: true } },
          respostas: {
            include: {
              autor: { select: { id: true, nome: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { criadoEm: 'asc' },
      },
      assinaturas: {
        include: {
          usuario: { select: { id: true, nome: true, perfil: true } },
          assinaturaDigital: { select: { imagemUrl: true } },
        },
      },
      aprovacoes: {
        include: {
          aprovador: { select: { id: true, nome: true, perfil: true } },
        },
        orderBy: { aprovadoEm: 'asc' },
      },
    },
  })

  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(rdo.projeto.id, auth.ctx)
  if (!podeVerProjeto(acessoProjeto)) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  // Registra a visualização (uma vez por usuário, pro contador "Visualizações")
  const rdoId = (await params).id
  const jaVisualizou = await prisma.logAuditoria.findFirst({
    where: {
      tenantId, usuarioId,
      categoria: LogCategoria.RDO,
      AND: [
        { detalhe: { contains: `"tipo":"visualizacao"` } },
        { detalhe: { contains: `"rdoId":"${rdoId}"` } },
      ],
    },
  })
  if (!jaVisualizou) {
    await registrarLog({
      tenantId, usuarioId,
      categoria: LogCategoria.RDO,
      mensagem:  `RDO #${rdo.numero} visualizado`,
      detalhe:   { rdoId, tipo: 'visualizacao' },
    })
  }

  return NextResponse.json(rdo)
}

// ── PATCH — salvar rascunho ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const rdo = await prisma.rdo.findFirst({
    where: { id: (await params).id, projeto: { tenantId } },
  })

  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(rdo.projetoId, auth.ctx)
  if (!podeEditarProjetoConteudo(acessoProjeto)) {
    return NextResponse.json({ erro: 'Você não tem permissão de edição neste projeto.' }, { status: 403 })
  }

  if (rdo.status === RdoStatus.APROVADO) {
    return NextResponse.json(
      { erro: 'RDO aprovado não pode ser editado.' },
      { status: 400 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  // Campos editáveis do cabeçalho do RDO
  const {
    numero, data,
    horaInicio, horaTermino, intervaloHoras, totalHoras,
    climaManha, climaTarde, climaNoite, precipitacaoMm, climaImpacto,
    observacoes,
    // Arrays — tratados separadamente
    atividadeRegistros, maoDeObra, equipamentos,
    ocorrencias,
  } = body as Record<string, unknown>

  if (numero != null) {
    const novoNumero = Number(numero)
    if (!Number.isInteger(novoNumero) || novoNumero < 1) {
      return NextResponse.json({ erro: 'Número do RDO inválido.' }, { status: 400 })
    }
    const conflito = await prisma.rdo.findFirst({
      where: { projetoId: rdo.projetoId, numero: novoNumero, NOT: { id: (await params).id } },
    })
    if (conflito) {
      return NextResponse.json({ erro: `Já existe um RDO #${novoNumero} neste projeto.` }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx: any) => {
    // Atualiza cabeçalho
    await tx.rdo.update({
      where: { id: (await params).id },
      data: {
        ...(numero != null && { numero: Number(numero) }),
        ...(data   != null && { data: new Date(String(data)) }),
        ...(horaInicio     != null && { horaInicio:      String(horaInicio) }),
        ...(horaTermino    != null && { horaTermino:     String(horaTermino) }),
        ...(intervaloHoras != null && { intervaloHoras:  Number(intervaloHoras) }),
        ...(totalHoras     != null && { totalHoras:      Number(totalHoras) }),
        ...(climaManha     != null && { climaManha:      climaManha as any }),
        ...(climaTarde     != null && { climaTarde:      climaTarde as any }),
        // climaNoite é opcional e pode ser removido — usa !== undefined para permitir limpar com null
        ...(climaNoite     !== undefined && { climaNoite: climaNoite as any }),
        ...(precipitacaoMm != null && { precipitacaoMm: Number(precipitacaoMm) }),
        ...(climaImpacto   != null && { climaImpacto:   climaImpacto as any }),
        ...(observacoes    != null && { observacoes:     String(observacoes) }),
      },
    })

    // % Acumulado — upsert por atividade (ou create/update por id para avulsas)
    if (Array.isArray(atividadeRegistros)) {
      for (const reg of atividadeRegistros as Array<{
        id?:          string
        atividadeId?: string
        pctAnterior:  number
        pctAtual:     number
        avulsa?:      boolean
        avulsaEtapa?: string
        avulsaNome?:  string
      }>) {
        if (!reg.atividadeId && !reg.avulsa) continue

        const delta = reg.pctAtual - reg.pctAnterior

        if (reg.atividadeId) {
          await tx.registroRdoAtividade.upsert({
            where: {
              rdoId_atividadeId: {
                rdoId:       (await params).id,
                atividadeId: reg.atividadeId,
              },
            },
            update: { pctAtual: reg.pctAtual, deltaHoje: delta },
            create: {
              rdoId:       (await params).id,
              atividadeId: reg.atividadeId,
              pctAnterior: reg.pctAnterior,
              pctAtual:    reg.pctAtual,
              deltaHoje:   delta,
            },
          })

          // Atualiza o campo mestre na atividade
          await tx.atividade.update({
            where: { id: reg.atividadeId },
            data: {
              pctAcumulado: reg.pctAtual,
              status:
                reg.pctAtual >= 100
                  ? 'CONCLUIDA'
                  : reg.pctAtual > 0
                  ? 'EM_ANDAMENTO'
                  : 'NAO_INICIADA',
            },
          })
        } else if (reg.avulsa) {
          // Atividade avulsa — não existe na EAP, fica registrada só neste RDO
          if (reg.id) {
            await tx.registroRdoAtividade.update({
              where: { id: reg.id },
              data: {
                pctAtual: reg.pctAtual, deltaHoje: delta,
                avulsaEtapa: reg.avulsaEtapa, avulsaNome: reg.avulsaNome,
              },
            })
          } else {
            await tx.registroRdoAtividade.create({
              data: {
                rdoId:       (await params).id,
                pctAnterior: reg.pctAnterior,
                pctAtual:    reg.pctAtual,
                deltaHoje:   delta,
                avulsa:      true,
                avulsaEtapa: reg.avulsaEtapa,
                avulsaNome:  reg.avulsaNome,
              },
            })
          }
        }
      }
    }

    // Mão de obra — substitui linhas
    if (Array.isArray(maoDeObra)) {
      await tx.maoDeObra.deleteMany({ where: { rdoId: (await params).id } })
      for (const mo of maoDeObra as Array<{
        funcaoCadastroId?: string
        funcaoNome:        string
        categoria?:        'DIRETA' | 'INDIRETA' | 'TERCEIRIZADO'
        quantidade:        number
        horaEntrada:       string
        horaSaida:         string
        totalHH:           number
      }>) {
        await tx.maoDeObra.create({
          data: {
            rdoId:            (await params).id,
            funcaoCadastroId: mo.funcaoCadastroId ?? undefined,
            funcaoNome:       mo.funcaoNome,
            categoria:        (mo.categoria ?? 'DIRETA') as any,
            quantidade:       mo.quantidade,
            horaEntrada:      mo.horaEntrada,
            horaSaida:        mo.horaSaida,
            totalHH:          mo.totalHH,
          },
        })
      }
    }

    // Equipamentos — substitui linhas
    if (Array.isArray(equipamentos)) {
      await tx.equipamentoUso.deleteMany({ where: { rdoId: (await params).id } })
      for (const eq of equipamentos as Array<{
        equipamentoCadastroId?: string
        equipamentoNome:        string
        quantidade:             number
        observacao?:            string
      }>) {
        await tx.equipamentoUso.create({
          data: {
            rdoId:                 (await params).id,
            equipamentoCadastroId: eq.equipamentoCadastroId ?? undefined,
            equipamentoNome:       eq.equipamentoNome,
            quantidade:            eq.quantidade,
            observacao:            eq.observacao ?? undefined,
          },
        })
      }
    }

    // Ocorrências — substitui
    if (Array.isArray(ocorrencias)) {
      await tx.ocorrencia.deleteMany({ where: { rdoId: (await params).id } })
      for (const oc of ocorrencias as Array<{
        tipo:        string
        horaInicio?: string
        horaTermino?: string
        duracaoMin?: number
        descricao:   string
        responsavel?: string
      }>) {
        await tx.ocorrencia.create({
          data: {
            rdoId:       (await params).id,
            tipo:        oc.tipo        as any,
            horaInicio:  oc.horaInicio  ?? undefined,
            horaTermino: oc.horaTermino ?? undefined,
            duracaoMin:  oc.duracaoMin  ?? undefined,
            descricao:   oc.descricao,
            responsavel: oc.responsavel ?? undefined,
          },
        })
      }
    }
  })

  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${rdo.numero} atualizado (rascunho)`,
    detalhe:   { rdoId: (await params).id },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ ok: true })
}

// ── DELETE — rascunhos por quem emite; qualquer status por quem aprova ─
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeEmitirRdo(auth.ctx) && !podeAprovarRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const rdo = await prisma.rdo.findFirst({
    where:   { id: (await params).id, projeto: { tenantId } },
    include: { projeto: { select: { nome: true } } },
  })

  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const acessoProjeto = await resolverAcessoProjeto(rdo.projetoId, auth.ctx)
  if (!podeEditarProjetoConteudo(acessoProjeto)) {
    return NextResponse.json({ erro: 'Você não tem permissão de edição neste projeto.' }, { status: 403 })
  }

  if (rdo.status === RdoStatus.RASCUNHO) {
    if (!podeEmitirRdo(auth.ctx)) {
      return NextResponse.json({ erro: 'Sem permissão para excluir este RDO.' }, { status: 403 })
    }
  } else if (!podeAprovarRdo(auth.ctx)) {
    return NextResponse.json(
      { erro: 'Apenas quem pode aprovar RDOs pode excluir um RDO já enviado ou aprovado.' },
      { status: 403 },
    )
  }

  await prisma.rdo.delete({ where: { id: (await params).id } })

  await registrarLog({
    tenantId,
    usuarioId,
    nivel:     rdo.status === RdoStatus.RASCUNHO ? LogNivel.INFO : LogNivel.ERRO,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${rdo.numero} (status ${rdo.status}) excluído — projeto "${rdo.projeto.nome}"`,
    detalhe:   { rdoId: (await params).id, status: rdo.status },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ ok: true })
}
