'use client'
// Campo "empresa do projeto": o sistema serve tanto a quem contrata (contratante)
// quanto a quem executa a obra (contratada). Aqui a pessoa marca de qual lado está
// a empresa informada; o rótulo escolhido aparece no RDO, na aprovação e nos PDFs.

import { Input } from '@/components/ui'
import { EMPRESA_TIPOS, EMPRESA_TIPO_L } from '@/lib/rdo-display'
import type { EmpresaTipo } from '@/lib/types'

interface Props {
  tipo:   EmpresaTipo
  nome:   string
  onTipo: (t: EmpresaTipo) => void
  onNome: (n: string) => void
}

export function EmpresaCampo({ tipo, nome, onTipo, onNome }: Props) {
  return (
    <div className="fr">
      <label className="fl">Empresa do projeto</label>
      <div role="radiogroup" aria-label="Tipo da empresa" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {EMPRESA_TIPOS.map(t => {
          const on = tipo === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onTipo(t)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', border: `.5px solid ${on ? 'var(--ba)' : 'var(--b)'}`,
                background: on ? 'var(--bga)' : 'var(--s1)', color: on ? 'var(--ta)' : 'var(--tp)',
              }}
            >
              <i className={`ti ${on ? 'ti-circle-check' : 'ti-circle'}`} style={{ marginRight: 5 }} />
              {EMPRESA_TIPO_L[t]}
            </button>
          )
        })}
      </div>
      <Input
        value={nome}
        onChange={e => onNome(e.target.value)}
        aria-label={`Nome da ${EMPRESA_TIPO_L[tipo].toLowerCase()}`}
        placeholder={tipo === 'CONTRATADA' ? 'Nome da empresa contratada. Ex: Construtora Alfa Ltda' : 'Nome da empresa contratante. Ex: Incorporadora Beta S.A.'}
      />
    </div>
  )
}
