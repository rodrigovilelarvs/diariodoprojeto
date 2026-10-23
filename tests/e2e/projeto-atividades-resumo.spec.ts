import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Pasta do projeto: o card "Atividades" abre a lista de tudo que foi registrado nos RDOs (da lista
// de tarefas E avulsas). Bug real: as avulsas apareciam como "(atividade removida)" porque o nome
// só era lido da atividade da lista de tarefas, e o card abria a Lista de tarefas (vazia para
// quem só usa avulsas). Ver app/api/app/projetos/[id]/resumo/route.ts.

test('o resumo do projeto traz o nome das atividades avulsas', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const resumo = await (await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()
  const itens = resumo.atividades as Array<{ nome: string; avulsa: boolean }>
  expect(itens.find(a => a.nome === 'Serviço avulso')).toMatchObject({ avulsa: true })
  expect(itens.find(a => a.nome === 'Avulsa concluída')).toMatchObject({ avulsa: true })
  expect(itens.find(a => a.nome === 'Atividade da lista a 100%')).toMatchObject({ avulsa: false })
  expect(itens.some(a => a.nome === '(atividade removida)')).toBe(false)
  await api.dispose()
})

test('clicar no card Atividades da pasta abre a lista com as avulsas, com nome', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  const card = page.getByText('Atividades', { exact: true }).first()
  await expect(async () => {
    await card.click()
    await expect(page.getByText('Conteúdo do projeto')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  const modal = page.locator('.modal')
  await expect(modal.getByText('Serviço avulso')).toBeVisible()
  await expect(modal.getByText('Avulsa', { exact: true }).first()).toBeVisible()
  await expect(modal.getByText('(atividade removida)')).toHaveCount(0)
})

// A lista é agrupada por RDO/dia (o RDO e a data aparecem uma vez no cabeçalho do grupo) e cada
// atividade ocupa uma linha só, com o andamento ao lado do nome.
test('atividades do projeto saem agrupadas por RDO, com o percentual na mesma linha', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  const card = page.getByText('Atividades', { exact: true }).first()
  await expect(async () => {
    await card.click()
    await expect(page.getByText('Conteúdo do projeto')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  const modal = page.locator('.modal')

  // as 3 atividades do RDO #0900 estão sob um único cabeçalho
  await expect(modal.getByText(/RDO #0900/)).toHaveCount(1)
  await expect(modal.getByText('3 registros')).toBeVisible()

  // o percentual fica na linha da atividade (mesmo elemento de linha, não num bloco abaixo)
  const linha = modal.locator('div', { hasText: /^Avulsa.*Serviço avulso.*20% → 40% \(\+20%\)$/ }).last()
  await expect(linha).toBeVisible()
})
