'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminProviders } from '@/components/Providers'
import { AdminSidebar } from '@/components/superadmin/AdminSidebar'
import { usePlanos, useAtualizarPlano } from '@/hooks/useAdmin'
import { toast } from 'sonner'
import type { PlanoConfig, PlanoTipo } from '@/lib/types'

function PlanosContent() {
  const router = useRouter()
  const { data, isLoading } = usePlanos()
  const atualizarPlano = useAtualizarPlano()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string | number | boolean>>({})

  useEffect(() => {
    if (!localStorage.getItem('admin_session')) router.push('/admin/login')
  }, [router])

  const planos = data?.planos ?? []
  const distribuicao = data?.distribuicao ?? []

  const PLANO_COR: Record<string, string> = { STARTER: '#8B95A8', PRO: '#29B6D8', ENTERPRISE: '#F59E0B' }
  const PLANO_EMOJI: Record<string, string> = { STARTER: '🌱', PRO: '🚀', ENTERPRISE: '🏆' }

  function iniciarEdicao(plano: PlanoConfig) {
    setEditando(plano.tipo)
    setForm({
      precoMensal:        plano.precoMensal,
      limiteUsuarios:     plano.limiteUsuarios,
      limiteRdosMes:      plano.limiteRdosMes,
      limiteProjetos:     plano.limiteProjetos,
      temRelatorios:      plano.temRelatorios,
      temExportPdf:       plano.temExportPdf,
      temApi:             plano.temApi,
      temSuporteDedicado: plano.temSuporteDedicado,
      descricao:          plano.descricao ?? '',
    })
  }

  async function salvar(tipo: PlanoTipo) {
    try {
      await atualizarPlano.mutateAsync({ tipo, ...form } as Parameters<typeof atualizarPlano.mutateAsync>[0])
      toast.success(`Plano ${tipo} atualizado!`)
      setEditando(null)
    } catch { toast.error('Erro ao atualizar plano.') }
  }

  const inp = (label: string, key: string, type = 'number') => (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:10, color:'#8B95A8', display:'block', marginBottom:3 }}>{label}</label>
      <input type={type} value={(form[key] as string | number | undefined) ?? ''} onChange={e => setForm(f => ({ ...f, [key]: type==='number' ? Number(e.target.value) : e.target.value }))}
        style={{ width:'100%', padding:'6px 9px', borderRadius:6, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' }} />
    </div>
  )

  const toggle = (label: string, key: string) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <span style={{ fontSize:11, color:'#8B95A8' }}>{label}</span>
      <button onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
        style={{ padding:'3px 10px', borderRadius:20, fontSize:10, cursor:'pointer', fontFamily:'inherit', border:`.5px solid ${form[key] ? '#4CAF7D' : 'rgba(255,255,255,.1)'}`, background: form[key] ? 'rgba(76,175,125,.15)' : 'transparent', color: form[key] ? '#4CAF7D' : '#8B95A8' }}>
        {form[key] ? '✔ Sim' : '— Não'}
      </button>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'100vh', background:'#090C12', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#E8EAF0' }}>Planos</div>
          <div style={{ fontSize:11, color:'#8B95A8' }}>Configure preços, limites e funcionalidades de cada plano</div>
        </div>

        {/* Distribuição */}
        {distribuicao.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9, marginBottom:16 }}>
            {distribuicao.map((d) => (
              <div key={d.plano} style={{ background:'#1C2333', border:`.5px solid ${PLANO_COR[d.plano]}30`, borderRadius:12, padding:'11px 13px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color: PLANO_COR[d.plano], fontWeight:600 }}>{PLANO_EMOJI[d.plano]} {d.plano}</span>
                  <span style={{ fontSize:10, color:'#8B95A8' }}>{d.empresas} empresa{d.empresas!==1?'s':''}</span>
                </div>
                <div style={{ fontSize:18, fontWeight:600, color:'#E8EAF0' }}>
                  {d.receita > 0 ? `R$ ${d.receita.toLocaleString('pt-BR')}` : 'Grátis'}
                </div>
                <div style={{ fontSize:10, color:'#4A5568' }}>MRR estimado</div>
              </div>
            ))}
          </div>
        )}

        {/* Cards dos planos */}
        {isLoading ? (
          <div style={{ color:'#8B95A8', fontSize:12, padding:32, textAlign:'center' }}>Carregando...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {planos.map((plano) => {
              const cor  = PLANO_COR[plano.tipo]
              const isEd = editando === plano.tipo

              return (
                <div key={plano.tipo} style={{ background:'#1C2333', border:`.5px solid ${isEd ? cor : 'rgba(255,255,255,.08)'}`, borderRadius:14, overflow:'hidden', transition:'border-color .2s' }}>
                  {/* Header */}
                  <div style={{ padding:'14px 16px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:16, marginBottom:2 }}>{PLANO_EMOJI[plano.tipo]}</div>
                      <div style={{ fontSize:14, fontWeight:700, color: cor }}>{plano.tipo}</div>
                      <div style={{ fontSize:18, fontWeight:700, color:'#E8EAF0', marginTop:2 }}>
                        {plano.precoMensal > 0 ? `R$ ${Number(plano.precoMensal).toLocaleString('pt-BR')}/mês` : 'Grátis'}
                      </div>
                    </div>
                    <button onClick={() => isEd ? setEditando(null) : iniciarEdicao(plano)}
                      style={{ padding:'5px 12px', borderRadius:8, fontSize:11, cursor:'pointer', fontFamily:'inherit', border:`.5px solid ${cor}50`, background: isEd ? `${cor}20` : 'transparent', color: cor }}>
                      {isEd ? '✕ Cancelar' : '✏ Editar'}
                    </button>
                  </div>

                  <div style={{ padding:'14px 16px' }}>
                    {isEd ? (
                      <>
                        {inp('Preço mensal (R$)', 'precoMensal')}
                        {inp('Limite usuários (0 = ilimitado)', 'limiteUsuarios')}
                        {inp('Limite RDOs/mês (0 = ilimitado)', 'limiteRdosMes')}
                        {inp('Limite projetos (0 = ilimitado)', 'limiteProjetos')}
                        {inp('Descrição', 'descricao', 'text')}
                        <div style={{ height:1, background:'rgba(255,255,255,.07)', margin:'10px 0' }} />
                        <div style={{ fontSize:10, fontWeight:600, color:'#8B95A8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Funcionalidades</div>
                        {toggle('Relatórios avançados', 'temRelatorios')}
                        {toggle('Exportação PDF', 'temExportPdf')}
                        {toggle('Acesso à API', 'temApi')}
                        {toggle('Suporte dedicado', 'temSuporteDedicado')}
                        <button onClick={() => salvar(plano.tipo)} disabled={atualizarPlano.isPending}
                          style={{ width:'100%', marginTop:12, padding:'8px', borderRadius:8, background:cor, border:'none', color:'#090C12', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          {atualizarPlano.isPending ? 'Salvando...' : '💾 Salvar alterações'}
                        </button>
                      </>
                    ) : (
                      <>
                        {[
                          { l:'Usuários',     v: plano.limiteUsuarios  === 0 ? 'Ilimitado' : plano.limiteUsuarios },
                          { l:'RDOs/mês',     v: plano.limiteRdosMes   === 0 ? 'Ilimitado' : plano.limiteRdosMes  },
                          { l:'Projetos',     v: plano.limiteProjetos  === 0 ? 'Ilimitado' : plano.limiteProjetos },
                        ].map(r => (
                          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'.5px solid rgba(255,255,255,.05)', fontSize:11 }}>
                            <span style={{ color:'#8B95A8' }}>{r.l}</span>
                            <span style={{ fontWeight:500 }}>{r.v}</span>
                          </div>
                        ))}
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
                          {[
                            { l:'Relatórios', v: plano.temRelatorios },
                            { l:'Export PDF', v: plano.temExportPdf },
                            { l:'API',        v: plano.temApi },
                            { l:'Suporte dedicado', v: plano.temSuporteDedicado },
                          ].map(f => (
                            <div key={f.l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                              <span style={{ color: f.v ? '#4CAF7D' : '#4A5568' }}>{f.v ? '✔' : '—'}</span>
                              <span style={{ color: f.v ? '#E8EAF0' : '#4A5568' }}>{f.l}</span>
                            </div>
                          ))}
                        </div>
                        {plano.descricao && (
                          <div style={{ marginTop:10, fontSize:11, color:'#4A5568', fontStyle:'italic' }}>{plano.descricao}</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlanosPage() {
  return <AdminProviders><PlanosContent /></AdminProviders>
}
