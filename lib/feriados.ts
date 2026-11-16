// lib/feriados.ts
// Feriados nacionais do Brasil — fixos + móveis (calculados a partir da Páscoa)

function pascoa(ano: number): Date {
  // Algoritmo de Gauss (anônimo gregoriano) para a data da Páscoa
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

function addDias(data: Date, dias: number): Date {
  const d = new Date(data)
  d.setUTCDate(d.getUTCDate() + dias)
  return d
}

function chave(data: Date): string {
  return data.toISOString().slice(0, 10)
}

// Feriados nacionais fixos + móveis (Sexta-feira Santa e Corpus Christi)
export function feriadosNacionais(ano: number): Set<string> {
  const pascoaAno = pascoa(ano)
  const fixos = [
    `${ano}-01-01`, // Confraternização Universal
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência do Brasil
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    `${ano}-11-20`, // Consciência Negra
    `${ano}-12-25`, // Natal
  ]
  const moveis = [
    chave(addDias(pascoaAno, -2)), // Sexta-feira Santa
    chave(addDias(pascoaAno, 60)), // Corpus Christi
  ]
  return new Set([...fixos, ...moveis])
}

// `data` deve ser uma data "pura" (meia-noite UTC representando o dia calendário)
export function ehDiaUtil(data: Date): boolean {
  const diaSemana = data.getUTCDay() // 0 = domingo, 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) return false
  return !feriadosNacionais(data.getUTCFullYear()).has(chave(data))
}

// ── Dia da semana, para os projetos por homem-hora ─────────────────────────────
// Não há cadastro de feriados: quem preenche o H/H marca a hora extra de 100% no dia de feriado.
// O sistema só conhece o calendário (sábado e domingo) para sugerir o tipo de hora.

export type TipoDia = 'UTIL' | 'SABADO' | 'DOMINGO' | 'FERIADO'

export interface InfoDia {
  tipo: 'UTIL' | 'SABADO' | 'DOMINGO'
  diaSemana: number // 0 = domingo ... 6 = sábado
}

export const NOME_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function infoDoDia(dia: string | Date): InfoDia {
  const d = typeof dia === 'string'
    ? new Date(`${dia.slice(0, 10)}T00:00:00Z`)
    : new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate()))
  const diaSemana = d.getUTCDay()
  return { tipo: diaSemana === 0 ? 'DOMINGO' : diaSemana === 6 ? 'SABADO' : 'UTIL', diaSemana }
}

// Hora extra sugerida para as linhas novas (o usuário troca em cada linha): domingo 100%, sábado 50%,
// dia útil hora normal. Feriado em dia de semana: marcar "hora extra 100%" na linha.
export function extraSugerida(info: InfoDia): { tipoHora: 'NORMAL' | 'EXTRA'; percentualExtra: number | null } {
  if (info.tipo === 'DOMINGO') return { tipoHora: 'EXTRA', percentualExtra: 100 }
  if (info.tipo === 'SABADO') return { tipoHora: 'EXTRA', percentualExtra: 50 }
  return { tipoHora: 'NORMAL', percentualExtra: null }
}
