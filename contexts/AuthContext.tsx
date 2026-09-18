// src/contexts/AuthContext.tsx
// Contexto de autenticação — empresa e super-admin separados

'use client'

import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { UsuarioResumo, LoginResponse, AdminLoginResponse } from '@/lib/types'

// ── Contexto da EMPRESA ──────────────────────────────────────
interface AppSession {
  usuario:  UsuarioResumo
  tenantId: string
  tenantNome: string
}

interface AppAuthCtx {
  session:   AppSession | null
  loading:   boolean
  login:     (email: string, senha: string) => Promise<void>
  logout:    () => void
  pode:      (acao: PermissaoApp) => boolean
  atualizarUsuarioSessao: (dados: Partial<UsuarioResumo>) => void
}

type PermissaoApp =
  | 'emitir_rdo'
  | 'aprovar_rdo'
  | 'gerenciar_usuarios'
  | 'ver_relatorios'
  | 'gerenciar_projetos'
  | 'gerenciar_tarefas'

// Cada ação aponta pra flag correspondente em UsuarioResumo — ADMIN sempre
// tem tudo liberado, PERSONALIZADO depende do que foi marcado em /usuarios.
// (Antes isso era uma tabela estática por perfil, fácil de dessincronizar
// da checagem real do backend em lib/auth.ts — agora lê a flag direto.)
const PERMISSAO_CAMPO: Record<PermissaoApp, keyof UsuarioResumo> = {
  emitir_rdo:          'permEmitirRdo',
  aprovar_rdo:         'permAprovarRdo',
  gerenciar_usuarios:  'permGerenciarEquipe',
  ver_relatorios:      'permVerRelatorios',
  gerenciar_projetos:  'permGerenciarProjetos',
  gerenciar_tarefas:   'permGerenciarTarefas',
}

const AppAuthContext = createContext<AppAuthCtx | null>(null)

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Restaura sessão do localStorage
  useEffect(() => {
    const raw = localStorage.getItem('app_session')
    if (raw) {
      try {
        setSession(JSON.parse(raw))
      } catch {
        localStorage.removeItem('app_session')
        localStorage.removeItem('app_token')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const data = await api.post<LoginResponse>('/api/auth/login', { email, senha })

    const sess: AppSession = {
      usuario:    data.usuario,
      tenantId:   data.tenant.id,
      tenantNome: data.tenant.nome,
    }

    document.cookie = `app_token=${data.token}; path=/; max-age=${7*24*60*60}; SameSite=Lax`
    localStorage.setItem('app_token',   data.token)
    localStorage.setItem('app_session', JSON.stringify(sess))
    setSession(sess)
    router.push('/painel')
  }, [router])

  const logout = useCallback(() => {
    document.cookie = 'app_token=; path=/; max-age=0'
    localStorage.removeItem('app_token')
    localStorage.removeItem('app_session')
    setSession(null)
    router.push('/login')
  }, [router])

  const pode = useCallback(
    (acao: PermissaoApp): boolean => {
      if (!session) return false
      if (session.usuario.perfil === 'ADMIN') return true
      return !!session.usuario[PERMISSAO_CAMPO[acao]]
    },
    [session],
  )

  // Reflete na sidebar/sessão local uma mudança feita em "Meu perfil" (nome,
  // foto) sem precisar deslogar e logar de novo
  const atualizarUsuarioSessao = useCallback((dados: Partial<UsuarioResumo>) => {
    setSession(s => {
      if (!s) return s
      const atualizado: AppSession = { ...s, usuario: { ...s.usuario, ...dados } }
      localStorage.setItem('app_session', JSON.stringify(atualizado))
      return atualizado
    })
  }, [])

  // Sincroniza perfil e permissões com o banco ao carregar o app — uma sessão
  // em cache de antes de uma troca de perfil (feita por um admin, ou uma
  // migração como a de ADMIN/PERSONALIZADO) não fica presa mostrando botões
  // de permissão desatualizados até o usuário deslogar e logar de novo.
  useEffect(() => {
    if (loading || !session) return
    api.get<UsuarioResumo>('/api/app/perfil')
      .then(fresh => atualizarUsuarioSessao({
        perfil:                fresh.perfil,
        permEmitirRdo:         fresh.permEmitirRdo,
        permAprovarRdo:        fresh.permAprovarRdo,
        permGerenciarProjetos: fresh.permGerenciarProjetos,
        permGerenciarEquipe:   fresh.permGerenciarEquipe,
        permVerRelatorios:     fresh.permVerRelatorios,
        permGerenciarTarefas:  fresh.permGerenciarTarefas,
      }))
      .catch(() => {}) // silencioso — se falhar, mantém a sessão em cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <AppAuthContext.Provider value={{ session, loading, login, logout, pode, atualizarUsuarioSessao }}>
      {children}
    </AppAuthContext.Provider>
  )
}

export function useAppAuth() {
  const ctx = useContext(AppAuthContext)
  if (!ctx) throw new Error('useAppAuth deve ser usado dentro de AppAuthProvider')
  return ctx
}

// ── Contexto do SUPER-ADMIN ──────────────────────────────────
interface AdminSession {
  adminId: string
  nome:    string
  email:   string
}

interface AdminAuthCtx {
  session: AdminSession | null
  loading: boolean
  login:   (email: string, senha: string) => Promise<void>
  logout:  () => void
}

const AdminAuthContext = createContext<AdminAuthCtx | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const raw = localStorage.getItem('admin_session')
    if (raw) {
      try {
        setSession(JSON.parse(raw))
      } catch {
        localStorage.removeItem('admin_session')
        localStorage.removeItem('admin_token')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const data = await api.post<AdminLoginResponse>(
      '/api/admin/auth/login',
      { email, senha },
      true, // admin = true
    )

    const sess: AdminSession = {
      adminId: data.admin.id,
      nome:    data.admin.nome,
      email:   data.admin.email,
    }

    localStorage.setItem('admin_token',   data.token)
    localStorage.setItem('admin_session', JSON.stringify(sess))
    setSession(sess)
    router.push('/admin/dashboard')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_session')
    setSession(null)
    router.push('/admin/login')
  }, [router])

  return (
    <AdminAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth deve ser usado dentro de AdminAuthProvider')
  return ctx
}
