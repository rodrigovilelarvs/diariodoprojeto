// app/api/app/rdos/[id]/aprovar/route.ts
// POST /api/app/rdos/:id/aprovar — aprovar ou rejeitar RDO

import { NextRequest, NextResponse }               from 'next/server'
import { prisma, registrarLog, getRequestMeta }    from '@/lib/prisma'
import { requireAuth, podeAprovarRdo }             from '@/lib/auth'
import {
  RdoStatus, AssinaturaStatus, UsuarioPerfil,
  LogCategoria, LogNivel,
}                                                  from '@/lib/prisma-enums'
import {
  enviarEmailSeguro,
  enviarRdoAprovado,
  enviarRdoRejeitado,
}                                                  from '@/lib/email'
import { podeEnviarAgoraOuEnfileirar }              from '@/lib/notificacoes'
import { numeroRdo }                                from '@/lib/format'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent }        = getRequestMeta(req)
  const rdoId                           = (await params).id

  // Apenas quem pode aprovar
  if (!podeAprovarRdo(auth.ctx)) {
    return NextResponse.json(
      { erro: 'Sem permissão para aprovar RDOs.' },
      { status: 403 },
    )
  }

  // Body: aprovado (true/false) + comentário opcional
  let body: { aprovado: boolean; comentario?: string }
  try   { body = await req.json() }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }) }

  if (typeof body.aprovado !== 'boolean') {
    return NextResponse.json(
      { erro: '"aprovado" deve ser true ou false.' },
      { status: 400 },
    )
  }

  // Busca RDO com todos os dados necessários
  const rdo = await prisma.rdo.findFirst({
    where: {
      id:      rdoId,
      projeto: { tenantId },
      status:  RdoStatus.PENDENTE_APROVACAO,
    },
    include: {
      projeto: { select: { nome: true } },
      emissor: { select: { id: true, nome: true, email: true } },
      assinaturas: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      },
    },
  })

  if (!rdo) {
    return NextResponse.json(
      { erro: 'RDO não encontrado ou não está pendente de aprovação.' },
      { status: 404 },
    )
  }

  // Verifica se este usuário é um aprovador registrado no RDO
  const assinaturasRdo: Array<{ id: string; status: string; usuario: { id: string } }> = rdo.assinaturas
  const minhaAssinatura = assinaturasRdo.find((a) => a.usuario.id === usuarioId)

  if (!minhaAssinatura) {
    return NextResponse.json(
      { erro: 'Você não é um aprovador registrado neste RDO.' },
      { status: 403 },
    )
  }

  if (minhaAssinatura.status === AssinaturaStatus.ASSINADO) {
    return NextResponse.json(
      { erro: 'Você já assinou este RDO.' },
      { status: 400 },
    )
  }

  // Busca dados do aprovador atual
  const aprovador = await prisma.usuario.findUnique({
    where:  { id: usuarioId },
    select: { nome: true, email: true, funcao: true, perfil: true },
  })
  // Cargo assinado sempre reflete a função cadastrada NESTE momento — não a
  // que existia quando o RDO foi enviado pra aprovação (podem ter passado
  // dias entre o envio e a pessoa realmente assinar).
  const cargoAtual = aprovador?.funcao?.trim()
    || (aprovador?.perfil === UsuarioPerfil.ADMIN ? 'Administrador' : 'Colaborador')

  // A aprovação é feita assinando — exige assinatura digital já cadastrada
  // em "Meu perfil" (sem ela não há o que aplicar na Assinatura do RDO).
  let assinaturaDigital: { id: string } | null = null
  if (body.aprovado) {
    assinaturaDigital = await prisma.assinaturaDigital.findUnique({
      where:  { usuarioId },
      select: { id: true },
    })
    if (!assinaturaDigital) {
      return NextResponse.json(
        {
          erro: 'Cadastre sua assinatura digital em "Meu perfil" antes de assinar este RDO.',
          codigo: 'SEM_ASSINATURA_CADASTRADA',
        },
        { status: 400 },
      )
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ── REJEIÇÃO ────────────────────────────────────────────
  if (!body.aprovado) {
    await prisma.$transaction(async (tx: any) => {
      // Muda status do RDO para REJEITADO
      await tx.rdo.update({
        where: { id: rdoId },
        data:  { status: RdoStatus.REJEITADO },
      })

      // Registra a rejeição
      await tx.rdoAprovacao.create({
        data: {
          rdoId,
          aprovadorId: usuarioId,
          aprovado:    false,
          comentario:  body.comentario,
        },
      })

      // Adiciona comentário na thread se houver
      if (body.comentario) {
        await tx.comentario.create({
          data: {
            rdoId,
            autorId: usuarioId,
            texto:   `❌ Revisão solicitada: ${body.comentario}`,
          },
        })
      }
    })

    // Notifica o emissor (se ele quiser receber esse tipo de e-mail — se
    // estiver no modo resumo diário, isso só enfileira e manda à noite)
    if (await podeEnviarAgoraOuEnfileirar(rdo.emissor.id, 'emailRdoRejeitado', {
      tipo:   'emailRdoRejeitado',
      titulo: `RDO #${numeroRdo(rdo.numero)} voltou para revisão`,
      resumo: `${aprovador?.nome ?? 'Um aprovador'} pediu revisão${body.comentario ? `: "${body.comentario}"` : '.'}`,
      link:   `${appUrl}/rdos/${rdoId}`,
    })) {
      await enviarEmailSeguro(() =>
        enviarRdoRejeitado({
          email:         rdo.emissor.email,
          nomeEmissor:   rdo.emissor.nome,
          aprovadorNome: aprovador?.nome ?? 'Aprovador',
          motivo:        body.comentario,
          rdo: {
            numero:  rdo.numero,
            projeto: rdo.projeto.nome,
            data:    rdo.data.toISOString(),
            link:    `${appUrl}/rdos/${rdoId}`,
          },
        }),
      )
    }

    await registrarLog({
      tenantId,
      usuarioId,
      nivel:     LogNivel.AVISO,
      categoria: LogCategoria.RDO,
      mensagem:  `RDO #${rdo.numero} rejeitado por ${aprovador?.nome}`,
      detalhe:   { rdoId, comentario: body.comentario },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      ok:     true,
      status: RdoStatus.REJEITADO,
      mensagem: 'RDO rejeitado. Emissor notificado para revisão.',
    })
  }

  // ── APROVAÇÃO ────────────────────────────────────────────
  // Tudo isso roda na MESMA transação — inclusive a checagem de "todos
  // assinaram" e a virada de status pra APROVADO — pra nenhum GET concorrente
  // conseguir ver o estado inconsistente de "já assinei, mas RDO ainda não
  // virou aprovado" (o que fazia o botão de assinar aparecer de novo).
  let totalAssin = 0
  let assinadas  = 0
  let todosAssinaram = false

  await prisma.$transaction(async (tx: any) => {
    // Marca a assinatura deste aprovador como ASSINADO
    await tx.assinatura.update({
      where: { id: minhaAssinatura.id },
      data: {
        status:     AssinaturaStatus.ASSINADO,
        assinadoEm: new Date(),
        assinaturaDigitalId: assinaturaDigital!.id,
        cargo:      cargoAtual,
        ipAddress,
        userAgent,
      },
    })

    // Registra a aprovação — a assinatura já é a prova; não gera comentário
    // automático na thread (o campo de Comentários fica livre pra
    // observações sobre as atividades do RDO, sem se misturar com isso).
    await tx.rdoAprovacao.create({
      data: {
        rdoId,
        aprovadorId: usuarioId,
        aprovado:    true,
      },
    })

    // Verifica se todos os aprovadores já assinaram
    const assinaturasAtual: Array<{ status: string }> = await tx.assinatura.findMany({
      where:  { rdoId },
      select: { status: true },
    })
    totalAssin = assinaturasAtual.length
    assinadas  = assinaturasAtual.filter(
      (a) => a.status === AssinaturaStatus.ASSINADO,
    ).length
    todosAssinaram = totalAssin > 0 && assinadas === totalAssin

    // Se todos assinaram → marca como APROVADO, ainda dentro da transação
    if (todosAssinaram) {
      await tx.rdo.update({
        where: { id: rdoId },
        data:  { status: RdoStatus.APROVADO },
      })
    }
  })

  // Se todos assinaram → efeitos colaterais (fora da transação: e-mail e log)
  if (todosAssinaram) {
    // Notifica o emissor (se ele quiser receber esse tipo de e-mail — se
    // estiver no modo resumo diário, isso só enfileira e manda à noite)
    if (await podeEnviarAgoraOuEnfileirar(rdo.emissor.id, 'emailRdoAprovado', {
      tipo:   'emailRdoAprovado',
      titulo: `RDO #${numeroRdo(rdo.numero)} totalmente aprovado`,
      resumo: `${rdo.projeto.nome} — todas as assinaturas foram concluídas.`,
      link:   `${appUrl}/aprovacao/${rdoId}`,
    })) {
      await enviarEmailSeguro(() =>
        enviarRdoAprovado({
          email:       rdo.emissor.email,
          nomeEmissor: rdo.emissor.nome,
          rdo: {
            numero:  rdo.numero,
            projeto: rdo.projeto.nome,
            data:    rdo.data.toISOString(),
            link:    `${appUrl}/aprovacao/${rdoId}`,
          },
        }),
      )
    }

    await registrarLog({
      tenantId,
      usuarioId,
      categoria: LogCategoria.RDO,
      mensagem:  `RDO #${rdo.numero} TOTALMENTE APROVADO (${assinadas}/${totalAssin} assinaturas)`,
      detalhe:   { rdoId, assinadas, total: totalAssin },
      ipAddress,
      userAgent,
    })

    return NextResponse.json({
      ok:           true,
      status:       RdoStatus.APROVADO,
      assinadas,
      total:        totalAssin,
      todosAssinaram: true,
      mensagem:     `RDO #${rdo.numero} totalmente aprovado! Emissor notificado.`,
    })
  }

  // Aprovação parcial — ainda falta(m) assinatura(s)
  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${rdo.numero} aprovado por ${aprovador?.nome} (${assinadas}/${totalAssin})`,
    detalhe:   { rdoId, assinadas, total: totalAssin },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({
    ok:             true,
    status:         RdoStatus.PENDENTE_APROVACAO,
    assinadas,
    total:          totalAssin,
    todosAssinaram: false,
    mensagem:       `Aprovação registrada. Aguardando ${totalAssin - assinadas} aprovador(es).`,
  })
}
