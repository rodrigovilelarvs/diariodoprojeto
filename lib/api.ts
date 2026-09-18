// src/lib/api.ts
// Cliente HTTP centralizado — injeta token, trata erros, tipagem base

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// ── Tipos de erro ────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public status:  number,
    public codigo?: string,
    message?: string,
  ) {
    super(message ?? `Erro ${status}`)
    this.name = 'ApiError'
  }
}

export class LimitePlanoError extends ApiError {
  constructor(message: string) {
    super(402, 'LIMITE_PLANO', message)
    this.name = 'LimitePlanoError'
  }
}

// Extrai uma mensagem de erro amigável de um `catch (err)` tipado como
// `unknown` — substitui o padrão antigo `catch (err: any) { err?.message }`
// (não seguro: qualquer coisa pode ser lançada, não só Error/ApiError).
export function mensagemErro(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

// ── Recupera token do localStorage ─────────────────────────
function getToken(admin = false): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(admin ? 'admin_token' : 'app_token')
}

// ── Fetch base ───────────────────────────────────────────────
async function apiFetch<T>(
  path:    string,
  options: RequestInit & { admin?: boolean } = {},
): Promise<T> {
  const { admin = false, ...init } = options
  const token = getToken(admin)

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  // Token expirado — redireciona para login
  if (res.status === 401) {
    localStorage.removeItem(admin ? 'admin_token' : 'app_token')
    window.location.href = admin ? '/admin/login' : '/login'
    throw new ApiError(401, undefined, 'Sessão expirada.')
  }

  // Plano insuficiente
  if (res.status === 402) {
    const body = await res.json().catch(() => ({}))
    throw new LimitePlanoError(body.erro ?? 'Limite do plano atingido.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.codigo, body.erro ?? `Erro ${res.status}`)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Helpers por método ───────────────────────────────────────
export const api = {
  get: <T>(path: string, admin = false) =>
    apiFetch<T>(path, { method: 'GET', admin }),

  post: <T>(path: string, body: unknown, admin = false) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), admin }),

  patch: <T>(path: string, body: unknown, admin = false) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), admin }),

  delete: <T>(path: string, body?: unknown, admin = false) =>
    apiFetch<T>(path, {
      method: 'DELETE',
      body:   body ? JSON.stringify(body) : undefined,
      admin,
    }),
}
