'use client'
// Faixa no topo do app, só para administradores da empresa, avisando do vencimento do plano:
// 14 dias antes (informativa), 7 dias antes (reforçada) e durante os 7 dias de tolerância.
// Ver situacaoDoPlano em lib/plano-vencimento.ts.

import Link from 'next/link'
import { useAppAuth } from '@/contexts/AuthContext'
import { useEmpresaInfo } from '@/hooks/useEmpresa'
import { situacaoDoPlano } from '@/lib/plano-vencimento'

const COR = {
  'aviso':       { fundo: 'var(--bga)', borda: 'var(--ba)', texto: 'var(--ta)',  icone: 'ti-info-circle' },
  'aviso-forte': { fundo: 'color-mix(in srgb, var(--tw) 14%, transparent)', borda: 'var(--tw)', texto: 'var(--tw)', icone: 'ti-alert-triangle' },
  'tolerancia':  { fundo: 'color-mix(in srgb, var(--td) 14%, transparent)', borda: 'var(--td)', texto: 'var(--td)', icone: 'ti-alert-octagon' },
} as const

export function AvisoPlano() {
  const { session } = useAppAuth()
  const ehAdmin = session?.usuario.perfil === 'ADMIN'
  const { data: empresa } = useEmpresaInfo()
  if (!ehAdmin || !empresa?.dataVencimentoPlano) return null
  const situacao = situacaoDoPlano(empresa.dataVencimentoPlano)
  if (situacao.tipo === 'ok' || situacao.tipo === 'bloqueado') return null
  const c = COR[situacao.tipo]
  return (
    <div role="status" data-testid="aviso-plano" data-tipo={situacao.tipo}
      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', fontSize: 11.5, background: c.fundo, color: c.texto, borderBottom: `.5px solid ${c.borda}` }}>
      <i className={`ti ${c.icone}`} style={{ fontSize: 15, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{situacao.mensagem}</span>
      <Link href="/empresa" style={{ color: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>Ver plano</Link>
    </div>
  )
}
