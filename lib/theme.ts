// lib/theme.ts
// Alternância de tema claro/escuro — preferência salva no navegador do usuário.

export type Tema = 'dark' | 'light'

const CHAVE = 'diario_tema'

export function lerTemaSalvo(): Tema {
  if (typeof window === 'undefined') return 'dark'
  try {
    return localStorage.getItem(CHAVE) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function aplicarTema(tema: Tema) {
  if (typeof document === 'undefined') return
  if (tema === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // localStorage indisponível (modo privado etc.) — tema ainda funciona nesta sessão
  }
}
