'use client'
// Tela de Aprovação (item do menu): lista dedicada aos RDOs que aguardam aprovação.
// Usa a mesma lista da tela de RDOs, mas com o status travado em "pendente de aprovação"
// (sem o filtro de status); projeto, grupo e busca continuam disponíveis.

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui'
import { RdosContent } from '@/app/(app)/rdos/page'

export default function AprovacaoPage() {
  return (
    <Suspense fallback={<div className="main"><div className="content"><Skeleton h={300} /></div></div>}>
      <RdosContent modoAprovacao />
    </Suspense>
  )
}
