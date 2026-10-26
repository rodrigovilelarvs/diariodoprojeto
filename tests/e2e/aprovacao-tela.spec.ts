import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// "Aprovação" (item do menu) é uma tela dedicada: só RDOs pendentes de aprovação, sem o filtro de
// status (projeto, grupo e busca continuam). Links antigos /rdos?status=PENDENTE_APROVACAO vão para ela.
// Ver app/(app)/aprovacao/page.tsx e RdosContent (modoAprovacao) em app/(app)/rdos/page.tsx.

test('a tela de Aprovação mostra só RDOs pendentes e não tem o filtro de status', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-06-01', copiarAnterior: false } })
  const { id } = await r.json()
  expect((await api.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  await page.goto('/painel')
  // (a página hidrata depois de carregar: repete o clique até a navegação acontecer)
  await expect(async () => {
    await page.locator('.sb').getByRole('link', { name: /Aprovação/ }).click()
    await page.waitForURL('**/aprovacao', { timeout: 3000 })
  }).toPass({ timeout: 20_000 })

  await expect(page.getByText('RDOs enviados que aguardam aprovação')).toBeVisible()
  // sem filtro de status e sem botão de novo RDO; os demais filtros continuam
  await expect(page.locator('select.fsel option', { hasText: 'Todos os status' })).toHaveCount(0)
  await expect(page.locator('.main').getByRole('button', { name: 'Novo RDO' })).toHaveCount(0)
  await expect(page.locator('select.fsel option', { hasText: 'Todos os projetos' })).toHaveCount(1)
  await expect(page.getByPlaceholder(/Buscar por projeto/)).toBeVisible()

  // só pendentes: todas as linhas trazem o selo "Pendente"
  const linhas = page.locator('tbody tr')
  await expect(linhas.first()).toBeVisible()
  const textos = await linhas.allInnerTexts()
  expect(textos.length).toBeGreaterThan(0)
  for (const t of textos) expect(t).toMatch(/Pendente/)
})

test('link antigo /rdos?status=PENDENTE_APROVACAO leva para a tela de Aprovação', async ({ page }) => {
  await login(page)
  await page.goto('/rdos?status=PENDENTE_APROVACAO')
  await page.waitForURL('**/aprovacao')
  await expect(page.locator('select.fsel option', { hasText: 'Todos os status' })).toHaveCount(0)
})

test('a Lista de RDOs continua com o filtro de status', async ({ page }) => {
  await login(page)
  await page.goto('/rdos')
  await expect(page.locator('select.fsel option', { hasText: 'Todos os status' })).toHaveCount(1)
})

// A paginação (setas no pé da lista) conta só o que a lista mostra. Bug: depois de os cartões
// passarem a somar todos os status, a tela de Aprovação mostrava setas de página mesmo com poucos
// RDOs pendentes, porque usava o total de todos os status.
for (const caminho of ['/aprovacao', '/rdos?status=x']) {
  test(`sem setas de paginação quando a lista tem poucos RDOs, mesmo com muitos em outros status (${caminho})`, async ({ page }) => {
    await page.route('**/api/app/rdos?**', async (route) => {
      const resposta = await route.fetch()
      const dados = await resposta.json()
      dados.total = 3 // o que a lista mostra
      dados.porStatus = { PENDENTE_APROVACAO: 3, APROVADO: 40, RASCUNHO: 5 } // todos os status (cartões)
      return route.fulfill({ response: resposta, json: dados })
    })
    await login(page)
    await page.goto(caminho === '/rdos?status=x' ? '/rdos' : caminho)
    await expect(page.locator('.kgrid')).toBeVisible()
    await expect(page.locator('tbody')).toBeVisible()
    await expect(page.locator('.content i.ti-chevron-right')).toHaveCount(0)
  })
}

// Número e "Abrir" são links de verdade (abrem o RDO mesmo que o clique na linha não responda,
// e aceitam "abrir em nova aba"); na Aprovação o link já leva para a fila de aprovação.
test('o botão Abrir da Aprovação é um link para o RDO, no modo fila', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-08-01', copiarAnterior: false } })
  const { id } = await r.json()
  expect((await api.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  await page.goto('/aprovacao')
  const abrir = page.locator('tbody').getByRole('link', { name: 'Abrir' }).first()
  await expect(abrir).toBeVisible()
  await expect(abrir).toHaveAttribute('href', /\/aprovacao\/[^?]+\?fila=pendentes/)
  await abrir.click()
  await page.waitForURL(u => u.pathname.startsWith('/aprovacao/') && u.searchParams.get('fila') === 'pendentes')
})
