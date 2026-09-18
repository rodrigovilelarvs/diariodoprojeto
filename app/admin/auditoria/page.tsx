'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminProviders } from '@/components/Providers'
import { AdminSidebar } from '@/components/superadmin/AdminSidebar'
import { useLogs } from '@/hooks/useAdmin'
import type { LogEntry } from '@/lib/types'

const NIVEL_COR: Record<string,string> = { INFO:'#29B6D8', AVISO:'#E6A817', ERRO:'#E05C5C', CRITICO:'#E05C5C' }
const NIVEL_BG:  Record<string,string> = { INFO:'rgba(41,182,216,.1)', AVISO:'rgba(230,168,23,.1)', ERRO:'rgba(224,92,92,.1)', CRITICO:'rgba(224,92,92,.15)' }
const CAT_EMOJI: Record<string,string> = { LOGIN:'🔐', RDO:'📄', USUARIO:'👤', PLANO:'💳', EMPRESA:'🏢', ASSINATURA:'✍️', SISTEMA:'⚙️' }

function AuditoriaContent() {
  const router = useRouter()
  const [nivel, setNivel]     = useState('')
  const [categoria, setCat]   = useState('')
  const [pagina, setPagina]   = useState(1)
  const [soPend, setSoPend]   = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_session')) router.push('/admin/login')
  }, [router])

  const { data, isLoading } = useLogs({ nivel: nivel || undefined, categoria: categoria || undefined, pagina, resolvido: soPend ? false : undefined })
  const logs  = data?.logs  ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ display:'flex', height:'100vh', background:'#090C12', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#E8EAF0' }}>Auditoria</div>
          <div style={{ fontSize:11, color:'#8B95A8' }}>Logs de segurança e rastreabilidade · {total} registros</div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9, marginBottom:16 }}>
          {[
            { l:'Total',    v: total,           cor:'#29B6D8' },
            { l:'Avisos',   v: data?.kpis?.porNivel?.AVISO ?? 0,   cor:'#E6A817' },
            { l:'Erros',    v: data?.kpis?.porNivel?.ERRO ?? 0,    cor:'#E05C5C' },
            { l:'Críticos', v: data?.kpis?.porNivel?.CRITICO ?? 0, cor:'#E05C5C' },
          ].map(k => (
            <div key={k.l} style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, padding:'11px 13px' }}>
              <div style={{ fontSize:22, fontWeight:600, color:k.cor, marginBottom:3 }}>{k.v}</div>
              <div style={{ fontSize:10, color:'#8B95A8' }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          {[
            { label:'Todos os níveis', val:'', k:'nivel' },
            { label:'Info',   val:'INFO',    k:'nivel' },
            { label:'Aviso',  val:'AVISO',   k:'nivel' },
            { label:'Erro',   val:'ERRO',    k:'nivel' },
            { label:'Crítico',val:'CRITICO', k:'nivel' },
          ].map(f => (
            <button key={f.val} onClick={() => { setNivel(f.val); setPagina(1) }}
              style={{ padding:'4px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontFamily:'inherit', border:'.5px solid', borderColor: nivel===f.val ? (NIVEL_COR[f.val]||'#29B6D8') : 'rgba(255,255,255,.1)', background: nivel===f.val ? (NIVEL_BG[f.val]||'rgba(41,182,216,.1)') : 'transparent', color: nivel===f.val ? (NIVEL_COR[f.val]||'#29B6D8') : '#8B95A8' }}>
              {f.label}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <select value={categoria} onChange={e => { setCat(e.target.value); setPagina(1) }}
            style={{ padding:'4px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.1)', background:'#1C2333', color:'#E8EAF0', fontSize:11, fontFamily:'inherit' }}>
            <option value="">Todas as categorias</option>
            {['LOGIN','RDO','USUARIO','PLANO','EMPRESA','ASSINATURA','SISTEMA'].map(c => <option key={c} value={c}>{CAT_EMOJI[c]} {c}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#8B95A8', cursor:'pointer' }}>
            <input type="checkbox" checked={soPend} onChange={e => setSoPend(e.target.checked)} />
            Só não resolvidos
          </label>
        </div>

        {/* Tabela */}
        <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
            <thead>
              <tr style={{ background:'#161B25' }}>
                {['Nível','Categoria','Mensagem','Empresa','Data/Hora',''].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'#8B95A8', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#8B95A8' }}>Carregando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#4A5568' }}>Nenhum log encontrado.</td></tr>
              ) : logs.map((log: LogEntry) => (
                <tr key={log.id} style={{ borderBottom:'.5px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, fontWeight:500, background: NIVEL_BG[log.nivel]||'transparent', color: NIVEL_COR[log.nivel]||'#E8EAF0', border:`.5px solid ${NIVEL_COR[log.nivel]||'#E8EAF0'}40` }}>
                      {log.nivel}
                    </span>
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#8B95A8' }}>
                    {CAT_EMOJI[log.categoria]} {log.categoria}
                  </td>
                  <td style={{ padding:'8px 12px', maxWidth:320 }}>
                    <div style={{ fontSize:12, color:'#E8EAF0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.mensagem}</div>
                    {log.notaInterna && <div style={{ fontSize:10, color:'#4A5568', marginTop:2 }}>📝 {log.notaInterna}</div>}
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#8B95A8' }}>{log.tenant?.nome ?? 'Sistema'}</td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#8B95A8' }}>{new Date(log.criadoEm).toLocaleString('pt-BR')}</td>
                  <td style={{ padding:'8px 12px' }}>
                    {!log.resolvido && (log.nivel === 'ERRO' || log.nivel === 'CRITICO' || log.nivel === 'AVISO') && (
                      <button style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(76,175,125,.1)', border:'.5px solid rgba(76,175,125,.3)', color:'#4CAF7D', cursor:'pointer', fontFamily:'inherit' }}>
                        Resolver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > 50 && (
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:10 }}>
            <button disabled={pagina<=1} onClick={() => setPagina(p=>p-1)}
              style={{ padding:'4px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.1)', background:'transparent', color:'#8B95A8', cursor: pagina<=1 ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:11 }}>← Anterior</button>
            <span style={{ fontSize:11, color:'#8B95A8', padding:'4px 10px' }}>{pagina} / {Math.ceil(total/50)}</span>
            <button disabled={pagina>=Math.ceil(total/50)} onClick={() => setPagina(p=>p+1)}
              style={{ padding:'4px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.1)', background:'transparent', color:'#8B95A8', cursor: pagina>=Math.ceil(total/50) ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:11 }}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuditoriaPage() {
  return <AdminProviders><AuditoriaContent /></AdminProviders>
}
