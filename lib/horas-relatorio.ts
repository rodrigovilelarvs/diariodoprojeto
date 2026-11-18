// lib/horas-relatorio.ts
// Funções puras do relatório "Horas por dia (H/H)": semanas (segunda a domingo), subtotais por semana e
// atalhos de período. Usadas pela tela e pelo PDF.

// ── Planilha (CSV com ";" e vírgula decimal, que o Excel brasileiro abre direto) ──
// Número em texto com VÍRGULA decimal e no máximo 2 casas: com ponto, o Excel em português lê "688.5" como 6885
// e "8.5" como data. null/undefined vira célula vazia.
export function numeroCsv(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
export function celulaCsv(v: string | number | null | undefined): string {
  const t = v == null ? '' : typeof v === 'number' ? numeroCsv(v) : v
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
export function montarCsv(linhas: Array<Array<string | number | null | undefined>>): string {
  return '\uFEFF' + linhas.map(l => l.map(celulaCsv).join(';')).join('\r\n')
}

const DIA_MS = 86_400_000

const paraDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)
const paraISO = (d: Date) => d.toISOString().slice(0, 10)
const somaDias = (iso: string, n: number) => paraISO(new Date(paraDate(iso).getTime() + n * DIA_MS))

// Semana de segunda a domingo que contém o dia
export function semanaDoDia(dia: string): { inicio: string; fim: string } {
  const diaSemana = paraDate(dia).getUTCDay() // 0 = domingo
  const desdeSegunda = (diaSemana + 6) % 7
  const inicio = somaDias(dia, -desdeSegunda)
  return { inicio, fim: somaDias(inicio, 6) }
}

type DiaComHoras = { data: string; normais: number; extras: number; noturnas: number; total: number; valor: number | null }

export interface SemanaHoras<T extends DiaComHoras> {
  inicio: string; fim: string
  dias: T[]
  normais: number; extras: number; noturnas: number; total: number; valor: number | null
}

const arredonda2 = (n: number) => Math.round(n * 100) / 100

// Agrupa os dias (já em ordem de data) por semana e soma cada semana
export function agruparPorSemana<T extends DiaComHoras>(dias: T[]): SemanaHoras<T>[] {
  const semanas: SemanaHoras<T>[] = []
  for (const d of dias) {
    const { inicio, fim } = semanaDoDia(d.data)
    let s = semanas[semanas.length - 1]
    if (!s || s.inicio !== inicio) {
      s = { inicio, fim, dias: [], normais: 0, extras: 0, noturnas: 0, total: 0, valor: null }
      semanas.push(s)
    }
    s.dias.push(d)
    s.normais += d.normais; s.extras += d.extras; s.noturnas += d.noturnas; s.total += d.total
    if (d.valor != null) s.valor = (s.valor ?? 0) + d.valor
  }
  for (const s of semanas) {
    s.normais = arredonda2(s.normais); s.extras = arredonda2(s.extras); s.noturnas = arredonda2(s.noturnas); s.total = arredonda2(s.total)
    if (s.valor != null) s.valor = arredonda2(s.valor)
  }
  return semanas
}

export interface AtalhoPeriodo { id: string; rotulo: string; inicio: string; fim: string }

// Atalhos de período a partir da data de hoje (AAAA-MM-DD)
export function atalhosDePeriodo(hoje: string): AtalhoPeriodo[] {
  const primeiroDoMes = hoje.slice(0, 8) + '01'
  const ultimoDoMesPassado = somaDias(primeiroDoMes, -1)
  return [
    { id: 'este-mes', rotulo: 'Este mês', inicio: primeiroDoMes, fim: hoje },
    { id: 'mes-passado', rotulo: 'Mês passado', inicio: ultimoDoMesPassado.slice(0, 8) + '01', fim: ultimoDoMesPassado },
    { id: '7-dias', rotulo: 'Últimos 7 dias', inicio: somaDias(hoje, -6), fim: hoje },
    { id: '30-dias', rotulo: 'Últimos 30 dias', inicio: somaDias(hoje, -29), fim: hoje },
  ]
}
