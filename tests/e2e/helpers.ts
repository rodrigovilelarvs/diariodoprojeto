import { expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_SENHA } from '../../lib/fake-db-test'

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel', { timeout: 15_000 })
}

// Cliente de API já autenticado. O app real manda o token de duas formas:
// cookie app_token (o middleware exige) e header Authorization: Bearer (o
// requireAuth lê); o token vem no corpo da resposta do login.
export async function apiComo(
  playwright: PlaywrightWorkerArgs['playwright'],
  email: string = ADMIN_EMAIL,
  baseURL = 'http://localhost:3100',
): Promise<APIRequestContext> {
  const login = await playwright.request.newContext({ baseURL })
  const res = await login.post('/api/auth/login', { data: { email, senha: ADMIN_SENHA } })
  expect(res.ok(), `login de ${email}`).toBeTruthy()
  const { token } = await res.json()
  await login.dispose()
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } })
}
