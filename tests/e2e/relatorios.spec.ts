import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Smoke test — a tela de relatórios agrega vários endpoints diferentes;
// isso pega uma quebra de renderização em qualquer um dos gráficos sem
// precisar testar cada um a fundo.
test('tela de relatórios carrega sem quebrar', async ({ page }) => {
  await login(page)
  await page.goto('/relatorios')

  await expect(page.getByText('Algo deu errado nesta tela')).toHaveCount(0)
  await expect(page.getByText('H/H por categoria de mão de obra')).toBeVisible()
  await expect(page.getByText('Top 5 — piores desvios')).toBeVisible()
  await expect(page.getByText('Tempo médio de aprovação de RDO')).toBeVisible()
})
