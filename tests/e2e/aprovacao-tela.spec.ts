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
