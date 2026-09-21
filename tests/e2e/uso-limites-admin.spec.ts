import { test, expect } from '@playwright/test'
import { apiAdmin, loginAdmin } from './helpers'

// A tela "Uso & Limites" do super-admin mostra, pra cada empresa, o limite que
// o sistema realmente aplica — o gravado na empresa —, e não um número fixo
// por plano (antes, Starter aparecia sempre como 3 usuários, mesmo depois de
// o plano ou a empresa terem limite diferente).
//
// Roda depois de planos-admin.spec.ts (ordem alfabética), que já deixou as
// empresas Starter com limites alterados; aqui o teste define o seu próprio.

test('Uso & Limites mostra o limite real de cada empresa e conta só os usuários ativos', async ({ page, playwright }) => {
  // Muda o limite de usuários do Starter para 7 — as duas empresas Starter absorvem
  const api = await apiAdmin(playwright)
  const r = await api.patch('/api/admin/planos', { data: { tipo: 'STARTER', limiteUsuarios: 7 } })
  expect(r.status()).toBe(200)
  await api.dispose()

  await loginAdmin(page)
  await page.goto('/admin/uso')
  await expect(page.getByText('Empresa A (Starter)')).toBeVisible()

  // Limite 7 nas duas Starter (nunca o "3" fixo de antes)
  await expect(page.getByText('/3 (')).toHaveCount(0)
  // A: 3 ativos + 1 inativo → conta 3 (só os ativos ocupam vaga), não 4
  await expect(page.getByText('3/7 (43%)')).toHaveCount(1)
  await expect(page.getByText('4/7 (57%)')).toHaveCount(0)
  // B: 1 ativo + 1 convite pendente → conta 1
  await expect(page.getByText('1/7 (14%)')).toHaveCount(1)
  // C (Pro): 1 ativo, com o limite dela (10), não o do Starter
  await expect(page.getByText('1/10 (10%)')).toHaveCount(1)
  // O total do topo também soma só ativos: 3 + 1 + 1
  await expect(page.getByText('Usuários ativos', { exact: true }).locator('xpath=preceding-sibling::div')).toHaveText('5')
})
