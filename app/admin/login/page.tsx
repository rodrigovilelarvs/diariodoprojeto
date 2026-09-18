'use client'
// app/admin/login/page.tsx
// Login do super-admin — chama API diretamente, sem hook

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro ?? 'Credenciais inválidas.')
        return
      }

      // Salva token e sessão
      // Salva em cookie para o middleware ler (necessário para SSR)
      document.cookie = `admin_token=${data.token}; path=/; max-age=${7*24*60*60}; SameSite=Lax`
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('admin_session', JSON.stringify({
        adminId: data.admin.id,
        nome:    data.admin.nome,
        email:   data.admin.email,
      }))

      router.push('/admin/dashboard')
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#090C12',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: 380, background: '#0F1520',
        border: '.5px solid rgba(255,255,255,.1)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,.7)',
      }}>
        {/* Header */}
        <div style={{ background: '#151D2B', padding: '22px 26px', borderBottom: '.5px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 3, height: 24, background: '#F59E0B', borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '.1em' }}>
              DIÁRIO DO PROJETO
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#E8EAF0', marginLeft: 13 }}>
            Painel do Proprietário
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, marginLeft: 13, background: 'rgba(245,158,11,.1)', border: '.5px solid rgba(245,158,11,.3)', borderRadius: 20, padding: '2px 10px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B' }}>👑 Super Admin</span>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 26px' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 5 }}>E-mail</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@email.com"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '.5px solid rgba(255,255,255,.12)', background: '#151D2B',
                  color: '#E8EAF0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#8B95A8', display: 'block', marginBottom: 5 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'} required value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8,
                    border: '.5px solid rgba(255,255,255,.12)', background: '#151D2B',
                    color: '#E8EAF0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button" onClick={() => setMostrarSenha(v => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15,
                    color: '#8B95A8', padding: 0,
                  }}
                >
                  <i className={`ti ${mostrarSenha ? 'ti-eye-off' : 'ti-eye'}`} />
                </button>
              </div>
            </div>

            {erro && (
              <div style={{
                background: 'rgba(224,92,92,.1)', border: '.5px solid rgba(224,92,92,.3)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E05C5C', marginBottom: 14,
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: 10, borderRadius: 8,
                background: loading ? 'rgba(245,158,11,.4)' : '#F59E0B',
                border: 'none', color: '#090C12', fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <div style={{
            marginTop: 18, padding: '10px 12px',
            background: 'rgba(245,158,11,.06)', border: '.5px solid rgba(245,158,11,.2)',
            borderRadius: 8, fontSize: 11, color: '#8B95A8',
          }}>
            🔒 Acesso restrito ao proprietário da plataforma.
          </div>
        </div>

        <div style={{ padding: '10px 26px', background: '#090C12', borderTop: '.5px solid rgba(255,255,255,.05)', fontSize: 10, color: '#2A3547', textAlign: 'center' }}>
          © 2026 RVS Gestão de Projetos
        </div>
      </div>

      <style>{`* { box-sizing: border-box; } input:focus { outline: none; border-color: rgba(245,158,11,.5) !important; }`}</style>
    </div>
  )
}
