'use client'
// app/convite/[token]/page.tsx
// Aceitar convite — define nome e senha e ativa o acesso do usuário convidado

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ConviteInfo {
  email:       string
  nomeEmpresa: string
  perfilLabel: string
}

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [carregando, setCarregando] = useState(true)
  const [info, setInfo]             = useState<ConviteInfo | null>(null)
  const [erroCarga, setErroCarga]   = useState('')

  const [nome, setNome]           = useState('')
  const [senha, setSenha]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro]           = useState('')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/auth/convite?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) { setErroCarga(data.erro ?? 'Convite inválido.'); return }
        setInfo(data)
      })
      .catch(() => setErroCarga('Erro de conexão. Tente novamente.'))
      .finally(() => setCarregando(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!nome.trim()) { setErro('Informe seu nome completo.'); return }
    if (senha.length < 8) { setErro('A senha deve ter no mínimo 8 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome, senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao aceitar convite.'); return }

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0F1117', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div style={{ width:380, background:'#1C2333', border:'.5px solid rgba(255,255,255,.1)', borderRadius:14, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.7)' }}>
        <div style={{ background:'#151D2B', padding:'22px 26px', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:3, height:24, background:'#29B6D8', borderRadius:2 }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#29B6D8', letterSpacing:'.1em' }}>DIÁRIO DO PROJETO</span>
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:'#E8EAF0', marginLeft:13 }}>
            {carregando ? 'Carregando convite...' : info ? `Convite de ${info.nomeEmpresa}` : 'Convite'}
          </div>
        </div>

        <div style={{ padding:'24px 26px' }}>
          {carregando ? (
            <div style={{ fontSize:12, color:'#8B95A8', textAlign:'center', padding:20 }}>Verificando convite...</div>
          ) : erroCarga ? (
            <>
              <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#E05C5C', lineHeight:1.6 }}>
                {erroCarga}
              </div>
              <Link href="/login" style={{ display:'block', textAlign:'center', marginTop:18, fontSize:12, color:'#29B6D8', textDecoration:'none' }}>
                ← Ir para o login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ background:'rgba(41,182,216,.07)', border:'.5px solid rgba(41,182,216,.2)', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#8B95A8', marginBottom:16, lineHeight:1.6 }}>
                Você foi convidado como <strong style={{ color:'#29B6D8' }}>{info?.perfilLabel}</strong> em <strong style={{ color:'#E8EAF0' }}>{info?.nomeEmpresa}</strong>.<br />
                E-mail: {info?.email}
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>Nome completo</label>
                <input
                  type="text" required value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#151D2B', color:'#E8EAF0', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>Criar senha</label>
                <input
                  type="password" required value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#151D2B', color:'#E8EAF0', fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
                />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:5 }}>Confirmar senha</label>
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
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{ width:'100%', padding:10, borderRadius:8, background: loading ? 'rgba(41,182,216,.4)' : '#29B6D8', border:'none', color:'#0F1117', fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}
              >
                {loading ? 'Criando acesso...' : 'Aceitar convite e entrar'}
              </button>
            </form>
          )}
        </div>
      </div>
      <style>{`* { box-sizing: border-box; } input:focus { outline: none; border-color: rgba(41,182,216,.5) !important; }`}</style>
    </div>
  )
}
