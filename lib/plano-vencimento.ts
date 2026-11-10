// lib/plano-vencimento.ts
// Plano vencido: depois da data de vencimento da empresa (Tenant.dataVencimentoPlano) ninguém da
// empresa entra mais na plataforma — nem no login, nem com uma sessão já aberta. O acesso vale
// até o fim do dia do vencimento (horário de Brasília) e é bloqueado a partir do dia seguinte.
// Sem data de vencimento cadastrada, o plano não vence. Quem renova é o super-admin, alterando a
// data em /admin/empresas.

export const CODIGO_PLANO_VENCIDO = 'PLANO_VENCIDO'

// "AAAA-MM-DD" de hoje no horário de Brasília
function hojeEmBrasilia(agora: Date): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// A data de vencimento é gravada como data "sem hora" (meia-noite UTC): só o dia importa
function diaDoVencimento(vencimento: Date | string): string {
  return new Date(vencimento).toISOString().slice(0, 10)
}

export function planoVencido(vencimento: Date | string | null | undefined, agora: Date = new Date()): boolean {
  if (!vencimento) return false
  return hojeEmBrasilia(agora) > diaDoVencimento(vencimento)
}

export function mensagemPlanoVencido(vencimento: Date | string): string {
  const [a, m, d] = diaDoVencimento(vencimento).split('-')
  return `O plano da sua empresa venceu em ${d}/${m}/${a}. Entre em contato com o suporte para renovar o acesso.`
}
