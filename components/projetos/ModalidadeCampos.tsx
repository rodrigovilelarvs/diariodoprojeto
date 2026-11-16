'use client'
// Campos "Modalidade de medição" (por avanço ou por homem-hora) e "Horas contratadas", usados no
// cadastro e na edição do projeto.

import { Field, Input, Select } from '@/components/ui'
import type { ModalidadeMedicao } from '@/lib/types'

export function ModalidadeCampos({ modalidade, onModalidade, horas, onHoras }: {
  modalidade: ModalidadeMedicao
  onModalidade: (m: ModalidadeMedicao) => void
  horas: string
  onHoras: (h: string) => void
}) {
  return (
    <>
      <Field label="Modalidade de medição">
        <Select value={modalidade} onChange={e => onModalidade(e.target.value as ModalidadeMedicao)}>
          <option value="AVANCO">Por avanço (% das atividades)</option>
          <option value="HOMEM_HORA">Por homem-hora (horas trabalhadas)</option>
        </Select>
      </Field>
      {modalidade === 'HOMEM_HORA' && (
        <Field label="Horas contratadas (H/H)">
          <Input type="number" min={0} step="0.01" value={horas} onChange={e => onHoras(e.target.value)} placeholder="Opcional — ex: 1200" />
          <div style={{ fontSize: 10.5, color: 'var(--ts)', marginTop: 4 }}>
            Se informar, o saldo é abatido a cada RDO aprovado. Em branco, o sistema apenas soma as horas trabalhadas.
          </div>
        </Field>
      )}
    </>
  )
}
