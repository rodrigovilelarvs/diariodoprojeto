import { test, expect } from '@playwright/test'
import { apiAdmin, loginAdmin } from './helpers'

// A tela "Uso & Limites" do super-admin mostra, pra cada empresa, o limite que
// o sistema realmente aplica — o gravado na empresa —, e não um número fixo
// por plano (antes, Starter aparecia sempre como 3 usuários, mesmo depois de
// o plano ou a empresa terem limite diferente).
//
// Roda depois de planos-admin.spec.ts (ordem alfabética), que já deixou as
// empresas Starter com limites alterados; aqui o teste define o seu próprio.

test('Uso & Limites mostra o limite real das empresas, não um valor fixo por plano', async ({ page, playwright }) => {
  // Muda o limite de usuários do Starter para 7 — as duas empresas Starter absorvem
  const api = await apiAdmin(playwright)
  const r = await api.patch('/api/admin/planos', { data: { tipo: 'STARTER', limiteUsuarios: 7 } })
  expect(r.status()).toBe(200)
  await api.dispose()

  await loginAdmin(page)
  await page.goto('/admin/uso')
  await expect(page.getByText('Empresa A (Starter)')).toBeVisible()

  // Cada empresa Starter tem 1 usuário e limite 7 → "1/7 (14%)" (nunca "1/3")
  await expect(page.getByText('1/7 (14%)')).toHaveCount(2)
  await expect(page.getByText('1/3 (33%)')).toHaveCount(0)
  // A empresa do plano Pro mostra o limite dela (10), não o do Starter
  await expect(page.getByText('1/10 (10%)')).toHaveCount(1)
})
