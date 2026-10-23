import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { RDO_ANTERIOR_ID } from '../../lib/fake-db-test'

// Mão de obra no formulário do RDO: os cartões não podem passar da borda da seção (antes, com
// grade de 4 colunas fixas, o campo de horário empurrava o último cartão para fora e ele ficava
// cortado). A grade agora ajusta o número de colunas à largura disponível.
for (const largura of [1000, 1300, 1600]) {
  test(`cartões de mão de obra ficam inteiros dentro da seção (tela de ${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 })
    // o RDO de teste tem 1 mão de obra: multiplica para 6 cartões, como num RDO de verdade
    await page.route(`**/api/app/rdos/${RDO_ANTERIOR_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      const resposta = await route.fetch()
      const rdo = await resposta.json()
      const base = rdo.maoDeObra[0]
      rdo.maoDeObra = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `mo-x${i}`, funcaoNome: `Função ${i + 1}`, categoria: 'TERCEIRIZADA' }))
      return route.fulfill({ response: resposta, json: rdo })
    })
    await login(page)
    await page.goto(`/rdos/${RDO_ANTERIOR_ID}`)
    const secao = page.locator('.sec', { hasText: 'Mão de obra' }).first()
    await expect(secao.locator('.rdo-item-grid > div')).toHaveCount(6)
    const limite = (await secao.boundingBox())!
    for (const cartao of await secao.locator('.rdo-item-grid > div').all()) {
      const caixa = (await cartao.boundingBox())!
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(limite.x + limite.width + 0.5)
      // e nada dentro do cartão passa da borda dele (horário de saída, por exemplo)
      for (const campo of await cartao.locator('input').all()) {
        const c = (await campo.boundingBox())!
        expect(c.x + c.width).toBeLessThanOrEqual(caixa.x + caixa.width + 0.5)
      }
    }
  })
}
