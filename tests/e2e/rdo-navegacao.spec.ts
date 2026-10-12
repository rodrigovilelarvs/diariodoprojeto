import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'
import { urlDoRdo } from '../../lib/rdo-display'

// As setas ‹ RDO #N › entre os RDOs do projeto funcionam em qualquer estado do RDO:
// rascunho, enviado para aprovação ou aprovado — e cada RDO abre na tela certa para o
// seu estado. Ver components/rdos/NavegacaoRdos.tsx e urlDoRdo() em lib/rdo-display.ts.

test('cada estado do RDO abre na tela certa', () => {
  expect(urlDoRdo({ id: 'a', status: 'RASCUNHO' })).toBe('/rdos/a')
  expect(urlDoRdo({ id: 'a', status: 'REJEITADO' })).toBe('/rdos/a')
  expect(urlDoRdo({ id: 'a', status: 'PENDENTE_APROVACAO' })).toBe('/aprovacao/a')
  expect(urlDoRdo({ id: 'a', status: 'APROVADO' })).toBe('/aprovacao/a')
})

test('RDO enviado para aprovação continua com as setas e leva ao anterior e de volta', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const criar = async (data: string) => {
    const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
    expect(r.status()).toBe(201)
    return (await r.json()).id as string
  }
  await criar('2026-11-11')
  const b = await criar('2026-11-12')
  expect((await api.post(`/api/app/rdos/${b}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  // o RDO enviado abre na tela de Aprovação; as setas estão lá
  await page.goto(`/aprovacao/${b}`)
  await expect(page.getByRole('button', { name: 'RDO anterior' })).toBeEnabled()

  await page.getByRole('button', { name: 'RDO anterior' }).click()
  await page.waitForURL(u => /\/(rdos|aprovacao)\//.test(u.pathname) && !u.pathname.endsWith(b))

  // e o "próximo" do anterior volta para o RDO enviado (que abre na Aprovação)
  await page.getByRole('button', { name: 'Próximo RDO' }).click()
  await page.waitForURL(`**/aprovacao/${b}`)

  // também aparecem no próprio formulário, mesmo bloqueado (barra inferior sempre visível)
  await page.goto(`/rdos/${b}`)
  await expect(page.getByRole('button', { name: 'RDO anterior' })).toBeEnabled()
})

test('na tela de aprovação a barra de ações fica fixa no rodapé (sem rolar até o fim)', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2026-11-13', copiarAnterior: false } })
  const { id } = await r.json()
  expect((await api.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  await page.goto(`/aprovacao/${id}`)
  for (const nome of ['Voltar à lista', 'Novo RDO', 'Voltar para rascunho', 'Excluir RDO']) {
    await expect(page.getByRole('button', { name: nome }), nome).toBeInViewport()
  }
  // continua visível mesmo com a página rolada
  await page.locator('.content').evaluate(e => { e.scrollTop = e.scrollHeight })
  await expect(page.getByRole('button', { name: 'Excluir RDO' })).toBeInViewport()
  await page.locator('.content').evaluate(e => { e.scrollTop = 0 })
  await expect(page.getByRole('button', { name: 'Excluir RDO' })).toBeInViewport()
})
