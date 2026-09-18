// POST /api/app/client-error
// Recebe erros de renderização capturados pelos error boundaries do front
// e registra no log de auditoria (categoria SISTEMA, nível ERRO), pra a
// equipe ver que uma tela quebrou pra algum usuário — sem depender de o
// cliente reportar. É público no middleware porque o erro pode acontecer
// justamente quando o token expirou; a identificação abaixo é best-effort.

import { NextRequest, NextResponse } from 'next/server'
import { registrarLog, getRequestMeta } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { LogCategoria, LogNivel } from '@/lib/prisma-enums'

const LIMITE = 4000

export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = getRequestMeta(req)

  let tenantId: string | undefined
  let usuarioId: string | undefined
  try {
    const token = req.cookies.get('app_token')?.value
    if (token) {
      const payload = verifyToken(token)
      tenantId  = payload.tenantId
      usuarioId = payload.usuarioId
    }
  } catch {
    // token ausente/expirado — segue sem identificar
  }

  let body: { mensagem?: string; stack?: string; digest?: string; url?: string; escopo?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const trunc = (s?: string) => (s ? String(s).slice(0, LIMITE) : undefined)

  await registrarLog({
    tenantId,
    usuarioId,
    nivel:     LogNivel.ERRO,
    categoria: LogCategoria.SISTEMA,
    mensagem:  `Erro de tela: ${trunc(body.mensagem) ?? '(sem mensagem)'}`,
    detalhe: {
      tipo:   'client_error',
      escopo: body.escopo ?? 'app',
      url:    trunc(body.url),
      digest: trunc(body.digest),
      stack:  trunc(body.stack),
    },
    ipAddress,
    userAgent,
  })

  return new NextResponse(null, { status: 204 })
}
