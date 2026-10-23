import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { PROJETO_ID, LEITOR_EMAIL } from '../../lib/fake-db-test'

// As telas do projeto (Visão geral / Acesso / Assinaturas) ficam num submenu recolhível sob
// "Painel de Projetos", no menu lateral, quando se está dentro da pasta de um projeto.
// Ver SubmenuProjeto em components/layout/Sidebar.tsx.

const submenu = (page: import('@playwright/test').Page) => page.locator('.sb-sub')

test('dentro do projeto, o menu lateral mostra Visão geral, Acesso e Assinaturas e navega entre elas', async ({ page }) => {
  await login(page)
  await page.goto('/painel')
  await expect(submenu(page)).toHaveCount(0) // fora de um projeto não há submenu

  await page.goto(`/projetos/${PROJETO_ID}`)
  await expect(submenu(page).getByRole('link', { name: 'Visão geral' })).toHaveClass(/on/)
  await expect(submenu(page).getByRole('link', { name: 'Acesso' })).toBeVisible()
  await expect(submenu(page).getByRole('link', { name: 'Assinaturas' })).toBeVisible()
  // as abas antigas do alto da tela saíram
  await expect(page.locator('.content').getByRole('button', { name: 'Assinaturas' })).toHaveCount(0)

  await submenu(page).getByRole('link', { name: 'Acesso' }).click()
  await page.waitForURL(`**/projetos/${PROJETO_ID}/acesso`)
  await expect(submenu(page).getByRole('link', { name: 'Acesso' })).toHaveClass(/on/)

  await submenu(page).getByRole('link', { name: 'Assinaturas' }).click()
  await page.waitForURL(`**/projetos/${PROJETO_ID}/assinaturas`)
  await expect(submenu(page).getByRole('link', { name: 'Assinaturas' })).toHaveClass(/on/)
})

test('o submenu do projeto pode ser recolhido e reaberto', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  await expect(submenu(page)).toBeVisible()
  // a página hidrata depois de carregar: repete o clique até o handler existir
  await expect(async () => {
    await page.getByRole('button', { name: 'Recolher telas do projeto' }).click()
    await expect(submenu(page)).toHaveCount(0, { timeout: 1500 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Mostrar telas do projeto' }).click()
  await expect(submenu(page)).toBeVisible()
})

test('quem não gerencia o projeto só vê a Visão geral no submenu', async ({ page }) => {
  await login(page, LEITOR_EMAIL)
  await page.goto(`/projetos/${PROJETO_ID}`)
  await expect(submenu(page).getByRole('link', { name: 'Visão geral' })).toBeVisible()
  await expect(submenu(page).getByRole('link', { name: 'Acesso' })).toHaveCount(0)
  await expect(submenu(page).getByRole('link', { name: 'Assinaturas' })).toHaveCount(0)
})
