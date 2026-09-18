'use client'
// app/recuperar-senha/page.tsx
// Solicita o link de redefinição de senha por e-mail

import { useState } from 'react'
import Link from 'next/link'

export default function RecuperarSenhaPage() {
  const [email, setEmail]     = useState('')
  const [erro, setErro]       = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao solicitar redefinição.'); return }
      setEnviado(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0F1117', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width:380, background:'#1C2333', border:'.5px solid rgba(255,255,255,.1)', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.7)' }}>
        <div style={{ background:'#151D2B', padding:'22px 26px', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:3, height:24, background:'#29B6D8', borderRadius:2 }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#29B6D8', letterSpacing:'.1em' }}>DIÁRIO DO PROJETO</span>
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:'#E8EAF0', marginLeft:13 }}>Recuperar senha</div>
        </div>

        <div style={{ padding:'24px 26px' }}>
          {enviado ? (
            <>
              <div style={{ background:'rgba(76,175,125,.1)', border:'.5px solid rgba(76,175,125,.3)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#4CAF7D', lineHeight:1.6 }}>
                Se este e-mail estiver cadastrado, você vai receber um link de redefinição em instantes. Confira também a caixa de spam.
              </div>
              <Link href="/login" style={{ display:'block', textAlign:'center', marginTop:18, fontSize:12, color:'#29B6D8', textDecoration:'none' }}>
                ← Voltar para o login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>E-mail cadastrado</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#151D2B', color:'#E8EAF0', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                />
              </div>

              {erro && (
                <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#E05C5C', marginBottom:14 }}>
                  {erro}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ width:'100%', padding:10, borderRadius:8, background: loading ? 'rgba(41,182,216,.4)' : '#29B6D8', border:'none', color:'#0F1117', fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}
              >
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>

              <Link href="/login" style={{ display:'block', textAlign:'center', marginTop:16, fontSize:12, color:'#8B95A8', textDecoration:'none' }}>
                ← Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
      <style>{`* { box-sizing: border-box; } input:focus { outline: none; border-color: rgba(41,182,216,.5) !important; }`}</style>
    </div>
  )
}
