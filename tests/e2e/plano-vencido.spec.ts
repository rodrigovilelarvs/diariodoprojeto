import { test, expect } from '@playwright/test'
import { apiAdmin, login } from './helpers'
import { planoVencido, mensagemPlanoVencido, situacaoDoPlano, diasParaVencer } from '../../lib/plano-vencimento'
import { MULTI_EMAIL, ADMIN_SENHA, TENANT2_ID, TENANT_ID, LEITOR_EMAIL } from '../../lib/fake-db-test'

// Plano vencido: avisos 14 e 7 dias antes, 7 dias de tolerância depois do vencimento e, passado esse
// prazo, bloqueio de todos da empresa (login e sessão aberta). Sem data, não vence.
// Ver lib/plano-vencimento.ts, motivoDeBloqueio (lib/contas.ts), requireAuth (lib/auth.ts) e
// components/layout/AvisoPlano.tsx.

// "agora" ao meio-dia de Brasília (15:00Z) de um dia AAAA-MM-DD
const meioDia = (dia: string) => new Date(`${dia}T15:00:00Z`)
// Data (AAAA-MM-DD) a n dias de hoje, no horário de Brasília
function emDias(n: number): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return new Date(Date.parse(`${hoje}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

test.describe('regra das datas (função pura)', () => {
  const venc = new Date('2026-11-05') // gravada como meia-noite UTC

  test('sem data de vencimento o plano não vence nem avisa', () => {
    expect(planoVencido(null)).toBe(false)
    expect(planoVencido(undefined)).toBe(false)
    expect(situacaoDoPlano(null)).toEqual({ tipo: 'ok' })
  })

  test('conta de dias usa o dia de Brasília', () => {
    // 05/11 às 23:00 em Brasília = 06/11 02:00 UTC: ainda é 05/11
    expect(diasParaVencer(venc, new Date('2026-11-06T02:00:00Z'))).toBe(0)
    expect(diasParaVencer(venc, new Date('2026-11-06T04:00:00Z'))).toBe(-1)
  })

  test('bloqueia só depois de 7 dias de tolerância', () => {
    expect(planoVencido(venc, meioDia('2026-11-05'))).toBe(false) // dia do vencimento
    expect(planoVencido(venc, meioDia('2026-11-06'))).toBe(false) // 1 dia depois
    expect(planoVencido(venc, meioDia('2026-11-12'))).toBe(false) // 7 dias depois: último dia
    expect(planoVencido(venc, meioDia('2026-11-13'))).toBe(true)  // 8º dia: bloqueado
  })

  test('faixas de aviso: 14 dias, 7 dias, tolerância e bloqueio', () => {
    const tipo = (dia: string) => situacaoDoPlano(venc, meioDia(dia)).tipo
    expect(tipo('2026-10-20')).toBe('ok')           // 16 dias antes
    expect(tipo('2026-10-22')).toBe('aviso')        // 14 dias antes
    expect(tipo('2026-10-28')).toBe('aviso')        // 8 dias antes
    expect(tipo('2026-10-29')).toBe('aviso-forte')  // 7 dias antes
    expect(tipo('2026-11-05')).toBe('aviso-forte')  // vence hoje
    expect(tipo('2026-11-06')).toBe('tolerancia')   // 1 dia depois
    expect(tipo('2026-11-12')).toBe('tolerancia')   // último dia da tolerância
    expect(tipo('2026-11-13')).toBe('bloqueado')
  })

  test('as mensagens trazem as datas', () => {
    const s = situacaoDoPlano(venc, meioDia('2026-11-08'))
    expect(s.tipo === 'tolerancia' && s.mensagem).toContain('venceu em 05/11/2026')
    expect(s.tipo === 'tolerancia' && s.mensagem).toContain('até 12/11/2026')
    expect(mensagemPlanoVencido(venc)).toContain('05/11/2026')
  })
})

test('empresa com plano vencido: tolerância deixa entrar; depois dela o login e a sessão aberta são barrados', async ({ playwright }) => {
  const publico = await playwright.request.newContext({ baseURL: 'http://localhost:3100' })
  const entrar = () => publico.post('/api/auth/login', { data: { email: MULTI_EMAIL, senha: ADMIN_SENHA, tenantId: TENANT2_ID } })

  // sessão aberta na empresa Dois antes de vencer
  const antes = await entrar()
  expect(antes.status()).toBe(200)
  const { token } = await antes.json()
  const sessao = await playwright.request.newContext({ baseURL: 'http://localhost:3100', extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } })
  expect((await sessao.get('/api/app/projetos')).status()).toBe(200)

  const admin = await apiAdmin(playwright)
  const vencimento = (data: string | null) => admin.patch(`/api/admin/tenants/${TENANT2_ID}`, { data: { dataVencimentoPlano: data } })
  try {
    // venceu há 3 dias: está na tolerância, continua entrando
    expect((await vencimento(emDias(-3))).status()).toBe(200)
    expect((await entrar()).status()).toBe(200)
    expect((await sessao.get('/api/app/projetos')).status()).toBe(200)

    // venceu há mais de 7 dias: barrado
    expect((await vencimento('2020-01-01')).status()).toBe(200)
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
    expect((await vencimento('2099-12-31')).status()).toBe(200)
    expect((await entrar()).status()).toBe(200)
    expect((await sessao.get('/api/app/projetos')).status()).toBe(200)
  } finally {
    await vencimento(null)
  }
  await sessao.dispose(); await publico.dispose(); await admin.dispose()
})

test('a tela de login mostra o aviso quando a sessão foi encerrada por plano vencido', async ({ page }) => {
  await page.goto('/login?aviso=plano-vencido')
  await expect(page.getByText(/O plano da sua empresa venceu/)).toBeVisible()
})

test.describe('faixa de aviso para os administradores', () => {
  const faixa = (page: import('@playwright/test').Page) => page.getByTestId('aviso-plano')

  async function comVencimento(playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'], data: string | null, fn: () => Promise<void>) {
    const admin = await apiAdmin(playwright)
    try {
      expect((await admin.patch(`/api/admin/tenants/${TENANT_ID}`, { data: { dataVencimentoPlano: data } })).status()).toBe(200)
      await fn()
    } finally {
      await admin.patch(`/api/admin/tenants/${TENANT_ID}`, { data: { dataVencimentoPlano: null } })
      await admin.dispose()
    }
  }

  test('14 dias antes: aviso informativo; 7 dias antes: reforçado; na tolerância: de bloqueio próximo', async ({ page, playwright }) => {
    await login(page)
    for (const [dias, tipo, texto] of [
      [12, 'aviso', /em 12 dias/],
      [5, 'aviso-forte', /vence em 5 dias/],
      [-3, 'tolerancia', /prazo de tolerância/],
    ] as const) {
      await comVencimento(playwright, emDias(dias), async () => {
        await page.goto('/painel')
        await expect(faixa(page)).toBeVisible()
        await expect(faixa(page)).toHaveAttribute('data-tipo', tipo)
        await expect(faixa(page)).toContainText(texto)
      })
    }
  })

  test('sem aviso quando falta mais de 14 dias; quem não é administrador não vê', async ({ page, playwright }) => {
    await comVencimento(playwright, emDias(30), async () => {
      await login(page)
      await page.goto('/painel')
      await expect(page.locator('.sb')).toBeVisible()
      await expect(faixa(page)).toHaveCount(0)
    })
    await comVencimento(playwright, emDias(3), async () => {
      await page.goto('/painel')
      await expect(faixa(page)).toBeVisible() // administrador vê
      await page.evaluate(() => localStorage.clear())
      await login(page, LEITOR_EMAIL)        // quem não é administrador, não
      await page.goto('/painel')
      await expect(page.locator('.sb')).toBeVisible()
      await expect(faixa(page)).toHaveCount(0)
    })
  })
})
