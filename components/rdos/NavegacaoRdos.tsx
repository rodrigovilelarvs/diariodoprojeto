'use client'
// Setas ‹ RDO #N › para transitar entre RDOs.
//
// Dois modos:
//  - padrão: os RDOs do MESMO projeto, em ordem de número, em qualquer estado (rascunho,
//    enviado para aprovação ou aprovado);
//  - fila de aprovação (?fila=pendentes, quando o RDO foi aberto pelo item "Aprovação" do
//    menu): só os RDOs pendentes de assinatura, do mais antigo para o mais novo — assim quem
//    aprova vai assinando e passando pelas setas. Respeita os filtros ativos na lista de onde
//    veio (projeto, grupo, busca): filtrou um projeto, só anda pelos pendentes dele.
// Cada RDO abre na tela certa para o seu estado (ver urlDoRdo).

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRdos } from '@/hooks/useEmpresa'
import { numeroRdo } from '@/lib/format'
import { urlDoRdo } from '@/lib/rdo-display'

interface Props {
  rdoId:     string
  projetoId: string | undefined
  numero:    number
  /** data do RDO atual (ISO) — usada para manter a posição na fila depois de assinar */
  data?:     string
}

type Item = { id: string; numero: number; data: string; status: string; projeto?: { nome: string } }

export function NavegacaoRdos(props: Props) {
  // useSearchParams exige Suspense; fica restrito a este componente
  return (
    <Suspense fallback={null}>
      <Navegacao {...props} />
    </Suspense>
  )
}

function Navegacao({ rdoId, projetoId, numero, data }: Props) {
  const router = useRouter()
  const parametros = useSearchParams()
  const emFila = parametros.get('fila') === 'pendentes'
  // Na fila, vale o mesmo recorte da lista de onde a pessoa veio (projeto, grupo, busca)
  const filtrosFila = {
    projetoId: parametros.get('projetoId') || undefined,
    grupo:     parametros.get('grupo')     || undefined,
    busca:     parametros.get('busca')     || undefined,
  }

  // Lista completa (não paginada de propósito: `por` alto) só para achar anterior/próximo.
  const { data: resposta } = useRdos(
    emFila
      ? { status: 'PENDENTE_APROVACAO', ...filtrosFila, sortBy: 'data', sortDir: 'asc', por: 500 }
      : { projetoId, sortBy: 'numero', sortDir: 'asc', por: 500 },
    { enabled: emFila || !!projetoId },
  )
  let lista: Item[] = resposta?.rdos ?? []

  if (emFila) {
    // Depois de assinar, o RDO atual deixa de ser pendente e some da lista: reinsere na
    // posição dele (data, número) para as setas continuarem de onde a pessoa está.
    if (data && !lista.some(r => r.id === rdoId)) {
      lista = [...lista, { id: rdoId, numero, data, status: 'PENDENTE_APROVACAO' }]
    }
    lista = [...lista].sort((a, b) =>
      new Date(a.data).getTime() - new Date(b.data).getTime() || a.numero - b.numero)
  }

  const i = lista.findIndex(r => r.id === rdoId)
  const anterior = i > 0 ? lista[i - 1] : null
  const proximo  = i >= 0 && i < lista.length - 1 ? lista[i + 1] : null

  if (!anterior && !proximo) return null

  // na fila, a URL do próximo mantém todos os parâmetros (fila + filtros)
  const ir = (r: Item) => router.push(urlDoRdo(r) + (emFila ? `?${parametros.toString()}` : ''))
  const rotulo = (r: Item) => `RDO #${numeroRdo(r.numero)}${r.projeto?.nome ? ` — ${r.projeto.nome}` : ''}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button" className="btn btn-sm" disabled={!anterior}
        title={anterior ? rotulo(anterior) : emFila ? 'Não há RDO pendente anterior' : 'Não há RDO anterior'}
        aria-label="RDO anterior"
        onClick={() => anterior && ir(anterior)}
      >
        <i className="ti ti-chevron-left" />
      </button>
      <span style={{ fontSize: 11, color: 'var(--ts)', whiteSpace: 'nowrap' }}>
        RDO #{numeroRdo(numero)}
        {emFila && i >= 0 && <span style={{ color: 'var(--tm)' }}> · pendente {i + 1} de {lista.length}</span>}
      </span>
      <button
        type="button" className="btn btn-sm" disabled={!proximo}
        title={proximo ? rotulo(proximo) : emFila ? 'Não há próximo RDO pendente' : 'Não há próximo RDO'}
        aria-label="Próximo RDO"
        onClick={() => proximo && ir(proximo)}
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  )
}
