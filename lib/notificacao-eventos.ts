// lib/notificacao-eventos.ts
// Catálogo dos eventos de notificação — usado tanto pelo autoatendimento
// (app/(app)/notificacoes) quanto pela edição feita pelo admin em /usuarios,
// pra nunca dessincronizar a lista entre as duas telas.

import type { CampoEmail } from '@/lib/notificacoes'

export interface EventoNotificacao {
  id:    string
  label: string
  desc:  string
  campo: CampoEmail
}

export interface GrupoNotificacao {
  id:      string
  icon:    string
  cor:     string
  bg:      string
  titulo:  string
  eventos: EventoNotificacao[]
}

export const GRUPOS_NOTIFICACAO: GrupoNotificacao[] = [
  {
    id: 'rdos', icon: 'ti-file-text', cor: 'var(--ta)', bg: 'var(--bga)',
    titulo: 'Registros Diários de Obra',
    eventos: [
      { id: 'envio',     label: 'RDO enviado para aprovação',  desc: 'Quando um RDO aguarda sua aprovação',     campo: 'emailRdoEnviado' },
      { id: 'aprovado',  label: 'RDO aprovado',                desc: 'Quando seu RDO é aprovado por todos',     campo: 'emailRdoAprovado' },
      { id: 'rejeitado', label: 'RDO em revisão / comentário',  desc: 'Quando pedem revisão ou comentam no seu RDO', campo: 'emailRdoRejeitado' },
      { id: 'lembrete',  label: 'Lembrete diário (18h)',        desc: 'Quando o RDO do dia não foi emitido',     campo: 'emailLembreteDiario' },
    ],
  },
  {
    id: 'projetos', icon: 'ti-building', cor: 'var(--tw)', bg: 'var(--bgw)',
    titulo: 'Projetos',
    eventos: [
      { id: 'contrato', label: 'Contrato vencendo',   desc: 'Aviso 30 dias antes do fim do contrato do projeto', campo: 'emailContratoVencendo' },
    ],
  },
  {
    id: 'equipe', icon: 'ti-users', cor: 'var(--tw)', bg: 'var(--bgw)',
    titulo: 'Equipe',
    eventos: [
      { id: 'convite', label: 'Convite pendente', desc: 'Quando um convite enviado não é aceito depois de alguns dias', campo: 'emailConvitePendente' },
    ],
  },
]
