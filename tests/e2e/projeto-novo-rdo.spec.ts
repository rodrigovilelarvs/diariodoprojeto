import { test, expect } from '@playwright/test'
import { login, abrirJanelaNovoRdo } from './helpers'
import { PROJETO_ID, PROJETO_NOME } from '../../lib/fake-db-test'

// O Novo RDO abre numa janela (modal) por cima da tela atual — menu, painel, lista, pasta do
// projeto — em vez de levar a outra página. Dentro da pasta do projeto, tudo que se cria é
// daquele projeto: a janela abre com ele já selecionado. Cancelar só fecha a janela.
// Ver components/rdos/NovoRdoModal.tsx.

const janela = (page: import('@playwright/test').Page) => page.locator('.modal').filter({ hasText: 'Novo RDO' })

test('botão Novo RDO na pasta do projeto abre a janela com o projeto já selecionado, sem sair da pasta', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  // espera a pasta carregar: só então existe o botão do alto da tela (além do item do menu)
  await expect(page.getByRole('button', { name: 'Novo RDO' })).toHaveCount(2)
  await abrirJanelaNovoRdo(page, page.getByRole('button', { name: 'Novo RDO' }).last())

  await expect(janela(page)).toBeVisible()
  await expect(janela(page).locator('select')).toHaveValue(PROJETO_ID)
  await expect(janela(page).locator('select option:checked')).toHaveText(PROJETO_NOME)
  expect(new URL(page.url()).pathname).toBe(`/projetos/${PROJETO_ID}`)

  // Cancelar fecha a janela e a pessoa continua na pasta
  await janela(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(janela(page)).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe(`/projetos/${PROJETO_ID}`)
})

test('Novo RDO do menu abre a janela sem projeto escolhido, por cima da tela atual', async ({ page }) => {
  await login(page)
  await page.goto('/rdos')
  await abrirJanelaNovoRdo(page, page.locator('.sb').getByRole('button', { name: 'Novo RDO' }))

  await expect(janela(page)).toBeVisible()
  await expect(janela(page).locator('select')).toHaveValue('')
  expect(new URL(page.url()).pathname).toBe('/rdos')

  await janela(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(janela(page)).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe('/rdos')
})

test('links antigos /rdos/novo continuam funcionando: abrem a janela sobre a lista ou a pasta do projeto', async ({ page }) => {
  await login(page)

  await page.goto('/rdos/novo')
  await expect(janela(page)).toBeVisible()
  await page.waitForURL('**/rdos')

  await page.goto(`/rdos/novo?projetoId=${PROJETO_ID}`)
  await expect(janela(page)).toBeVisible()
  await expect(janela(page).locator('select')).toHaveValue(PROJETO_ID)
  await page.waitForURL(`**/projetos/${PROJETO_ID}`)
})
