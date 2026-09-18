'use client'
// app/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router  = useRouter()
  const [email, setEmail]   = useState('')
  const [senha, setSenha]   = useState('')
  const [erro, setErro]     = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao entrar.'); return }
      document.cookie = `app_token=${data.token}; path=/; max-age=${7*24*60*60}; SameSite=Lax`
      localStorage.setItem('app_token', data.token)
      localStorage.setItem('app_session', JSON.stringify({
        usuario: data.usuario, tenantId: data.tenant.id,
        tenantNome: data.tenant.nome, perfil: data.usuario.perfil,
      }))
      router.push('/painel')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0F1117', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div className="login-card" style={{ display:'flex', width:800, height:520, borderRadius:16, overflow:'hidden', border:'.5px solid rgba(255,255,255,.14)' }}>
        {/* Painel esquerdo */}
        <div className="login-left" style={{ width:'44%', background:'#131B2A', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'28px 26px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', width:260, height:260, borderRadius:'50%', background:'rgba(41,182,216,.07)', top:-60, right:-60 }} />
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#29B6D8', letterSpacing:'.08em' }}>DIÁRIO DO PROJETO</div>
            <div style={{ fontSize:17, fontWeight:500, color:'#fff', lineHeight:1.4, margin:'22px 0 7px' }}>Gestão de obras com precisão e rastreabilidade</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', lineHeight:1.6 }}>Emita RDOs, acompanhe equipes, assinaturas digitais e relatórios em um só lugar.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:18 }}>
              {[{i:'ti-file-text',l:'Registro diário com assinatura digital'},{i:'ti-chart-bar',l:'Dashboards planejado × realizado'},{i:'ti-users',l:'Fluxo de aprovação configurável'},{i:'ti-file-export',l:'Exportação PDF'}].map(f=>(
                <div key={f.l} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:22, height:22, borderRadius:8, background:'rgba(41,182,216,.15)', border:'.5px solid rgba(41,182,216,.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`ti ${f.i}`} style={{ fontSize:11, color:'#29B6D8' }} />
                  </div>
                  <span style={{ fontSize:10.5, color:'rgba(255,255,255,.5)' }}>{f.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ background:'rgba(255,255,255,.05)', border:'.5px solid rgba(255,255,255,.09)', borderRadius:8, padding:'8px 10px' }}>
              <div style={{ fontSize:15, fontWeight:600, color:'#29B6D8' }}>Lei 14.063</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', marginTop:2 }}>Assinatura legal</div>
            </div>
          </div>
        </div>
        {/* Painel direito */}
        <div className="login-right" style={{ flex:1, background:'#1C2333', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 30px' }}>
          <div style={{ width:'100%', maxWidth:290 }}>
            <div style={{ fontSize:14, fontWeight:600, color:'#29B6D8', letterSpacing:'.5px', textAlign:'center', marginBottom:20 }}>DIÁRIO DO PROJETO</div>
            <form onSubmit={handleLogin}>
              {[{t:'email',p:'seu@email.com',v:email,s:setEmail,i:'ti-mail'},{t:'password',p:'••••••••',v:senha,s:setSenha,i:'ti-lock'}].map(f=>(
                <div key={f.t} style={{ position:'relative', marginBottom:10 }}>
                  <i className={`ti ${f.i}`} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#546070' }} />
                  <input type={f.t === 'password' && mostrarSenha ? 'text' : f.t} required placeholder={f.p} value={f.v} onChange={e=>f.s(e.target.value)}
                    style={{ width:'100%', padding: f.t === 'password' ? '7px 30px 7px 30px' : '7px 10px 7px 30px', borderRadius:8, border:'.5px solid rgba(255,255,255,.14)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit' }} />
                  {f.t === 'password' && (
                    <button
                      type="button" onClick={()=>setMostrarSenha(v=>!v)}
                      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', fontSize:13, color:'#546070', padding:0 }}
                    >
                      <i className={`ti ${mostrarSenha ? 'ti-eye-off' : 'ti-eye'}`} />
                    </button>
                  )}
                </div>
              ))}
              {erro && <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'7px 10px', fontSize:11, color:'#E05C5C', marginBottom:10 }}>{erro}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%', padding:8, borderRadius:8, background: loading ? 'rgba(41,182,216,.4)' : '#29B6D8', border:'none', color:'#0F1117', fontSize:13, fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:11, fontFamily:'inherit' }}>
                <i className={`ti ${loading ? 'ti-loader' : 'ti-login'}`} style={loading ? {animation:'spin 1s linear infinite'} : {}} />
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <Link href="/recuperar-senha" style={{ display:'block', textAlign:'center', fontSize:11, color:'#8B95A8', textDecoration:'none' }}>
                Esqueci minha senha
              </Link>
            </form>
            <div style={{ fontSize:10, color:'#546070', textAlign:'center', marginTop:10 }}>© 2026 RVS Gestão de Projetos</div>
          </div>
        </div>
      </div>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.31.0/tabler-icons.min.css" />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus{outline:none;border-color:rgba(41,182,216,.5)!important}
        *{box-sizing:border-box}
        @media (max-width:680px){
          .login-wrap{ padding:20px 14px; height:auto!important; }
          .login-card{ flex-direction:column!important; width:100%!important; max-width:400px!important; height:auto!important; }
          .login-left{ width:100%!important; padding:22px 20px!important; }
          .login-right{ padding:24px 20px!important; }
        }
      `}</style>
    </div>
  )
}
