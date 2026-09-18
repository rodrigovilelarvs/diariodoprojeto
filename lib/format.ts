// src/lib/format.ts
// Helpers de formatação compartilhados

// Número do RDO sempre com 4 dígitos (#0001) — evita reajuste em projetos grandes
export function numeroRdo(n: number | string): string {
  return String(n).padStart(4, '0')
}

// Formata uma data "sem hora" (contrato, RDO, atividade da lista de tarefas) —
// esses valores são salvos como meia-noite UTC (ex: input type="date" → "2026-08-02"
// → new Date(...) = 2026-08-02T00:00:00Z). Formatar sem timeZone:'UTC' faz o
// navegador converter pro fuso local antes de exibir — em qualquer fuso negativo
// (Brasil = UTC-3) isso volta um dia (mostra 01/08 em vez de 02/08). timeZone:'UTC'
// lê os mesmos componentes de data que foram gravados, sem esse deslocamento.
// NÃO use isso para timestamps reais (criadoEm, assinadoEm, ultimoAcessoEm etc.) —
// esses devem continuar em horário local, que é o comportamento correto pra eles.
export function fmtData(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', ...opts })
}
