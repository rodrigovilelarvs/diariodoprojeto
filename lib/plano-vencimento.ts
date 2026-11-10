// lib/plano-vencimento.ts
// Plano vencido (Tenant.dataVencimentoPlano). Linha do tempo, em dias de calendário (horário de Brasília):
//   14 a 8 dias antes   → aviso (faixa informativa para os administradores)
//    7 dias antes até o dia do vencimento → aviso reforçado
//    1 a 7 dias depois  → TOLERÂNCIA: o acesso continua, com aviso de que vai ser bloqueado
//    a partir do 8º dia depois → BLOQUEADO: ninguém da empresa entra (login e sessão aberta)
// Sem data de vencimento cadastrada, o plano não vence. Quem renova é o super-admin, alterando a
// data em /admin/empresas — o acesso volta na hora.

export const CODIGO_PLANO_VENCIDO = 'PLANO_VENCIDO'
export const DIAS_TOLERANCIA = 7
export const DIAS_AVISO = 14        // primeiro aviso
export const DIAS_AVISO_FORTE = 7   // aviso reforçado

const DIA_MS = 86_400_000

// "AAAA-MM-DD" de hoje no horário de Brasília
function hojeEmBrasilia(agora: Date): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// A data de vencimento é gravada como data "sem hora" (meia-noite UTC): só o dia importa
function diaDoVencimento(vencimento: Date | string): string {
  return new Date(vencimento).toISOString().slice(0, 10)
}

function emMs(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`)
}

function formatar(dia: string): string {
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}`
}

function somarDias(dia: string, n: number): string {
  return new Date(emMs(dia) + n * DIA_MS).toISOString().slice(0, 10)
}

// Dias até o vencimento: positivo = falta, 0 = vence hoje, negativo = já venceu
export function diasParaVencer(vencimento: Date | string, agora: Date = new Date()): number {
  return Math.round((emMs(diaDoVencimento(vencimento)) - emMs(hojeEmBrasilia(agora))) / DIA_MS)
}

// Acesso bloqueado: passou o vencimento E o prazo de tolerância
export function planoVencido(vencimento: Date | string | null | undefined, agora: Date = new Date()): boolean {
  if (!vencimento) return false
  return diasParaVencer(vencimento, agora) < -DIAS_TOLERANCIA
}

export function mensagemPlanoVencido(vencimento: Date | string): string {
  return `O plano da sua empresa venceu em ${formatar(diaDoVencimento(vencimento))} e o prazo de tolerância terminou. Entre em contato com o suporte para renovar o acesso.`
}

export type SituacaoPlano =
  | { tipo: 'ok' }
  | { tipo: 'aviso' | 'aviso-forte' | 'tolerancia' | 'bloqueado'; mensagem: string }

// O que mostrar na faixa de aviso (para os administradores da empresa)
export function situacaoDoPlano(vencimento: Date | string | null | undefined, agora: Date = new Date()): SituacaoPlano {
  if (!vencimento) return { tipo: 'ok' }
  const dia = diaDoVencimento(vencimento)
  const dias = diasParaVencer(vencimento, agora)
  const data = formatar(dia)

  if (dias > DIAS_AVISO) return { tipo: 'ok' }
  if (dias > DIAS_AVISO_FORTE) {
    return { tipo: 'aviso', mensagem: `O plano da sua empresa vence em ${data} (em ${dias} dias). Para evitar interrupção no acesso, providencie a renovação com o suporte.` }
  }
  if (dias >= 0) {
    const quando = dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`
    return { tipo: 'aviso-forte', mensagem: `Atenção: o plano da sua empresa ${quando} (${data}). Depois do vencimento há ${DIAS_TOLERANCIA} dias de tolerância; passado esse prazo, o acesso de todos é bloqueado. Fale com o suporte para renovar.` }
  }
  if (dias >= -DIAS_TOLERANCIA) {
    const ultimo = formatar(somarDias(dia, DIAS_TOLERANCIA))
    return { tipo: 'tolerancia', mensagem: `O plano da sua empresa venceu em ${data}. Você está no prazo de tolerância: o acesso de todos continua até ${ultimo} e, depois dessa data, é bloqueado. Fale com o suporte para renovar.` }
  }
  return { tipo: 'bloqueado', mensagem: mensagemPlanoVencido(vencimento) }
}
