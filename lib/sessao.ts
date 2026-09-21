// src/lib/sessao.ts
// Grava no navegador a sessão de quem acabou de entrar numa empresa (login,
// convite aceito, troca de empresa). O token vai em cookie (o middleware lê) e
// no localStorage (o cliente de API manda no header Authorization).

import type { LoginResponse } from '@/lib/types'

export function salvarSessaoApp(data: LoginResponse) {
  document.cookie = `app_token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
  localStorage.setItem('app_token', data.token)
  localStorage.setItem('app_session', JSON.stringify({
    usuario: data.usuario, tenantId: data.tenant.id,
    tenantNome: data.tenant.nome, perfil: data.usuario.perfil,
  }))
}
