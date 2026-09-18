import { Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_SENHA } from '../../lib/fake-db-test'

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel', { timeout: 15_000 })
}
