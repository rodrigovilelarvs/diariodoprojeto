// src/api/app/rdos/[id]/enviar/route.ts
// POST /api/app/rdos/:id/enviar — enviar RDO para aprovação

import { AssinaturaStatus, LogCategoria, RdoStatus, UsuarioPerfil } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo } from '@/lib/auth'
import { enviarEmailSeguro, enviarRdoParaAprovacao } from '@/lib/email'
import { filtrarEEnfileirar } from '@/lib/notificacoes'
import { numeroRdo } from '@/lib/format'
type Params = { params: Promise<{ id: string }> }

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — corresponde ao SELECT_APROVADOR mais abaixo.
type Aprovador = {
  id: string; nome: string; email: string; funcao: string | null; perfil: string
  assinaturaDigital: { id: string; imagemUrl: string } | null
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const rdoId = (await params).id

  const rdo = await prisma.rdo.findFirst({
    where:   { id: rdoId, projeto: { tenantId } },
    include: {
      projeto: {
        select: {
          nome: true, assinaturaModo: true,
          assinante1Id: true, assinante2Id: true, assinante3Id: true,
        },
      },
      emissor:            { select: { nome: true } },
      atividadeRegistros: { select: { pctAtual: true } },
      maoDeObra:          { select: { totalHH: true } },
    },
  })

  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  if (rdo.status !== RdoStatus.RASCUNHO) {
    return NextResponse.json(
      { erro: `RDO já está com status "${rdo.status}".` },
      { status: 400 },
    )
  }

  const SELECT_APROVADOR = {
    id:     true,
    nome:   true,
    email:  true,
    funcao: true,
    perfil: true,
    assinaturaDigital: { select: { id: true, imagemUrl: true } },
  } as const

  let aprovadores: Aprovador[]

  if (rdo.projeto.assinaturaModo === 'DEFINIDA') {
    // Assinantes pré-definidos pelo projeto (até 3, na ordem configurada)
    const ids = [rdo.projeto.assinante1Id, rdo.projeto.assinante2Id, rdo.projeto.assinante3Id]
      .filter((v): v is string => !!v)
    const encontrados: Aprovador[] = ids.length > 0
      ? await prisma.usuario.findMany({ where: { id: { in: ids }, status: 'ATIVO' }, select: SELECT_APROVADOR })
      : []
    aprovadores = ids
      .map(id => encontrados.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a)
  } else {
    // Modo aberto — administrador, ou quem tem permissão de aprovar RDO
    aprovadores = await prisma.usuario.findMany({
      where: {
        tenantId,
        OR: [{ perfil: UsuarioPerfil.ADMIN }, { permAprovarRdo: true }],
        status: 'ATIVO',
      },
      select: SELECT_APROVADOR,
    })
  }

  await prisma.$transaction(async (tx: any) => {
    // Muda status do RDO
    await tx.rdo.update({
      where: { id: rdoId },
      data:  { status: RdoStatus.PENDENTE_APROVACAO, enviadoEm: new Date() },
    })

    // Cria slots de assinatura para cada aprovador
    for (const apr of aprovadores) {
      // Função cadastrada no perfil da pessoa; sem uma definida, cai pra
      // um rótulo genérico em vez de expor o perfil de acesso (ADMIN/PERSONALIZADO).
      const cargoAtual = apr.funcao?.trim() || (apr.perfil === UsuarioPerfil.ADMIN ? 'Administrador' : 'Colaborador')
      await tx.assinatura.upsert({
        where: {
          rdoId_usuarioId: { rdoId: rdoId, usuarioId: apr.id },
        },
        // Reenvio (só acontece depois de "reabrir", que já reseta todas as
        // assinaturas pra PENDENTE) atualiza o cargo pra função atual da
        // pessoa. Quem já assinou de verdade não passa mais por aqui — a
        // assinatura foi criada antes e o "cargo no momento da assinatura"
        // continua intocado, só é tocado de novo no ato de assinar.
        update: { cargo: cargoAtual },
        create: {
          rdoId:               rdoId,
          usuarioId:           apr.id,
          assinaturaDigitalId: apr.assinaturaDigital?.id ?? undefined,
          status:              apr.assinaturaDigital
            ? AssinaturaStatus.ASSINADO   // já tem assinatura cadastrada → aplica automaticamente
            : AssinaturaStatus.PENDENTE,
          cargo:       cargoAtual,
          assinadoEm: apr.assinaturaDigital ? new Date() : undefined,
          ipAddress,
          userAgent,
        },
      })
    }
  })

  // E-mail só pra quem realmente precisa agir — quem já tinha assinatura
  // cadastrada e foi auto-assinado acima não tem nada pendente pra ver.
  const pendentes = aprovadores.filter((a) => !a.assinaturaDigital)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const linkAprovacao = `${appUrl}/aprovacao/${rdoId}`
  const destinatarios = await filtrarEEnfileirar(pendentes, 'emailRdoEnviado', {
    tipo:   'emailRdoEnviado',
    titulo: `RDO #${numeroRdo(rdo.numero)} aguardando sua aprovação`,
    resumo: `${rdo.projeto.nome} · emitido por ${rdo.emissor.nome}`,
    link:   linkAprovacao,
  })
  if (destinatarios.length > 0) {
    const registros: Array<{ pctAtual: number }> = rdo.atividadeRegistros ?? []
    const pctMedio  = registros.length
      ? Math.round(registros.reduce((s, r) => s + r.pctAtual, 0) / registros.length)
      : 0
    const maoDeObra: Array<{ totalHH: number }> = rdo.maoDeObra ?? []
    const totalHH = maoDeObra.reduce((s, m) => s + Number(m.totalHH), 0)

    await enviarEmailSeguro(() => enviarRdoParaAprovacao({
      aprovadores: destinatarios.map((a) => ({ email: a.email, nome: a.nome })),
      rdo: {
        numero:   rdo.numero,
        data:     rdo.data.toISOString(),
        projeto:  rdo.projeto.nome,
        emissor:  rdo.emissor.nome,
        pctMedio,
        totalHH,
        link:     linkAprovacao,
      },
    }))
  }

  await registrarLog({
    tenantId,
    usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${rdo.numero} enviado para aprovação — projeto "${rdo.projeto.nome}"`,
    detalhe:   {
      rdoId:      rdoId,
      aprovadores: aprovadores.map((a) => a.email),
    },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({
    ok:          true,
    status:      RdoStatus.PENDENTE_APROVACAO,
    aprovadores: aprovadores.length,
  })
}
