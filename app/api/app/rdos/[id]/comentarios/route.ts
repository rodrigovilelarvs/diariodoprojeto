// src/api/app/rdos/[id]/comentarios/route.ts
// POST /api/app/rdos/:id/comentarios — adicionar comentário (ou resposta) ao RDO

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, resolverAcessoProjeto, podeVerProjeto } from '@/lib/auth'
import { LogCategoria } from '@/lib/prisma-enums'
import { enviarEmailSeguro, enviarComentarioRdo } from '@/lib/email'
import { filtrarEEnfileirar } from '@/lib/notificacoes'
import { numeroRdo } from '@/lib/format'

type Params = { params: Promise<{ id: string }> }

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — corresponde ao `select` da busca do RDO logo abaixo.
type Pessoa = { id: string; nome: string; email: string }
type RdoParaComentario = {
  id: string; numero: number; emissorId: string; projetoId: string
  projeto: { nome: string }
  emissor: Pessoa
  assinaturas: Array<{ usuario: Pessoa }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const rdoId = (await params).id

  const rdo: RdoParaComentario | null = await prisma.rdo.findFirst({
    where:  { id: rdoId, projeto: { tenantId } },
    select: {
      id: true, numero: true, emissorId: true, projetoId: true,
      projeto: { select: { nome: true } },
      emissor: { select: { id: true, nome: true, email: true } },
      assinaturas: {
        where:  { status: 'PENDENTE' },
        select: { usuario: { select: { id: true, nome: true, email: true } } },
      },
    },
  })
  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  // Projeto com acesso restrito: quem não foi liberado não vê nem comenta
  const acessoProjeto = await resolverAcessoProjeto(rdo.projetoId, auth.ctx)
  if (!podeVerProjeto(acessoProjeto)) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  let body: { texto?: string; parentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.texto?.trim()) {
    return NextResponse.json({ erro: 'Texto do comentário é obrigatório.' }, { status: 400 })
  }

  if (body.parentId) {
    const parent = await prisma.comentario.findFirst({ where: { id: body.parentId, rdoId } })
    if (!parent) {
      return NextResponse.json({ erro: 'Comentário original não encontrado.' }, { status: 404 })
    }
  }

  const comentario = await prisma.comentario.create({
    data: {
      rdoId,
      autorId: usuarioId,
      texto: body.texto.trim(),
      parentId: body.parentId ?? undefined,
    },
    include: {
      autor: { select: { id: true, nome: true, avatarUrl: true } },
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.RDO,
    mensagem:  `Comentário adicionado ao RDO #${rdo.numero}`,
    detalhe:   { rdoId, comentarioId: comentario.id, resposta: !!body.parentId },
    ipAddress, userAgent,
  })

  // Notifica quem precisa saber — mesmo canal usado pra "RDO em revisão", já
  // que pra quem recebe é o mesmo tipo de aviso ("tem algo novo no RDO").
  // Emissor comentou → avisa quem ainda precisa aprovar; qualquer outra
  // pessoa comentou → avisa o emissor. Nunca notifica o próprio autor.
  const alvosBrutos: Pessoa[] = usuarioId === rdo.emissorId
    ? rdo.assinaturas.map((a) => a.usuario)
    : [rdo.emissor]
  const alvos = alvosBrutos.filter((u) => u.id !== usuarioId)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const linkRdo = `${appUrl}/aprovacao/${rdoId}`
  const destinatarios = await filtrarEEnfileirar(alvos, 'emailRdoRejeitado', {
    tipo:   'emailRdoRejeitado',
    titulo: `Novo comentário no RDO #${numeroRdo(rdo.numero)}`,
    resumo: `${comentario.autor.nome}: "${comentario.texto}"`,
    link:   linkRdo,
  })
  if (destinatarios.length > 0) {
    await enviarEmailSeguro(() => enviarComentarioRdo({
      destinatarios: destinatarios.map((d) => ({ email: d.email, nome: d.nome })),
      autorNome: comentario.autor.nome,
      texto:     comentario.texto,
      rdo: {
        numero:  rdo.numero,
        projeto: rdo.projeto.nome,
        link:    linkRdo,
      },
    }))
  }

  return NextResponse.json(comentario, { status: 201 })
}
