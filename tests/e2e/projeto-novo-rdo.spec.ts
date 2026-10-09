import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { PROJETO_ID, PROJETO_NOME } from '../../lib/fake-db-test'

// Dentro da pasta do projeto, tudo que se cria é daquele projeto: o botão "Novo RDO"
// da visão geral abre o novo RDO já com o projeto selecionado.

test('botão Novo RDO na pasta do projeto abre o RDO com o projeto já selecionado', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  await expect(page.getByRole('button', { name: 'Novo RDO' })).toBeVisible()
  await page.getByRole('button', { name: 'Novo RDO' }).click()
  await page.waitForURL(`**/rdos/novo?projetoId=${PROJETO_ID}`)
  await expect(page.locator('select').first()).toHaveValue(PROJETO_ID)
  await expect(page.locator('select').first().locator('option:checked')).toHaveText(PROJETO_NOME)
})
