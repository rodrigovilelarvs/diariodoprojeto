// lib/homem-hora.ts
// Regras compartilhadas da modalidade "homem-hora" (H/H): hora normal ou extra, valor da hora,
// e saldo de horas do contrato.

export const PERCENTUAL_EXTRA_PADRAO = 50
export const PERCENTUAL_EXTRA_MAX = 300

// Decimal do Prisma (ou string/número) → número; vazio/inválido → null
export function numeroOuNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Tipo da hora + % de acréscimo coerentes: normal não tem percentual; extra tem (padrão 50%)
export function normalizarTipoHora(tipoHora: unknown, percentualExtra: unknown): { tipoHora: 'NORMAL' | 'EXTRA'; percentualExtra: number | null } {
  if (tipoHora !== 'EXTRA') return { tipoHora: 'NORMAL', percentualExtra: null }
  const p = Math.round(Number(percentualExtra))
  const valido = Number.isFinite(p) && p >= 1 && p <= PERCENTUAL_EXTRA_MAX
  return { tipoHora: 'EXTRA', percentualExtra: valido ? p : PERCENTUAL_EXTRA_PADRAO }
}

// Custo de uma linha de mão de obra: horas × valor da hora normal × (1 + acréscimo da extra)
export function custoDaLinha(horas: number, valorHora: number | null, tipoHora: string | null | undefined, percentualExtra: number | null | undefined): number | null {
  if (valorHora == null) return null
  const fator = tipoHora === 'EXTRA' ? 1 + (percentualExtra ?? PERCENTUAL_EXTRA_PADRAO) / 100 : 1
  return Math.round(horas * valorHora * fator * 100) / 100
}

export const arredonda2 = (n: number) => Math.round(n * 100) / 100
