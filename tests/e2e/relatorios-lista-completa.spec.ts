import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Relatórios: "H/H por função" mostra TODAS as funções (antes só as 10 primeiras), com barra de
// rolagem quando são muitas. O mesmo vale para os outros gráficos de lista. Ver o grupo de
// H/H por função em app/api/app/relatorios/route.ts e .rel-rola em styles/globals.css.

test('H/H por função lista todas as funções, com rolagem no quadro', async ({ page }) => {
  await page.route('**/api/app/relatorios**', async (route) => {
    const resposta = await route.fetch()
    const dados = await resposta.json()
    dados.hhPorFuncao = Array.from({ length: 15 }, (_, i) => ({ funcao: `Função ${String(i + 1).padStart(2, '0')}`, totalHH: 100 - i }))
    dados.kpis.totalRdos = 3
    return route.fulfill({ response: resposta, json: dados })
  })
  await login(page)
  await page.goto('/relatorios')

  const quadro = page.locator('.sec', { hasText: 'H/H por função' }).locator('.rel-rola')
  await expect(quadro).toBeVisible()
  // as 15 funções estão no quadro (inclusive as depois da 10ª)
  await expect(quadro).toContainText('Função 15')
  await expect(quadro).toContainText('Função 01')
  // e o quadro rola: o conteúdo é maior que a área visível
  const { rolagem, visivel } = await quadro.evaluate(el => ({ rolagem: el.scrollHeight, visivel: el.clientHeight }))
  expect(rolagem).toBeGreaterThan(visivel)
})
