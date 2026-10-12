import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { RDO_ANTERIOR_ID } from '../../lib/fake-db-test'

// Atividade avulsa (fora da lista de tarefas) no preenchimento do RDO: só o nome é
// obrigatório; a etapa é opcional. Sem etapa, aparece como "Avulsa".

async function abrirModalAtividade(page: import('@playwright/test').Page) {
  await login(page)
  await page.goto(`/rdos/${RDO_ANTERIOR_ID}`)
  await page.getByRole('button', { name: 'Adicionar atividade' }).click()
  await page.getByLabel(/Atividade avulsa/).check()
}

test('atividade avulsa sem etapa é aceita (só o nome é obrigatório)', async ({ page }) => {
  await abrirModalAtividade(page)
  await page.getByPlaceholder('Descreva a atividade').fill('Limpeza do canteiro')
  await page.locator('.mf2 .btn-p').click()

  await expect(page.getByText('Informe o nome da atividade avulsa.')).toHaveCount(0)
  await expect(page.getByText('Limpeza do canteiro')).toBeVisible()
  await expect(page.getByText('Avulsa', { exact: true })).toBeVisible()
})

test('atividade avulsa continua exigindo o nome', async ({ page }) => {
  await abrirModalAtividade(page)
  await page.getByPlaceholder('Ex: Serviços extras').fill('Serviços extras')
  await page.locator('.mf2 .btn-p').click()
  await expect(page.getByText('Informe o nome da atividade avulsa.')).toBeVisible()
})
