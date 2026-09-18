'use client'
import { useParams } from 'next/navigation'
import { FormularioRdo } from './FormularioRdo'

export default function RdoPage() {
  const { id } = useParams<{ id: string }>()
  return <FormularioRdo rdoId={id} />
}
