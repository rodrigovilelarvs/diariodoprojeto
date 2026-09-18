// src/components/ui/index.tsx
// Primitivos de UI espelhando as classes CSS do protótipo

import React, { useState, useEffect, useRef } from 'react'

// ── Badge ────────────────────────────────────────────────────
export type BadgeVariant = 'ok' | 'warn' | 'blue' | 'gray' | 'danger' | 'purple'
export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return <span className={`badge b-${variant}`}>{children}</span>
}

// ── Botão ────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'sm'
  icon?:    string
}
export function Btn({ variant = 'default', icon, children, className = '', ...props }: BtnProps) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn-p' : '',
    variant === 'sm'      ? 'btn-sm' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} {...props}>
      {icon && <i className={`ti ${icon}`} />}
      {children}
    </button>
  )
}

// ── Campo de formulário ──────────────────────────────────────
interface FieldProps {
  label:    string
  children: React.ReactNode
}
export function Field({ label, children }: FieldProps) {
  return (
    <div className="fr">
      <label className="fl">{label}</label>
      {children}
    </div>
  )
}

// ── Input ────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} className="fi" {...props} />
)
Input.displayName = 'Input'

// ── Select ───────────────────────────────────────────────────
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => <select ref={ref} className="fi" {...props} />
)
Select.displayName = 'Select'

// ── Textarea ─────────────────────────────────────────────────
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} className="fi" {...props} />
)
Textarea.displayName = 'Textarea'

// ── Seção colapsável ─────────────────────────────────────────
interface SecaoProps {
  numero:   string | number
  titulo:   string
  acoes?:   React.ReactNode
  children: React.ReactNode
}
export function Secao({ numero, titulo, acoes, children }: SecaoProps) {
  return (
    <div className="sec">
      <div className="sec-h">
        <span className="sec-num">{numero}</span>
        <span className="sec-title">{titulo}</span>
        {acoes}
      </div>
      <div className="sec-body">{children}</div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────
interface KpiProps {
  icon:      string
  valor:     React.ReactNode
  label:     string
  tendencia?: React.ReactNode
  cor?:      string
  onClick?:  () => void
}
export function KpiCard({ icon, valor, label, tendencia, cor, onClick }: KpiProps) {
  return (
    <div className="kpi" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <i className={`ti ${icon} kicon`} />
      <div className="kv" style={cor ? { color: cor } : undefined}>{valor}</div>
      <div className="kl">{label}</div>
      {tendencia && <div className="kt">{tendencia}</div>}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ h = 20, w = '100%' }: { h?: number; w?: string | number }) {
  return (
    <div className="sk" style={{ height: h, width: w, borderRadius: 'var(--r)' }} />
  )
}

// ── Barra de progresso dupla (Planejado x Realizado) ─────────
// Planejado sempre em verde, Realizado sempre em azul — cor identifica qual é
// qual, em vez de indicar desempenho (isso já fica a cargo do "Desvio").
export function DualBar({ plan, real, comBarra = true }: { plan: number; real: number; comBarra?: boolean }) {
  if (!comBarra) {
    return (
      <div className="pbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--tm)' }}>Plan.</span><span style={{ color: 'var(--fsu)', fontWeight: 600 }}>{plan}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--tm)' }}>Real.</span><span style={{ color: 'var(--fa)', fontWeight: 600 }}>{real}%</span>
        </div>
      </div>
    )
  }
  return (
    <div className="pbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--tm)' }}>
        <span>Plan.</span><span style={{ color: 'var(--fsu)', fontWeight: 600 }}>{plan}%</span>
      </div>
      <div className="pb-t"><div className="pb-f" style={{ width: `${plan}%`, background: 'var(--fsu)' }} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--tm)' }}>
        <span>Real.</span><span style={{ color: 'var(--fa)', fontWeight: 600 }}>{real}%</span>
      </div>
      <div className="pb-t"><div className="pb-f" style={{ width: `${real}%`, background: 'var(--fa)' }} /></div>
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────
interface ModalProps {
  open:     boolean
  onClose:  () => void
  titulo:   string
  icon?:    string
  width?:   number
  children: React.ReactNode
  rodape?:  React.ReactNode
}
export function Modal({ open, onClose, titulo, icon, width = 480, children, rodape }: ModalProps) {
  if (!open) return null
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <div className="mh">
          <div className="mh-t">
            {icon && <i className={`ti ${icon}`} />}
            {titulo}
          </div>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tm)', fontSize: 17 }}
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="mb">{children}</div>
        {rodape && <div className="mf2">{rodape}</div>}
      </div>
    </div>
  )
}

// ── Status Badge do RDO ──────────────────────────────────────
const RDO_ST: Record<string, { label: string; variant: BadgeVariant }> = {
  RASCUNHO:           { label: 'Rascunho',            variant: 'gray'   },
  PENDENTE_APROVACAO: { label: 'Pendente aprovação',  variant: 'warn'   },
  APROVADO:           { label: 'Totalmente aprovado', variant: 'ok'     },
  REJEITADO:          { label: 'Revisar',             variant: 'danger' },
}
// `assinaturas` opcional: quando informado (status de cada aprovador esperado),
// e houver mais de 1 aprovador configurado, indica qual aprovação está pendente
// (ex.: "Pendente (2ª de 3)"). Com 0 ou 1 aprovador não há ordinal a mostrar.
export function RdoStatusBadge({ status, assinaturas }: { status: string; assinaturas?: { status: string }[] }) {
  const s = RDO_ST[status] ?? { label: status, variant: 'gray' as BadgeVariant }
  let label = s.label
  if (status === 'PENDENTE_APROVACAO' && assinaturas && assinaturas.length > 1) {
    const total     = assinaturas.length
    const assinadas = assinaturas.filter(a => a.status === 'ASSINADO').length
    // Projeto com até 3 aprovadores definidos (1ª/2ª/3ª assinatura) — indica o ordinal
    // pendente. Modo "aberta" pode gerar mais slots (1 por usuário elegível do tenant):
    // nesse caso mostra apenas a contagem, já que não há uma ordem fixa entre eles.
    if (total <= 3) {
      const proxima = Math.min(assinadas + 1, total)
      label = `Pendente (${proxima}ª de ${total})`
    } else {
      label = `Pendente (${assinadas}/${total} assin.)`
    }
  }
  return <Badge variant={s.variant}>{label}</Badge>
}

// ── Clima emoji ───────────────────────────────────────────────
const CLIMA_EMOJI: Record<string, string> = {
  SOL: '☀️', NUBLADO: '⛅', CHUVA: '🌧️', TEMPESTADE: '⛈️',
}
const CLIMA_EMOJI_NOITE: Record<string, string> = {
  SOL: '🌙', NUBLADO: '⛅', CHUVA: '🌧️', TEMPESTADE: '⛈️',
}
export function ClimaEmoji({ condicao, noite }: { condicao?: string; noite?: boolean }) {
  if (!condicao) return null
  const mapa = noite ? CLIMA_EMOJI_NOITE : CLIMA_EMOJI
  return <span style={{ fontSize: 16 }}>{mapa[condicao] ?? '—'}</span>
}

// ── Desvio colorido ───────────────────────────────────────────
export function Desvio({ valor }: { valor: number }) {
  const cor = valor >= 0 ? 'var(--tsu)' : 'var(--td)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 600, color: cor }}>
      <i className={`ti ti-trending-${valor >= 0 ? 'up' : 'down'}`} />
      {valor >= 0 ? '+' : ''}{valor}%
    </span>
  )
}

