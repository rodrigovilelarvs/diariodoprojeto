// src/lib/rdo-display.ts
// Constantes e cálculos de exibição do RDO — compartilhados entre o formulário
// de preenchimento (FormularioRdo) e a tela de aprovação (somente leitura).

import type { MaoDeObraCategoria, EquipamentoTipo, AtividadeStatus } from '@/lib/types'
import { fmtData } from '@/lib/format'

export const CLIMA: Record<string, string> = {
  SOL: '☀️', NUBLADO: '⛅', CHUVA: '🌧️', TEMPESTADE: '⛈️',
}
export const CLIMA_NOITE: Record<string, string> = {
  SOL: '🌙', NUBLADO: '⛅', CHUVA: '🌧️', TEMPESTADE: '⛈️',
}
export const CLIMA_L: Record<string, string> = {
  SOL: 'Tempo limpo', NUBLADO: 'Nublado', CHUVA: 'Chuva', TEMPESTADE: 'Tempestade',
}
export const CLIMAS = ['SOL','NUBLADO','CHUVA','TEMPESTADE'] as const

export const CATEGORIA_L: Record<MaoDeObraCategoria, string> = {
  DIRETA: 'Direta', INDIRETA: 'Indireta', TERCEIRIZADO: 'Terceirizada',
}
export const CATEGORIAS: MaoDeObraCategoria[] = ['DIRETA', 'INDIRETA', 'TERCEIRIZADO']

export const EQUIPAMENTO_TIPO_L: Record<EquipamentoTipo, string> = {
  PROPRIO: 'Próprio', ALUGADO: 'Alugado', TERCEIRIZADO: 'Terceirizado',
}
export const EQUIPAMENTO_TIPOS: EquipamentoTipo[] = ['PROPRIO', 'ALUGADO', 'TERCEIRIZADO']

export function calcHH(ini: string, fim: string, intervalo: number): string {
  if (!ini || !fim) return '—'
  const [ih, im] = ini.split(':').map(Number)
  const [fh, fm] = fim.split(':').map(Number)
  let m = (fh * 60 + fm) - (ih * 60 + im) - intervalo * 60
  if (m < 0) m += 1440
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}h ${mm > 0 ? String(mm).padStart(2,'0') : '00'}min`
}

// H/H = horas efetivamente trabalhadas (descontado o intervalo) × quantidade de pessoas
export function calcMoHH(horaEntrada: string, horaSaida: string, intervaloHoras: number, quantidade: number) {
  const [ih,im] = (horaEntrada||'07:00').split(':').map(Number)
  const [fh,fm] = (horaSaida  ||'17:00').split(':').map(Number)
  let mins = (fh*60+fm) - (ih*60+im) - intervaloHoras*60; if (mins<0) mins+=1440
  return Math.round((mins/60) * quantidade * 10) / 10
}

export function calcPrazo(ini?: string, fim?: string, hoje?: string) {
  if (!ini || !fim) return null
  const I = new Date(ini), F = new Date(fim), H = hoje ? new Date(hoje) : new Date()
  const total      = Math.round((F.getTime() - I.getTime()) / 86_400_000)
  const decorridos = Math.max(0, Math.round((H.getTime() - I.getTime()) / 86_400_000))
  const restantes  = Math.max(0, total - decorridos)
  return { inicio: fmtData(I), fim: fmtData(F), total, decorridos, restantes,
           pctDecorrido: Math.round((decorridos / total) * 100) }
}

// Progresso real (%) e planejado (%) da lista de tarefas, ponderados pela
// duração de cada atividade (dataFim − dataInicio) — uma atividade de 30 dias
// pesa mais no total do que uma de 2 dias. Atividade sem as duas datas usa peso
// 1 (conta no real com o pctAcumulado normal) e contribui 0% para o planejado
// (ainda não programada, então não "deveria" estar em andamento).
// Real e planejado usam exatamente os mesmos pesos, para o desvio (real − planejado)
// comparar sempre a mesma base.
function duracaoDias(a: { dataInicio?: string | Date | null; dataFim?: string | Date | null }): number {
  if (!a.dataInicio || !a.dataFim) return 1
  const dias = (new Date(a.dataFim).getTime() - new Date(a.dataInicio).getTime()) / 86_400_000
  return dias > 0 ? dias : 1
}

export function calcProgressoPonderado(
  atividades: { pctAcumulado: number; dataInicio?: string | Date | null; dataFim?: string | Date | null }[],
): number {
  if (atividades.length === 0) return 0
  let peso = 0, soma = 0
  for (const a of atividades) {
    const p = duracaoDias(a)
    peso += p
    soma += p * a.pctAcumulado
  }
  return peso > 0 ? Math.round(soma / peso) : 0
}

export function calcPctPlanejado(
  atividades: { dataInicio?: string | Date | null; dataFim?: string | Date | null }[],
  hoje?: Date,
): number {
  if (atividades.length === 0) return 0
  const agora = (hoje ?? new Date()).getTime()
  let peso = 0, soma = 0
  for (const a of atividades) {
    const p = duracaoDias(a)
    peso += p
    let pct = 0
    if (a.dataInicio && a.dataFim) {
      const ini = new Date(a.dataInicio).getTime()
      const fim = new Date(a.dataFim).getTime()
      if (fim <= ini)       pct = agora >= fim ? 100 : 0
      else if (agora <= ini) pct = 0
      else if (agora >= fim) pct = 100
      else                   pct = ((agora - ini) / (fim - ini)) * 100
    }
    soma += p * pct
  }
  return peso > 0 ? Math.round(soma / peso) : 0
}

// Status "de verdade" de uma atividade, considerando prazo — o campo `status`
// salvo no banco só reflete se já tem % lançado (não iniciada/em andamento/concluída),
// sem olhar pra data. Só uma situação vira "atraso": nunca foi iniciada (0%) e a
// data de início já passou. Atividade em andamento conta como em andamento mesmo
// que o prazo já tenha passado — simplificação deliberada, sem sub-estado.
export function calcStatusEfetivo(
  a: { pctAcumulado: number; dataInicio?: string | Date | null },
  hoje?: Date,
): AtividadeStatus {
  if (a.pctAcumulado >= 100) return 'CONCLUIDA'
  if (a.pctAcumulado > 0) return 'EM_ANDAMENTO'
  const atrasada = !!a.dataInicio && (hoje ?? new Date()).getTime() > new Date(a.dataInicio).getTime()
  return atrasada ? 'EM_ATRASO' : 'NAO_INICIADA'
}

export function calcOcDur(ini: string, fim: string): string {
  if (!ini || !fim) return '—'
  const [ih, im] = ini.split(':').map(Number)
  const [fh, fm] = fim.split(':').map(Number)
  let m = (fh * 60 + fm) - (ih * 60 + im)
  if (m < 0) m += 1440
  const h = Math.floor(m / 60), mm = m % 60
  return h > 0 ? `${h}h ${mm}min` : `${mm}min`
}
