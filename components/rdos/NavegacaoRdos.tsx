'use client'
// Setas ‹ RDO #N › para transitar entre os RDOs do mesmo projeto, em ordem de número,
// em qualquer estado (rascunho, enviado para aprovação ou aprovado). Cada RDO abre na
// tela certa para o seu estado (ver urlDoRdo). Some se o projeto só tem este RDO.

import { useRouter } from 'next/navigation'
import { useRdos } from '@/hooks/useEmpresa'
import { numeroRdo } from '@/lib/format'
import { urlDoRdo } from '@/lib/rdo-display'

interface Props {
  rdoId:     string
  projetoId: string | undefined
  numero:    number
}

export function NavegacaoRdos({ rdoId, projetoId, numero }: Props) {
  const router = useRouter()
  // Lista completa do projeto ordenada por número, só para achar o anterior e o próximo;
  // não é paginada de propósito (`por` alto) para não quebrar a navegação em projetos
  // com muitos RDOs.
  const { data } = useRdos(
    { projetoId, sortBy: 'numero', sortDir: 'asc', por: 500 },
    { enabled: !!projetoId },
  )
  const lista = data?.rdos ?? []
  const i = lista.findIndex(r => r.id === rdoId)
  const anterior = i > 0 ? lista[i - 1] : null
  const proximo  = i >= 0 && i < lista.length - 1 ? lista[i + 1] : null

  if (!anterior && !proximo) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button" className="btn btn-sm" disabled={!anterior}
        title={anterior ? `RDO #${numeroRdo(anterior.numero)}` : 'Não há RDO anterior'}
        aria-label="RDO anterior"
        onClick={() => anterior && router.push(urlDoRdo(anterior))}
      >
        <i className="ti ti-chevron-left" />
      </button>
      <span style={{ fontSize: 11, color: 'var(--ts)', whiteSpace: 'nowrap' }}>RDO #{numeroRdo(numero)}</span>
      <button
        type="button" className="btn btn-sm" disabled={!proximo}
        title={proximo ? `RDO #${numeroRdo(proximo.numero)}` : 'Não há próximo RDO'}
        aria-label="Próximo RDO"
        onClick={() => proximo && router.push(urlDoRdo(proximo))}
      >
        <i className="ti ti-chevron-right" />
      </button>
    </div>
  )
}