// ── Filtro row search ─────────────────────────────────────────
export function SearchInput({ placeholder, value, onChange }: {
  placeholder?: string
  value:        string
  onChange:     (v: string) => void
}) {
  return (
    <div className="sw">
      <i className="ti ti-search" />
      <input
        className="si"
        placeholder={placeholder ?? 'Buscar...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ── Busca com sugestões (autocomplete) ─────────────────────────
// Igual ao SearchInput, mas clicar no campo (mesmo vazio) já mostra as opções
// numa lista suspensa, digitar filtra essa lista em tempo real, e clicar numa
// opção preenche o campo com o rótulo dela.
export interface AutocompleteOpcao { id: string; label: string; sublabel?: string }

export function AutocompleteSearchInput({ placeholder, value, onChange, opcoes }: {
  placeholder?: string
  value:        string
  onChange:     (v: string) => void
  opcoes:       AutocompleteOpcao[]
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  const filtradas = value.trim()
    ? opcoes.filter(o => o.label.toLowerCase().includes(value.trim().toLowerCase()))
    : opcoes

  function selecionar(label: string) {
    onChange(label)
    setAberto(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <div className="sw" style={{ minWidth: 0 }}>
        <i className="ti ti-search" />
        <input
          className="si"
          placeholder={placeholder ?? 'Buscar...'}
          value={value}
          onChange={e => { onChange(e.target.value); setAberto(true) }}
          onFocus={() => setAberto(true)}
          onKeyDown={e => { if (e.key === 'Escape') setAberto(false) }}
        />
      </div>
      {aberto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: 'var(--s1)', border: '.5px solid var(--b)', borderRadius: 'var(--r)',
          maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: '10px', fontSize: 11, color: 'var(--tm)', textAlign: 'center' }}>
              Nenhum resultado encontrado.
            </div>
          ) : (
            filtradas.map(o => (
              <div key={o.id} className="autocomplete-opt"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selecionar(o.label)}
              >
                {o.sublabel && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ta)', minWidth: 30, flexShrink: 0 }}>{o.sublabel}</span>
                )}
                <span style={{ color: 'var(--tp)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
