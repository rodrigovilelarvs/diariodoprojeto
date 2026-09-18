// middleware.ts — raiz do projeto
// Protege rotas: redireciona usuários não autenticados para /login

import { NextRequest, NextResponse } from 'next/server'

// Rotas que NÃO precisam de autenticação
const PUBLICAS = [
  '/login',
  '/admin/login',
  '/recuperar-senha',
  '/convite',
  '/api/auth/login',
  '/api/auth/convite',
  '/api/auth/recuperar-senha',
  '/api/auth/redefinir-senha',
  '/api/admin/auth/login',
  '/api/cron/', // autenticação própria via CRON_SECRET (ver app/api/cron/*)
  '/api/app/client-error', // recebe erro de tela mesmo sem token válido (best-effort)
]

// Prefixo das rotas do super-admin
const ADMIN_PREFIX = '/admin'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Libera rotas públicas e assets
  if (
    PUBLICAS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // ── Rotas do super-admin (/admin/*) ─────────────────────
  if (pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith('/api/admin')) {
    const adminToken = req.cookies.get('admin_token')?.value

    if (!adminToken) {
      // API → retorna 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
      }
      // Página → redireciona para login admin
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }

    return NextResponse.next()
  }

  // ── Rotas da empresa (/app/* e /api/app/*) ───────────────
  const appToken = req.cookies.get('app_token')?.value

  if (!appToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protege tudo exceto arquivos estáticos
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
