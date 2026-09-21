'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminProviders } from '@/components/Providers'
import { AdminSidebar } from '@/components/superadmin/AdminSidebar'
import { useTenants } from '@/hooks/useAdmin'
import type { Tenant } from '@/lib/types'

function UsoContent() {
  const router = useRouter()
  const { data, isLoading } = useTenants()

  useEffect(() => {
    if (!localStorage.getItem('admin_session')) router.push('/admin/login')
  }, [router])

  const empresas = data?.tenants ?? []

  const totalUsuarios = empresas.reduce((s: number, e: Tenant) => s + (e._count?.usuarios ?? 0), 0)
  // Era e._count?.rdos (campo que não existe — sempre 0). O total de RDOs do
  // mês vem em e.rdosMes, calculado à parte na rota (ver app/api/admin/tenants).
  const totalRdos     = empresas.reduce((s: number, e: Tenant) => s + (e.rdosMes ?? 0), 0)
  const totalProjetos = empresas.reduce((s: number, e: Tenant) => s + (e._count?.projetos ?? 0), 0)

  function barCor(pct: number) {
    if (pct >= 90) return '#E05C5C'
    if (pct >= 70) return '#E6A817'
    return '#4CAF7D'
  }

  function UsageBar({ usado, limite, label }: { usado: number; limite: number; label: string }) {
    if (limite === 0) return (
      <div style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#8B95A8', marginBottom:3 }}>
          <span>{label}</span><span style={{ color:'#29B6D8' }}>{usado} / ∞</span>
        </div>
        <div style={{ height:4, background:'#161B25', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:4, width:'20%', background:'#29B6D8', borderRadius:2 }} />
        </div>
      </div>
    )
    const pct = Math.min(100, Math.round((usado / limite) * 100))
    const cor = barCor(pct)
    return (
      <div style={{ marginBottom:8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#8B95A8', marginBottom:3 }}>
          <span>{label}</span>
          <span style={{ color: cor, fontWeight:600 }}>{usado}/{limite} ({pct}%)</span>
        </div>
        <div style={{ height:4, background:'#161B25', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:4, width:`${pct}%`, background:cor, borderRadius:2, transition:'width .3s' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'#090C12', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#E8EAF0' }}>Uso & Limites</div>
          <div style={{ fontSize:11, color:'#8B95A8' }}>Consumo por empresa vs. limites do plano</div>
        </div>

        {/* Totais */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9, marginBottom:16 }}>
          {[
            { l:'Empresas ativas', v: empresas.filter((e: Tenant) => e.status==='ATIVO').length, cor:'#29B6D8' },
            { l:'Usuários ativos',  v: totalUsuarios, cor:'#E8EAF0' },
            { l:'Projetos totais',  v: totalProjetos, cor:'#E8EAF0' },
            { l:'RDOs totais',      v: totalRdos,     cor:'#4CAF7D' },
          ].map(k => (
            <div key={k.l} style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, padding:'11px 13px' }}>
              <div style={{ fontSize:22, fontWeight:600, color:k.cor, marginBottom:3 }}>{k.v}</div>
              <div style={{ fontSize:10, color:'#8B95A8' }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Cards por empresa */}
        {isLoading ? (
          <div style={{ color:'#8B95A8', fontSize:12, padding:32, textAlign:'center' }}>Carregando...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
            {empresas.map((e: Tenant) => {
              // Limite que vale de verdade pra esta empresa (o mesmo que o sistema aplica ao
              // barrar novos usuários/projetos/RDOs) — não um número fixo por plano.
              const limites = { usuarios: e.limiteUsuarios, rdos: e.limiteRdosMes, projetos: e.limiteProjetos }
              const usuarios  = e._count?.usuarios  ?? 0
              const projetos  = e._count?.projetos  ?? 0
              const rdosMes   = e.rdosMes ?? 0
              const PLANO_COR: Record<string,string> = { STARTER:'#8B95A8', PRO:'#29B6D8', ENTERPRISE:'#F59E0B' }

              return (
                <div key={e.id} style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#E8EAF0' }}>{e.nome}</div>
                      <div style={{ fontSize:10, color:'#4A5568' }}>{e.cidade ? `${e.cidade} · ` : ''}{e.setor ?? ''}</div>
                    </div>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500, background:`${PLANO_COR[e.plano]}18`, color:PLANO_COR[e.plano], border:`.5px solid ${PLANO_COR[e.plano]}40` }}>{e.plano}</span>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <UsageBar usado={usuarios}  limite={limites.usuarios}  label="Usuários"    />
                    <UsageBar usado={projetos}  limite={limites.projetos}  label="Projetos"    />
                    <UsageBar usado={rdosMes}   limite={limites.rdos}      label="RDOs/mês"    />
                  </div>
                  {e.ativadoEm && (
                    <div style={{ padding:'6px 14px 10px', fontSize:10, color:'#4A5568' }}>
                      Ativo desde {new Date(e.ativadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function UsoPage() {
  return <AdminProviders><UsoContent /></AdminProviders>
}
