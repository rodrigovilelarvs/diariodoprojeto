import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Visão geral do projeto: os quadros "RDOs recentes" e "Fotos recentes" têm altura grande e fixa,
// qualquer que seja a tela, e "Informações do projeto" fica abaixo, vista rolando a página.

for (const altura of [700, 800]) {
  test(`quadros de RDOs/fotos recentes mantêm a mesma altura em tela de ${altura}px e as informações ficam abaixo`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: altura })
    await login(page)
    await page.goto(`/projetos/${PROJETO_ID}`)
    const corpoRdos = page.locator('.proj-two-col .sec-body').first()
    const corpoFotos = page.locator('.proj-two-col .sec-body').nth(1)
    await expect(corpoRdos).toBeVisible()
    expect((await corpoRdos.boundingBox())!.height).toBeCloseTo(560, 0)
    expect((await corpoFotos.boundingBox())!.height).toBeCloseTo(560, 0)

    // as informações do projeto ficam abaixo da dobra e aparecem ao rolar a página
    const info = page.getByText('Informações do projeto')
    await expect(info).not.toBeInViewport()
    await info.scrollIntoViewIfNeeded()
    await expect(info).toBeInViewport()
  })
}
