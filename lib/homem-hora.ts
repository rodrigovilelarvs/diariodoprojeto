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

// Adicional noturno: das 22h às 05h, acréscimo de 20% sobre o valor da hora. É calculado só pela entrada e saída
// da linha (não é gravado), então vale também para os RDOs antigos. As horas noturnas fazem parte do total de
// horas da linha (não são horas a mais): só mudam o custo.
export const ADICIONAL_NOTURNO_PERCENTUAL = 20
export const NOITE_INICIO = '22:00'
export const NOITE_FIM = '05:00'

function minutosDoDia(hora: string): number {
  const [h, m] = (hora || '').split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

// Horas dentro da faixa noturna (22:00–05:00) de uma linha: entrada → saída (saída menor que a entrada = virou o
// dia) × quantidade de pessoas. Ex.: 20:00–06:00 com 1 pessoa = 7 h noturnas (22h–24h e 00h–05h).
export function horasNoturnas(horaEntrada: string | null | undefined, horaSaida: string | null | undefined, quantidade = 1): number {
  if (!horaEntrada || !horaSaida) return 0
  const ent = minutosDoDia(horaEntrada)
  let sai = minutosDoDia(horaSaida)
  if (sai < ent) sai += 1440
  let minutos = 0
  // faixas noturnas: 00–05 do dia, 22–05 (do dia seguinte) e 22–05 do segundo dia
  for (const [ini, fim] of [[0, 300], [1320, 1740], [2760, 3180]]) minutos += Math.max(0, Math.min(sai, fim) - Math.max(ent, ini))
  return Math.round((minutos / 60) * quantidade * 100) / 100
}

// Custo de uma linha de mão de obra: horas × valor da hora normal × (1 + acréscimo da extra), mais o adicional
// noturno (20%) sobre as horas noturnas, já com o acréscimo da extra (hora extra noturna = extra × noturno).
export function custoDaLinha(horas: number, valorHora: number | null, tipoHora: string | null | undefined, percentualExtra: number | null | undefined, horasNoturnasDaLinha = 0): number | null {
  if (valorHora == null) return null
  const fator = tipoHora === 'EXTRA' ? 1 + (percentualExtra ?? PERCENTUAL_EXTRA_PADRAO) / 100 : 1
  const adicionalNoturno = horasNoturnasDaLinha * valorHora * fator * (ADICIONAL_NOTURNO_PERCENTUAL / 100)
  return Math.round((horas * valorHora * fator + adicionalNoturno) * 100) / 100
}

export const arredonda2 = (n: number) => Math.round(n * 100) / 100
