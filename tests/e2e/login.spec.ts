import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('login leva ao painel', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/\/painel/)
  await expect(page.getByText('Painel de Projetos')).toBeVisible()
})

test('credenciais erradas mostram mensagem de erro, sem navegar', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill('naoexiste@teste.com')
  await page.locator('input[type="password"]').fill('senhaerrada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(/incorretos/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
