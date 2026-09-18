// src/api/app/notificacoes/route.ts
// GET   /api/app/notificacoes — preferências de e-mail do usuário logado
// PATCH /api/app/notificacoes — atualizar preferências

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { formatarPreferencias, PADRAO_PREFERENCIAS, MODO_PADRAO, type PreferenciasEmail } from '@/lib/notificacoes'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const pref = await prisma.preferenciaNotificacao.findUnique({
    where: { usuarioId: auth.ctx.usuarioId },
  })

  return NextResponse.json(formatarPreferencias(pref))
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

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
    where:  { usuarioId: auth.ctx.usuarioId },
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
      usuarioId: auth.ctx.usuarioId,
      emailRdoEnviado:       emailRdoEnviado       ?? PADRAO_PREFERENCIAS.emailRdoEnviado,
      emailRdoAprovado:      emailRdoAprovado      ?? PADRAO_PREFERENCIAS.emailRdoAprovado,
      emailRdoRejeitado:     emailRdoRejeitado     ?? PADRAO_PREFERENCIAS.emailRdoRejeitado,
      emailLembreteDiario:   emailLembreteDiario   ?? PADRAO_PREFERENCIAS.emailLembreteDiario,
      emailContratoVencendo: emailContratoVencendo ?? PADRAO_PREFERENCIAS.emailContratoVencendo,
      emailConvitePendente:  emailConvitePendente  ?? PADRAO_PREFERENCIAS.emailConvitePendente,
      modoNotificacao:       modoNotificacao       ?? MODO_PADRAO,
    },
  })

  return NextResponse.json(formatarPreferencias(atualizado))
}
