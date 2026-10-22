'use client'
// O Novo RDO agora é uma janela (ver components/rdos/NovoRdoModal.tsx). Esta rota continua
// existindo para links antigos (e-mails de lembrete, favoritos): abre a janela por cima da
// lista de RDOs — ou da pasta do projeto, quando o link traz ?projetoId=.

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useNovoRdo } from '@/components/rdos/NovoRdoModal'

export default function NovoRdoPage() {
  return (
    <Suspense fallback={null}>
      <AbrirNovoRdo />
    </Suspense>
  )
}

function AbrirNovoRdo() {
  const router = useRouter()
  const projetoId = useSearchParams().get('projetoId') ?? ''
  const { abrirNovoRdo } = useNovoRdo()

  useEffect(() => {
    router.replace(projetoId ? `/projetos/${projetoId}` : '/rdos')
    abrirNovoRdo({ projetoId })
  }, [router, projetoId, abrirNovoRdo])

  return null
}
