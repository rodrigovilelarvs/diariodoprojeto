// lib/aprovacao-aviso.ts
// Aviso por e-mail de "RDO aguardando sua aprovação" — respeita as preferências de
// notificação de cada pessoa. Usado ao enviar o RDO e, no modo de assinatura em sequência,
// quando chega a vez do próximo assinante.

import { enviarEmailSeguro, enviarRdoParaAprovacao } from '@/lib/email'
import { filtrarEEnfileirar } from '@/lib/notificacoes'
import { numeroRdo } from '@/lib/format'

export async function avisarAprovadores(
  aprovadores: Array<{ id: string; nome: string; email: string }>,
  rdo: {
    id: string; numero: number; data: Date; projetoNome: string; emissorNome: string
    atividadeRegistros?: Array<{ pctAtual: number }>
    maoDeObra?: Array<{ totalHH: unknown }>
  },
  motivoDaVez?: string,
) {
  if (aprovadores.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link = `${appUrl}/aprovacao/${rdo.id}`
  const destinatarios = await filtrarEEnfileirar(aprovadores, 'emailRdoEnviado', {
    tipo:   'emailRdoEnviado',
    titulo: `RDO #${numeroRdo(rdo.numero)} aguardando sua aprovação`,
    resumo: `${rdo.projetoNome} · emitido por ${rdo.emissorNome}${motivoDaVez ? ` · ${motivoDaVez}` : ''}`,
    link,
  })
  if (destinatarios.length === 0) return

  const registros = rdo.atividadeRegistros ?? []
  const pctMedio = registros.length
    ? Math.round(registros.reduce((s, r) => s + r.pctAtual, 0) / registros.length)
    : 0
  const totalHH = (rdo.maoDeObra ?? []).reduce((s, m) => s + Number(m.totalHH), 0)

  await enviarEmailSeguro(() => enviarRdoParaAprovacao({
    aprovadores: destinatarios.map((a) => ({ email: a.email, nome: a.nome })),
    rdo: {
      numero:  rdo.numero,
      data:    rdo.data.toISOString(),
      projeto: rdo.projetoNome,
      emissor: rdo.emissorNome,
      pctMedio,
      totalHH,
      link,
    },
  }))
}
