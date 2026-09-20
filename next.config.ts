import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Links de saída (e o Supabase Storage) não recebem o caminho completo
          // das telas internas — só a origem, e só em HTTPS.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // O app não usa câmera/microfone/localização via API do navegador
          // (a foto vem do seletor de arquivo do aparelho) — nega por padrão,
          // então um script injetado não consegue pedir esses acessos.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
