import type { Metadata, Viewport } from 'next'
import './globals.css'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Diário do Projeto',
  description: 'Gestão de RDOs e obras',
}

// Sem isso, o navegador do celular renderiza a página numa viewport virtual
// de desktop (~980px) e só ajusta certo se a pessoa marcar "ver como
// computador" — com isso ele já assume a largura real da tela.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem('diario_tema') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch (e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
