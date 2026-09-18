'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjetos, useCriarRdo, useRdos } from '@/hooks/useEmpresa'
import { Topbar } from '@/components/layout/Topbar'
import { RdoStatusBadge } from '@/components/ui'
import { numeroRdo, fmtData } from '@/lib/format'
import { toast } from 'sonner'

export default function NovoRdoPage() {
  const router = useRouter()
  const { data: projetos = [] } = useProjetos()
  const criarRdo = useCriarRdo()
  const [projetoId, setProjetoId] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0,10))
  const [copiar, setCopiar] = useState(true)

  // Avisa se já existe RDO deste projeto nesta data — não bloqueia,
  // só evita duplicidade sem querer (a mesma obra pode ter mais de um
  // registro no mesmo dia em casos legítimos).
  const { data: rdosNoDia } = useRdos(
    { projetoId, data },
    { enabled: !!projetoId && !!data },
  )
  const conflitos = rdosNoDia?.rdos ?? []

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!projetoId) { toast.error('Selecione um projeto.'); return }
    try {
      const rdo = await criarRdo.mutateAsync({ projetoId, data, copiarAnterior: copiar })
      toast.success(`RDO #${numeroRdo(rdo.numero)} criado!`)
      router.push(`/rdos/${rdo.id}`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao criar RDO.')
    }
  }

  return (
    <div className="main">
      <Topbar titulo="Novo RDO" subtitulo="Registro Diário de Obra" />
      <div className="content" style={{ maxWidth: 480 }}>
        <div className="sec">
          <div className="sec-h"><span className="sec-num">1</span><span className="sec-title">Identificação</span></div>
          <div className="sec-body">
            <form onSubmit={handleCriar}>
              <div className="fr"><label className="fl">Projeto *</label>
                <select className="fi" value={projetoId} onChange={e => setProjetoId(e.target.value)} required>
                  <option value="">Selecione o projeto...</option>
                  {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="fr"><label className="fl">Data *</label>
                <input className="fi" type="date" value={data} onChange={e => setData(e.target.value)} required />
              </div>
              {conflitos.length > 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  marginBottom: 14, padding: '10px 12px',
                  background: 'color-mix(in srgb, var(--tw) 12%, transparent)',
                  border: '.5px solid var(--tw)', borderRadius: 'var(--r)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--tw)' }}>
                    <i className="ti ti-alert-triangle" />
                    Já existe RDO neste projeto nesta data
                  </div>
                  {conflitos.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ts)' }}>
                      <span>#{numeroRdo(r.numero)} · {fmtData(r.data)}</span>
                      <RdoStatusBadge status={r.status} assinaturas={r.assinaturas} />
                    </div>
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--ts)' }}>
                    Você ainda pode criar um novo — só confira se não é duplicidade.
                  </span>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'8px 10px', background:'var(--bga)', borderRadius:'var(--r)', border:'.5px solid var(--ba)' }}>
                <input type="checkbox" id="copiar" checked={copiar} onChange={e => setCopiar(e.target.checked)} />
                <label htmlFor="copiar" style={{ fontSize:12, color:'var(--ta)', cursor:'pointer' }}>
                  Copiar dados do RDO anterior (horários, MO, equipamentos)
                </label>
              </div>
              <div style={{ display:'flex', gap:7 }}>
                <button type="button" className="btn" onClick={() => router.push('/rdos')}>Cancelar</button>
                <button type="submit" className="btn btn-p" disabled={criarRdo.isPending}>
                  <i className="ti ti-plus" /> {criarRdo.isPending ? 'Criando...' : 'Criar RDO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
