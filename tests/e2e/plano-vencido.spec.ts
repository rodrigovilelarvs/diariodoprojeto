import { test, expect } from '@playwright/test'
import { apiAdmin } from './helpers'
import { planoVencido, mensagemPlanoVencido } from '../../lib/plano-vencimento'
import { MULTI_EMAIL, ADMIN_SENHA, TENANT2_ID } from '../../lib/fake-db-test'

// Plano vencido: depois da data de vencimento da empresa, ninguém dela entra (login e sessão aberta).
// O acesso vale até o fim do dia do vencimento (horário de Brasília). Sem data, não vence.
// Ver lib/plano-vencimento.ts, motivoDeBloqueio (lib/contas.ts) e requireAuth (lib/auth.ts).

test.describe('regra da data (função pura)', () => {
  const venc = new Date('2026-11-05') // gravada como meia-noite UTC
  test('sem data de vencimento o plano não vence', () => {
    expect(planoVencido(null)).toBe(false)
    expect(planoVencido(undefined)).toBe(false)
  })
  test('vale até o fim do dia do vencimento (horário de Brasília) e vence no dia seguinte', () => {
    // 05/11 às 23:00 em Brasília = 06/11 02:00 UTC: ainda é o dia do vencimento
    expect(planoVencido(venc, new Date('2026-11-06T02:00:00Z'))).toBe(false)
    // 06/11 às 01:00 em Brasília: já passou
    expect(planoVencido(venc, new Date('2026-11-06T04:00:00Z'))).toBe(true)
    // antes da data
    expect(planoVencido(venc, new Date('2026-11-01T12:00:00Z'))).toBe(false)
  })
  test('a mensagem traz a data', () => {
    expect(mensagemPlanoVencido(venc)).toContain('05/11/2026')
  })
})

test('empresa com plano vencido: o login e a sessão aberta são barrados; renovar libera de novo', async ({ playwright }) => {
  const publico = await playwright.request.newContext({ baseURL: 'http://localhost:3100' })
  const entrar = () => publico.post('/api/auth/login', { data: { email: MULTI_EMAIL, senha: ADMIN_SENHA, tenantId: TENANT2_ID } })

  // sessão aberta na empresa Dois antes de vencer
  const antes = await entrar()
  expect(antes.status()).toBe(200)
  const { token } = await antes.json()
  const sessao = await playwright.request.newContext({ baseURL: 'http://localhost:3100', extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } })
  expect((await sessao.get('/api/app/projetos')).status()).toBe(200)

  const admin = await apiAdmin(playwright)
  try {
    // venceu ontem
    expect((await admin.patch(`/api/admin/tenants/${TENANT2_ID}`, { data: { dataVencimentoPlano: '2020-01-01' } })).status()).toBe(200)

    // login nessa empresa: barrado, com o motivo
    const login = await entrar()
    expect(login.status()).toBe(403)
    expect((await login.json()).erro).toContain('venceu em 01/01/2020')
    // a sessão que já estava aberta também cai
    const api = await sessao.get('/api/app/projetos')
    expect(api.status()).toBe(403)
    expect((await api.json()).codigo).toBe('PLANO_VENCIDO')
    // quem tem conta em outra empresa (não vencida) continua entrando nela
    const outra = await publico.post('/api/auth/login', { data: { email: MULTI_EMAIL, senha: ADMIN_SENHA } })
    expect(outra.status()).toBe(200)
    expect((await outra.json()).tenant.id).not.toBe(TENANT2_ID)

    // renovou: vencimento no futuro
    expect((await admin.patch(`/api/admin/tenants/${TENANT2_ID}`, { data: { dataVencimentoPlano: '2099-12-31' } })).status()).toBe(200)
    expect((await entrar()).status()).toBe(200)
    expect((await sessao.get('/api/app/projetos')).status()).toBe(200)
  } finally {
    await admin.patch(`/api/admin/tenants/${TENANT2_ID}`, { data: { dataVencimentoPlano: null } })
  }
  await sessao.dispose(); await publico.dispose(); await admin.dispose()
})

test('a tela de login mostra o aviso quando a sessão foi encerrada por plano vencido', async ({ page }) => {
  await page.goto('/login?aviso=plano-vencido')
  await expect(page.getByText(/O plano da sua empresa venceu/)).toBeVisible()
})
