'use client'
// src/app/notificacoes/page.tsx

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { useNotificacoes, useAtualizarNotificacoes, type PreferenciaNotificacao } from '@/hooks/useEmpresa'
import { GRUPOS_NOTIFICACAO as GRUPOS } from '@/lib/notificacao-eventos'
import { Skeleton } from '@/components/ui'
import { toast } from 'sonner'

export default function NotificacoesPage() {
  const { data, isLoading } = useNotificacoes()
  const atualizar = useAtualizarNotificacoes()

  // Estado otimista local — evita esperar o round-trip pra refletir o clique
  const [local, setLocal] = useState<PreferenciaNotificacao | null>(null)
  useEffect(() => { if (data) setLocal(data) }, [data])

  async function toggle(campo: keyof PreferenciaNotificacao) {
    if (!local) return
    const valor = !local[campo]
    setLocal(l => l && { ...l, [campo]: valor })
    try {
      await atualizar.mutateAsync({ [campo]: valor })
    } catch {
      setLocal(l => l && { ...l, [campo]: !valor }) // desfaz em caso de erro
      toast.error('Erro ao salvar preferência.')
    }
  }

  async function mudarModo(modo: PreferenciaNotificacao['modoNotificacao']) {
    if (!local || local.modoNotificacao === modo) return
    const anterior = local.modoNotificacao
    setLocal(l => l && { ...l, modoNotificacao: modo })
    try {
      await atualizar.mutateAsync({ modoNotificacao: modo })
    } catch {
      setLocal(l => l && { ...l, modoNotificacao: anterior })
      toast.error('Erro ao salvar preferência.')
    }
  }

  return (
    <div className="main">
      <Topbar titulo="Notificações" subtitulo="Preferências de alertas por e-mail" />
      <div className="content">

        <div style={{ background: 'var(--bga)', border: '.5px solid var(--ba)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, fontSize: 11, color: 'var(--ta)', lineHeight: 1.6 }}>
          <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
          Por enquanto só o canal <strong>E-mail</strong> é enviado de verdade, pros eventos abaixo com o toggle ativo. Notificações no app e push ainda não existem.
        </div>

        {!isLoading && local && (
          <div style={{ background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Como você quer receber</div>
            <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 10 }}>
              Vale pra todos os eventos ativos abaixo — não precisa escolher um por um.
            </div>
            <div className="ta-row" style={{ marginBottom: 0 }}>
              <button className={`ta-tab ${local.modoNotificacao === 'IMEDIATO' ? 'on' : ''}`} onClick={() => mudarModo('IMEDIATO')}>
                <i className="ti ti-bolt" /> Um e-mail por notificação
              </button>
              <button className={`ta-tab ${local.modoNotificacao === 'DIGEST_DIARIO' ? 'on' : ''}`} onClick={() => mudarModo('DIGEST_DIARIO')}>
                <i className="ti ti-calendar-event" /> Resumo no fim do dia
              </button>
            </div>
          </div>
        )}

        {isLoading ? <Skeleton h={300} /> : GRUPOS.map(g => (
          <div key={g.id} style={{ background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ padding: '10px 14px', borderBottom: '.5px solid var(--b)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 'var(--r)', background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${g.icon}`} style={{ color: g.cor }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{g.titulo}</div>
              </div>
            </div>
            {g.eventos.map((ev, idx) => {
              const ativo = ev.campo ? !!local?.[ev.campo] : false
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: idx < g.eventos.length - 1 ? '.5px solid var(--b)' : 'none', opacity: ev.campo ? 1 : .55 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{ev.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ts)' }}>{ev.desc}</div>
                  </div>
                  {ev.campo ? (
                    <label className="toggle">
                      <input type="checkbox" checked={ativo} onChange={() => toggle(ev.campo!)} />
                      <div className="ttrack" />
                      <div className="tthumb" />
                    </label>
                  ) : (
                    <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, fontWeight: 500, background: 'var(--s1)', color: 'var(--tm)', border: '.5px solid var(--b)', whiteSpace: 'nowrap' }}>
                      Em breve
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
