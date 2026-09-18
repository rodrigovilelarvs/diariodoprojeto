// src/api/app/usuarios/:id/notificacoes/route.ts
// GET   /api/app/usuarios/:id/notificacoes — preferências de e-mail de um usuário (visto pelo admin)
// PATCH /api/app/usuarios/:id/notificacoes — o admin ajusta em nome do usuário
//
// Visão administrativa da mesma tabela usada pelo autoatendimento em
// /api/app/notificacoes — cada pessoa continua podendo mexer na própria, e o
// admin também pode configurar aqui (ex.: alguém que ainda não passou por lá).

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeGerenciarEquipe } from '@/lib/auth'
import { formatarPreferencias, PADRAO_PREFERENCIAS, MODO_PADRAO, type PreferenciasEmail } from '@/lib/notificacoes'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx
  const alvoId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  const pref = await prisma.preferenciaNotificacao.findUnique({ where: { usuarioId: alvoId } })
  return NextResponse.json(formatarPreferencias(pref))
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const alvoId = (await params).id

  if (!podeGerenciarEquipe(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão para gerenciar usuários.' }, { status: 403 })
  }

  const alvo = await prisma.usuario.findFirst({ where: { id: alvoId, tenantId } })
  if (!alvo) {
    return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 })
  }

  let body: Partial<PreferenciasEmail>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const {
    emailRdoEnviado, emailRdoAprovado, emailRdoRejeitado, emailLembreteDiario,
    emailContratoVencendo, emailConvitePendente, modoNotificacao,
  } = body

  if (modoNotificacao != null && !['IMEDIATO', 'DIGEST_DIARIO'].includes(modoNotificacao)) {
    return NextResponse.json({ erro: 'modoNotificacao inválido.' }, { status: 400 })
  }

  const atualizado = await prisma.preferenciaNotificacao.upsert({
    where:  { usuarioId: alvoId },
    update: {
      ...(emailRdoEnviado       != null && { emailRdoEnviado }),
      ...(emailRdoAprovado      != null && { emailRdoAprovado }),
      ...(emailRdoRejeitado     != null && { emailRdoRejeitado }),
      ...(emailLembreteDiario   != null && { emailLembreteDiario }),
      ...(emailContratoVencendo != null && { emailContratoVencendo }),
      ...(emailConvitePendente  != null && { emailConvitePendente }),
      ...(modoNotificacao       != null && { modoNotificacao }),
    },
    create: {
      usuarioId: alvoId,
      emailRdoEnviado:       emailRdoEnviado       ?? PADRAO_PREFERENCIAS.emailRdoEnviado,
      emailRdoAprovado:      emailRdoAprovado      ?? PADRAO_PREFERENCIAS.emailRdoAprovado,
      emailRdoRejeitado:     emailRdoRejeitado     ?? PADRAO_PREFERENCIAS.emailRdoRejeitado,
      emailLembreteDiario:   emailLembreteDiario   ?? PADRAO_PREFERENCIAS.emailLembreteDiario,
      emailContratoVencendo: emailContratoVencendo ?? PADRAO_PREFERENCIAS.emailContratoVencendo,
      emailConvitePendente:  emailConvitePendente  ?? PADRAO_PREFERENCIAS.emailConvitePendente,
      modoNotificacao:       modoNotificacao       ?? MODO_PADRAO,
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  `Preferências de notificação de "${alvo.nome}" ajustadas por admin`,
    detalhe:   { alvoId, alteracoes: body },
    ipAddress, userAgent,
  })

  return NextResponse.json(formatarPreferencias(atualizado))
}
