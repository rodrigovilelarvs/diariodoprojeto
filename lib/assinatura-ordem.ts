// lib/assinatura-ordem.ts
// Ordem das assinaturas de um RDO. Quando o projeto tem assinantes pré-definidos (modo
// "Pré-definida": assinante 1, 2 e 3), eles assinam em sequência: o 2º só assina depois do 1º,
// o 3º só depois do 2º. No modo "Aberta" não há ordem. Funções puras — usadas no servidor
// (para barrar a assinatura fora de ordem) e na tela (para mostrar de quem é a vez).

export interface ProjetoAssinantes {
  assinaturaModo?: string | null
  assinante1Id?:   string | null
  assinante2Id?:   string | null
  assinante3Id?:   string | null
}

type Slot = { usuarioId: string; status: string }

/** ids dos assinantes na ordem em que devem assinar ([] no modo aberto) */
export function sequenciaDeAssinantes(p: ProjetoAssinantes): string[] {
  if (p.assinaturaModo !== 'DEFINIDA') return []
  return [p.assinante1Id, p.assinante2Id, p.assinante3Id].filter((v): v is string => !!v)
}

/** Esta pessoa já pode assinar? Se não, devolve de quem é a vez antes dela. */
export function vezDeAssinar(
  sequencia: string[], assinaturas: Slot[], usuarioId: string,
): { podeAssinar: boolean; aguardandoId?: string } {
  const posicao = sequencia.indexOf(usuarioId)
  if (posicao <= 0) return { podeAssinar: true } // 1º da fila, ou fora da sequência (modo aberto)
  for (const anterior of sequencia.slice(0, posicao)) {
    const slot = assinaturas.find(a => a.usuarioId === anterior)
    // quem não tem registro no RDO (ex.: usuário desativado) não trava a fila
    if (slot && slot.status !== 'ASSINADO') return { podeAssinar: false, aguardandoId: anterior }
  }
  return { podeAssinar: true }
}

/** Quem é o próximo a assinar (primeiro da sequência que ainda não assinou) */
export function proximoAAssinar(sequencia: string[], assinaturas: Slot[]): string | undefined {
  return sequencia.find(id => {
    const slot = assinaturas.find(a => a.usuarioId === id)
    return slot && slot.status !== 'ASSINADO'
  })
}

/** Coloca as assinaturas na ordem da sequência (quem está fora dela vai para o fim) */
export function ordenarPorSequencia<T extends { usuario: { id: string } }>(assinaturas: T[], sequencia: string[]): T[] {
  if (sequencia.length === 0) return assinaturas
  const pos = (a: T) => { const i = sequencia.indexOf(a.usuario.id); return i < 0 ? 999 : i }
  return [...assinaturas].sort((a, b) => pos(a) - pos(b))
}
