'use client'
// app/recuperar-senha/[token]/page.tsx
// Define a nova senha a partir do link recebido por e-mail

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RedefinirSenhaPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [senha, setSenha]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro]           = useState('')
  const [ok, setOk]               = useState(false)
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 8) { setErro('A senha deve ter no mínimo 8 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha: senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao redefinir senha.'); return }
      setOk(true)
      setTimeout(() => router.push('/login'), 2500)
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
          <div style={{ fontSize:16, fontWeight:600, color:'#E8EAF0', marginLeft:13 }}>Definir nova senha</div>
        </div>

        <div style={{ padding:'24px 26px' }}>
          {ok ? (
            <div style={{ background:'rgba(76,175,125,.1)', border:'.5px solid rgba(76,175,125,.3)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#4CAF7D', lineHeight:1.6 }}>
              Senha redefinida com sucesso! Redirecionando para o login...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>Nova senha</label>
                <input
                  type="password" required value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#151D2B', color:'#E8EAF0', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>Confirmar nova senha</label>
                <input
                  type="password" required value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repita a senha"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#151D2B', color:'#E8EAF0', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                />
              </div>

              {erro && (
                <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#E05C5C', marginBottom:14 }}>
                  {erro}
                  {erro.includes('expirado') && (
                    <div style={{ marginTop:6 }}>
                      <Link href="/recuperar-senha" style={{ color:'#29B6D8' }}>Solicitar novo link</Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ width:'100%', padding:10, borderRadius:8, background: loading ? 'rgba(41,182,216,.4)' : '#29B6D8', border:'none', color:'#0F1117', fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}
              >
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>
      </div>
      <style>{`* { box-sizing: border-box; } input:focus { outline: none; border-color: rgba(41,182,216,.5) !important; }`}</style>
    </div>
  )
}
