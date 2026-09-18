// lib/notificacoes.ts
// Helpers para checar preferências de e-mail antes de enviar notificações.
// Sem registro de preferência = comportamento padrão (recebe, modo imediato).

import { prisma } from './prisma'

export type CampoEmail = 'emailRdoEnviado' | 'emailRdoAprovado' | 'emailRdoRejeitado' | 'emailLembreteDiario' | 'emailContratoVencendo' | 'emailConvitePendente'

export type ModoNotificacao = 'IMEDIATO' | 'DIGEST_DIARIO'

// Valor padrão de cada canal quando o usuário nunca configurou nada — modelo
// opt-out (todo mundo já começa recebendo). Reaproveitado tanto pela tela de
// autoatendimento (/notificacoes) quanto pela edição feita pelo admin em
// /usuarios, pra nunca dessincronizar os dois.
export const PADRAO_PREFERENCIAS: Record<CampoEmail, boolean> = {
  emailRdoEnviado:       true,
  emailRdoAprovado:      true,
  emailRdoRejeitado:     true,
  emailLembreteDiario:   true,
  emailContratoVencendo: true,
  emailConvitePendente:  true,
}

export const MODO_PADRAO: ModoNotificacao = 'IMEDIATO'

export type PreferenciasEmail = Record<CampoEmail, boolean> & { modoNotificacao: ModoNotificacao }

export function formatarPreferencias(pref: (Partial<Record<CampoEmail, boolean>> & { modoNotificacao?: ModoNotificacao }) | null): PreferenciasEmail {
  return {
    emailRdoEnviado:       pref?.emailRdoEnviado       ?? PADRAO_PREFERENCIAS.emailRdoEnviado,
    emailRdoAprovado:      pref?.emailRdoAprovado      ?? PADRAO_PREFERENCIAS.emailRdoAprovado,
    emailRdoRejeitado:     pref?.emailRdoRejeitado     ?? PADRAO_PREFERENCIAS.emailRdoRejeitado,
    emailLembreteDiario:   pref?.emailLembreteDiario   ?? PADRAO_PREFERENCIAS.emailLembreteDiario,
    emailContratoVencendo: pref?.emailContratoVencendo ?? PADRAO_PREFERENCIAS.emailContratoVencendo,
    emailConvitePendente:  pref?.emailConvitePendente  ?? PADRAO_PREFERENCIAS.emailConvitePendente,
    modoNotificacao:       pref?.modoNotificacao       ?? MODO_PADRAO,
  }
}

export async function podeReceberEmail(usuarioId: string, campo: CampoEmail): Promise<boolean> {
  const pref = await prisma.preferenciaNotificacao.findUnique({ where: { usuarioId } })
  if (!pref) return true
  return (pref as any)[campo]
}

// Filtra uma lista de usuários, mantendo só quem tem o canal habilitado (ou sem preferência salva)
export async function filtrarPorPreferenciaEmail(
  usuarios: any[],
  campo: CampoEmail,
): Promise<any[]> {
  if (usuarios.length === 0) return usuarios

  const prefs = await prisma.preferenciaNotificacao.findMany({
    where:  { usuarioId: { in: usuarios.map(u => u.id) } },
    select: { usuarioId: true, [campo]: true },
  })
  const desabilitados = new Set(prefs.filter((p: any) => p[campo] === false).map((p: any) => p.usuarioId))

  return usuarios.filter(u => !desabilitados.has(u.id))
}

// ── Modo imediato × resumo diário ──────────────────────────────
// Item a registrar na fila (NotificacaoFila) pra quem estiver no modo
// "resumo diário" — vira uma linha no e-mail consolidado da noite.
export interface ItemNotificacao {
  tipo:   CampoEmail
  titulo: string
  resumo: string
  link?:  string
}

// Substitui filtrarPorPreferenciaEmail nos pontos de envio em massa: já
// filtra por preferência E separa quem está no modo "resumo diário" —
// esses ganham uma linha na fila em vez de entrar na lista devolvida, então
// quem chama só manda o e-mail imediato pra quem sobrou na lista.
export async function filtrarEEnfileirar(
  usuarios: any[],
  campo:    CampoEmail,
  item:     ItemNotificacao,
): Promise<any[]> {
  if (usuarios.length === 0) return usuarios

  const prefs = await prisma.preferenciaNotificacao.findMany({
    where:  { usuarioId: { in: usuarios.map(u => u.id) } },
    select: { usuarioId: true, modoNotificacao: true, [campo]: true },
  })
  const mapa = new Map(prefs.map((p: any) => [p.usuarioId, p]))

  const imediatos: any[] = []
  const paraFila:  any[] = []

  for (const u of usuarios) {
    const pref = mapa.get(u.id) as any
    const habilitado = pref ? pref[campo] !== false : true // sem registro = opt-out padrão, recebe
    if (!habilitado) continue
    if (pref?.modoNotificacao === 'DIGEST_DIARIO') paraFila.push(u)
    else imediatos.push(u)
  }

  if (paraFila.length > 0) {
    await prisma.notificacaoFila.createMany({
      data: paraFila.map(u => ({
        usuarioId: u.id, tipo: item.tipo, titulo: item.titulo, resumo: item.resumo, link: item.link,
      })),
    })
  }

  return imediatos
}

// Mesma ideia, mas pra um único destinatário (ex.: emissor recebendo aviso
// de aprovação/revisão) — devolve se deve mandar o e-mail JÁ; se estiver no
// modo resumo diário, já enfileira e devolve false.
export async function podeEnviarAgoraOuEnfileirar(
  usuarioId: string,
  campo:     CampoEmail,
  item:      ItemNotificacao,
): Promise<boolean> {
  const pref = await prisma.preferenciaNotificacao.findUnique({ where: { usuarioId } })
  const habilitado = pref ? (pref as any)[campo] !== false : true
  if (!habilitado) return false

  if ((pref as any)?.modoNotificacao === 'DIGEST_DIARIO') {
    await prisma.notificacaoFila.create({
      data: { usuarioId, tipo: item.tipo, titulo: item.titulo, resumo: item.resumo, link: item.link },
    })
    return false
  }
  return true
}
