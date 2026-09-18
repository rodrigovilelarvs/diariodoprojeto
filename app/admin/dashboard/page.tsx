'use client'
// app/admin/dashboard/page.tsx

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminDashboard } from '@/hooks/useAdmin'
import { AdminProviders } from '@/components/Providers'
import { AdminSidebar } from '@/components/superadmin/AdminSidebar'

function DashboardContent() {
  const router  = useRouter()
  const { data, isLoading } = useAdminDashboard()

  useEffect(() => {
    if (!localStorage.getItem('admin_session')) router.push('/admin/login')
  }, [router])

  const k = data?.kpis

  return (
    <div style={{ display:'flex', height:'100vh', background:'#090C12', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />

      {/* Conteúdo */}
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#E8EAF0' }}>Dashboard</div>
          <div style={{ fontSize:11, color:'#8B95A8' }}>Visão consolidada da plataforma · {new Date().toLocaleDateString('pt-BR')}</div>
        </div>

        {isLoading ? (
          <div style={{ color:'#8B95A8', fontSize:12 }}>Carregando dados...</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:9, marginBottom:16 }}>
              {[
                { label:'Empresas ativas',  valor: k?.empresas.ativas ?? 0,      cor:'#29B6D8' },
                { label:'Usuários totais',  valor: k?.usuarios.total ?? 0,       cor:'#E8EAF0' },
                { label:'RDOs este mês',    valor: k?.rdos.mes ?? 0,             cor:'#E8EAF0' },
                { label:'MRR',              valor: `R$ ${(k?.receita.mrr ?? 0).toLocaleString('pt-BR')}`, cor:'#F59E0B' },
                { label:'Alertas abertos',  valor: k?.alertas.abertos ?? 0,      cor: (k?.alertas.abertos ?? 0) > 0 ? '#E05C5C' : '#4CAF7D' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, padding:'11px 13px' }}>
                  <div style={{ fontSize:22, fontWeight:600, color: kpi.cor, marginBottom:3 }}>{kpi.valor}</div>
                  <div style={{ fontSize:10, color:'#8B95A8' }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Receita por plano */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'9px 14px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', fontSize:12, fontWeight:500 }}>Receita por plano</div>
                <div style={{ padding:'13px 14px' }}>
                  {(data?.distribuicaoPlanos ?? []).map((d) => (
                    <div key={d.plano} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                        <span style={{ color:'#8B95A8' }}>{d.plano}</span>
                        <span style={{ color: d.plano==='ENTERPRISE' ? '#F59E0B' : '#4CAF7D', fontWeight:600 }}>
                          {d.receita > 0 ? `R$ ${d.receita.toLocaleString('pt-BR')}` : 'Grátis'}
                        </span>
                      </div>
                      <div style={{ height:5, background:'#161B25', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:5, borderRadius:3, background: d.plano==='ENTERPRISE' ? '#F59E0B' : d.plano==='PRO' ? '#29B6D8' : 'rgba(255,255,255,.15)', width: `${(k?.receita.mrr ?? 0) > 0 ? (d.receita/(k?.receita.mrr??1))*100 : 30}%` }} />
                      </div>
                      <div style={{ fontSize:9, color:'#4A5568', marginTop:2 }}>{d.empresas} empresa{d.empresas!==1?'s':''}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas recentes */}
              <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'9px 14px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', fontSize:12, fontWeight:500 }}>Alertas recentes</div>
                <div style={{ padding:'8px 0' }}>
                  {(data?.logsRecentes ?? []).length === 0 ? (
                    <div style={{ padding:'20px', textAlign:'center', color:'#4A5568', fontSize:11 }}>Nenhum alerta. Tudo em ordem!</div>
                  ) : (data?.logsRecentes ?? []).slice(0,5).map((log) => (
                    <div key={log.id} style={{ padding:'8px 14px', borderBottom:'.5px solid rgba(255,255,255,.05)', borderLeft:`3px solid ${log.nivel==='CRITICO'||log.nivel==='ERRO' ? '#E05C5C' : log.nivel==='AVISO' ? '#E6A817' : '#29B6D8'}` }}>
                      <div style={{ fontSize:11, color:'#E8EAF0', marginBottom:2 }}>{log.mensagem}</div>
                      <div style={{ fontSize:10, color:'#4A5568' }}>{log.tenant?.nome ?? 'Sistema'} · {new Date(log.criadoEm).toLocaleString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <AdminProviders>
      <DashboardContent />
    </AdminProviders>
  )
}
