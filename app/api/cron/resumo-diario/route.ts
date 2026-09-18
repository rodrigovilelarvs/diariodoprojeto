// src/api/cron/resumo-diario/route.ts
// GET /api/cron/resumo-diario — disparado 1x/dia pelo Vercel Cron, à noite.
// Manda 1 e-mail só, consolidado, pra cada usuário no modo "resumo diário"
// (PreferenciaNotificacao.modoNotificacao = DIGEST_DIARIO) que tenha alguma
// notificação represada na fila (NotificacaoFila) — quem está no modo
// imediato (padrão) nunca aparece aqui, já recebeu na hora.

import { LogCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { enviarEmailSeguro, enviarResumoDiario } from '@/lib/email'

// Aceita apenas o disparo do Vercel Cron (header Authorization com CRON_SECRET).
// Sem CRON_SECRET configurado, só libera fora de produção (facilita testes locais).
function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const pendentes = await prisma.notificacaoFila.findMany({
    where:   { enviadoEm: null },
    include: { usuario: { select: { id: true, nome: true, email: true, tenantId: true } } },
    orderBy: { criadoEm: 'asc' },
  })

  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, usuarios: 0, notificacoes: 0 })
  }

  // Agrupa por usuário — 1 e-mail com tudo, não 1 por notificação
  const porUsuario = new Map<string, { usuario: { id: string; nome: string; email: string; tenantId: string }; itens: Array<{ titulo: string; resumo: string; link?: string }>; ids: string[] }>()
  for (const p of pendentes) {
    if (!porUsuario.has(p.usuarioId)) {
      porUsuario.set(p.usuarioId, { usuario: p.usuario, itens: [], ids: [] })
    }
    const grupo = porUsuario.get(p.usuarioId)!
    grupo.itens.push({ titulo: p.titulo, resumo: p.resumo, link: p.link ?? undefined })
    grupo.ids.push(p.id)
  }

  let usuariosNotificados = 0

  for (const [, grupo] of porUsuario) {
    await enviarEmailSeguro(() => enviarResumoDiario({
      destinatario: { email: grupo.usuario.email, nome: grupo.usuario.nome },
      itens: grupo.itens,
    }))

    await prisma.notificacaoFila.updateMany({
      where: { id: { in: grupo.ids } },
      data:  { enviadoEm: new Date() },
    })

    await registrarLog({
      tenantId:  grupo.usuario.tenantId,
      usuarioId: grupo.usuario.id,
      categoria: LogCategoria.USUARIO,
      mensagem:  `Resumo diário de notificações enviado (${grupo.itens.length} itens)`,
      detalhe:   { itens: grupo.itens.length },
    })

    usuariosNotificados++
  }

  return NextResponse.json({
    ok: true,
    usuarios: usuariosNotificados,
    notificacoes: pendentes.length,
  })
}
