import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { join } from 'path'
import { login } from './helpers'
import { SECOES } from '../../app/(app)/ajuda/conteudo'

// Manual do usuário (/ajuda): página dentro do sistema, visível a qualquer
// pessoa logada, com índice, busca e capturas de tela em public/ajuda/.

test('todas as imagens citadas no manual existem em public/ajuda', () => {
  const srcs: string[] = []
  for (const s of SECOES) {
    for (const b of s.blocos) {
      if (b.t === 'img') srcs.push(b.src)
      if (b.t === 'celulares') b.itens.forEach(i => srcs.push(i.src))
    }
  }
  expect(srcs.length).toBeGreaterThan(20)
  const faltando = srcs.filter(src => !existsSync(join(process.cwd(), 'public', src)))
  expect(faltando).toEqual([])
})

test('seções do manual têm ids únicos', () => {
  const ids = SECOES.map(s => s.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('a Ajuda abre pelo menu, lista as seções e a busca filtra', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Ajuda' }).click()
  await page.waitForURL('**/ajuda')
  await expect(page.getByText('Central de ajuda')).toBeVisible()

  const indice = page.getByRole('navigation', { name: 'Índice do manual' })
  await expect(indice.getByRole('button')).toHaveCount(SECOES.length)
  await expect(page.getByRole('heading', { name: 'Preencher o RDO', exact: true })).toBeVisible()

  // busca sem acento e sem diferenciar maiúsculas
  await page.getByPlaceholder('Buscar no manual...').fill('ASSINATURA digital')
  const achados = await indice.getByRole('button').count()
  expect(achados).toBeGreaterThan(0)
  expect(achados).toBeLessThan(SECOES.length)

  await page.getByPlaceholder('Buscar no manual...').fill('zzzxyz')
  await expect(page.getByText('Nenhum assunto encontrado')).toBeVisible()

  await page.getByLabel('Limpar busca').click()
  await expect(indice.getByRole('button')).toHaveCount(SECOES.length)
})

test('clicar numa captura de tela abre a imagem ampliada e Esc fecha', async ({ page }) => {
  await login(page)
  await page.goto('/ajuda')
  // a página hidrata depois de carregar: repete o clique até o handler existir
  await expect(async () => {
    await page.locator('.aj-fig-btn').first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 15000 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
