# Diário do Projeto

Plataforma SaaS de gestão de RDOs (Registros Diários de Obra).

## Stack
Next.js 15 · TypeScript · Tailwind · React Query · Prisma · Supabase · Vercel

## Rotas compiladas
- 19 API Routes (empresa + super-admin)
- 10 páginas (Login, Painel, RDOs, Tarefas, Relatórios, Notificações, Usuários + Admin)

## Setup rápido

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 3. Gerar Prisma Client (precisa de banco real)
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 4. Rodar em dev
npm run dev
```

## Estrutura
```
app/
├── (app)/          ← Páginas da empresa (protegidas)
│   ├── painel/
│   ├── rdos/
│   ├── tarefas/
│   ├── relatorios/
│   ├── notificacoes/
│   └── usuarios/
├── (admin)/        ← Super-admin (protegido)
│   └── dashboard/
└── api/
    ├── auth/       ← Login empresa + convites
    ├── app/        ← API da empresa
    └── admin/      ← API do super-admin

lib/                ← Cliente HTTP, tipos, auth, Prisma
hooks/              ← React Query hooks
contexts/           ← AuthContext (empresa + admin)
components/         ← UI, Layout, Sidebar, Topbar
styles/             ← Design tokens do protótipo
```

## Deploy
Ver DEPLOY.md para guia completo Vercel + Supabase.
