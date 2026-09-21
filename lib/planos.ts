// src/lib/planos.ts
// Regras compartilhadas dos planos (configuração editável pelo super-admin).
//
// O PlanoConfig é a fonte do preço e das funcionalidades: quem precisa deles lê
// dele na hora. Já os LIMITES (usuários, RDOs/mês, projetos) são gravados em
// cada empresa (Tenant) e é dessa cópia que o sistema barra o uso — por isso,
// quando o super-admin altera um limite do plano, a alteração é aplicada às
// empresas que estão nele (ver PATCH em app/api/admin/planos/route.ts).

import { PlanoTipo } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'

export const CAMPOS_LIMITE = ['limiteUsuarios', 'limiteRdosMes', 'limiteProjetos'] as const
export type CampoLimite = (typeof CAMPOS_LIMITE)[number]
export type LimitesPlano = Partial<Record<CampoLimite, number>>

// Só os limites que MUDAM de fato entre a configuração atual e o pedido. Sem
// configuração anterior (plano ainda não cadastrado), tudo que veio conta.
// Campos que não mudaram não são reaplicados, pra salvar só o preço não
// atropelar um limite que foi ajustado à mão numa empresa negociada.
export function limitesAlterados(
  atual: LimitesPlano | null,
  pedido: Partial<Record<CampoLimite, number | null | undefined>>,
): LimitesPlano {
  const mudou: LimitesPlano = {}
  for (const campo of CAMPOS_LIMITE) {
    const novo = pedido[campo]
    if (novo == null) continue
    if (atual == null || atual[campo] !== novo) mudou[campo] = novo
  }
  return mudou
}

// Preço mensal de cada plano, lido da configuração (nunca de número fixo no
// código). Plano ainda sem configuração cadastrada conta como 0.
export async function precosDosPlanos(): Promise<Record<PlanoTipo, number>> {
  // `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
  // lib/prisma.ts) — `precoMensal` é Decimal em runtime, só passa por Number().
  const configs: Array<{ tipo: PlanoTipo; precoMensal: unknown }> = await prisma.planoConfig.findMany({
    select: { tipo: true, precoMensal: true },
  })
  const precos: Record<PlanoTipo, number> = { STARTER: 0, PRO: 0, ENTERPRISE: 0 }
  for (const c of configs) precos[c.tipo] = Number(c.precoMensal)
  return precos
}
