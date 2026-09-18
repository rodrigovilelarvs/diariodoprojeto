'use client'
// components/superadmin/AdminSidebar.tsx

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AdminSidebar() {
  const router   = useRouter()
  const pathname = usePathname()
  const [nome, setNome] = useState('')

  useEffect(() => {
    try { setNome(JSON.parse(localStorage.getItem('admin_session') ?? '{}').nome ?? '') } catch {}
  }, [])

  function sair() {
    document.cookie = 'admin_token=; path=/; max-age=0'
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_session')
    router.push('/admin/login')
  }

  const NAV = [
    { label:'Dashboard',     path:'/admin/dashboard', icon:'📊' },
    { label:'Empresas',      path:'/admin/empresas',  icon:'🏢' },
    { label:'Auditoria',     path:'/admin/auditoria', icon:'📋' },
    { label:'Uso & Limites', path:'/admin/uso',       icon:'📈' },
    { label:'Planos',        path:'/admin/planos',    icon:'💳' },
  ]

  return (
    <div style={{ width:200, background:'#0F1520', borderRight:'.5px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', flexShrink:0, height:'100vh' }}>
      <div style={{ padding:'14px', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#F59E0B', letterSpacing:'.08em' }}>DIÁRIO DO PROJETO</div>
        <div style={{ fontSize:9, color:'#4A5568', marginTop:2 }}>Painel do Proprietário</div>
        <div style={{ display:'inline-flex', marginTop:7, background:'rgba(245,158,11,.1)', border:'.5px solid rgba(245,158,11,.3)', borderRadius:20, padding:'2px 8px' }}>
          <span style={{ fontSize:9, fontWeight:600, color:'#F59E0B' }}>👑 Super Admin</span>
        </div>
      </div>
      <nav style={{ padding:7, flex:1 }}>
        {NAV.map(item => {
          const ativo = pathname === item.path
          return (
            <div key={item.label} onClick={() => router.push(item.path)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 9px', borderRadius:8, fontSize:11.5, cursor:'pointer', marginBottom:1, color: ativo ? '#F59E0B' : '#8B95A8', background: ativo ? 'rgba(245,158,11,.08)' : 'transparent', fontWeight: ativo ? 500 : 400, transition:'all .15s' }}>
              <span style={{ fontSize:14 }}>{item.icon}</span>
              {item.label}
            </div>
          )
        })}
      </nav>
      <div style={{ padding:'9px 12px', borderTop:'.5px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(245,158,11,.15)', color:'#F59E0B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
          {nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:500, color:'#E8EAF0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</div>
          <button onClick={sair} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#4A5568', fontFamily:'inherit', padding:0 }}>Sair</button>
        </div>
      </div>
    </div>
  )
}
