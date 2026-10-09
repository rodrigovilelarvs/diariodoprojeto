'use client'
// Campo "empresa do projeto". O rótulo (Empresa contratada / Empresa contratante)
// vem da configuração da empresa, em "Dados da empresa" — o sistema serve tanto a
// quem executa a obra quanto a quem contrata.

import { Field, Input } from '@/components/ui'
import { useEmpresaInfo } from '@/hooks/useEmpresa'
import { rotuloEmpresa } from '@/lib/rdo-display'

export function EmpresaCampo({ nome, onNome }: { nome: string; onNome: (n: string) => void }) {
  const { data: empresa } = useEmpresaInfo()
  const tipo = empresa?.tipoEmpresaProjeto ?? 'CONTRATADA'
  return (
    <Field label={rotuloEmpresa(tipo)}>
      <Input
        value={nome}
        onChange={e => onNome(e.target.value)}
        placeholder={tipo === 'CONTRATADA' ? 'Ex: Construtora Alfa Ltda' : 'Ex: Incorporadora Beta S.A.'}
      />
    </Field>
  )
}
