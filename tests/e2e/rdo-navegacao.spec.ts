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
    // (o item "Novo RDO" do menu lateral também tem esse nome: o da barra é o último)
    await expect(page.getByRole('button', { name: nome }).last(), nome).toBeInViewport()
  }
  // continua visível mesmo com a página rolada
  await page.locator('.content').evaluate(e => { e.scrollTop = e.scrollHeight })
  await expect(page.getByRole('button', { name: 'Excluir RDO' })).toBeInViewport()
  await page.locator('.content').evaluate(e => { e.scrollTop = 0 })
  await expect(page.getByRole('button', { name: 'Excluir RDO' })).toBeInViewport()
})

test('aberto pela fila de aprovação, as setas andam só pelos RDOs pendentes', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const criar = async (data: string) => {
    const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
    expect(r.status()).toBe(201)
    return (await r.json()).id as string
  }
  // A pendente (01/01), D rascunho (02/01), B pendente (03/01)
  const a = await criar('2027-01-01')
  await criar('2027-01-02')
  const b = await criar('2027-01-03')
  expect((await api.post(`/api/app/rdos/${a}/enviar`, { data: {} })).status()).toBe(200)
  expect((await api.post(`/api/app/rdos/${b}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  await page.goto(`/aprovacao/${b}?fila=pendentes`)
  await expect(page.getByText(/pendente \d+ de \d+/)).toBeVisible()

  // ‹ pula o rascunho e vai direto para o A, mantendo a fila na URL
  await page.getByRole('button', { name: 'RDO anterior' }).click()
  await page.waitForURL(u => u.pathname.endsWith(`/aprovacao/${a}`) && u.search.includes('fila=pendentes'))

  // › volta para o B
  await page.getByRole('button', { name: 'Próximo RDO' }).click()
  await page.waitForURL(u => u.pathname.endsWith(`/aprovacao/${b}`) && u.search.includes('fila=pendentes'))
})

test('abrir um RDO pela lista filtrada em "pendentes" (item Aprovação do menu) entra no modo fila', async ({ page }) => {
  await login(page)
  await page.goto('/rdos?status=PENDENTE_APROVACAO')
  const linha = page.locator('tbody tr').first()
  await expect(linha).toBeVisible()
  await linha.click()
  await page.waitForURL(u => u.pathname.startsWith('/aprovacao/') && u.search.includes('fila=pendentes'))

  // "Voltar à lista" volta para a lista dos pendentes
  await page.getByRole('button', { name: 'Voltar à lista' }).click()
  await page.waitForURL(u => u.pathname === '/rdos' && u.search.includes('status=PENDENTE_APROVACAO'))
})

test('aberto pela Lista de RDOs normal, as setas continuam andando por todos os RDOs do projeto', async ({ page }) => {
  await login(page)
  await page.goto('/rdos')
  await page.locator('tbody tr').first().click()
  await page.waitForURL(u => /^\/(rdos|aprovacao)\//.test(u.pathname) && !u.search.includes('fila='))
})

test('na fila de aprovação filtrada por projeto, as setas só consideram os pendentes daquele projeto', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-03-01', copiarAnterior: false } })
  const { id } = await r.json()
  expect((await api.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await api.dispose()

  await login(page)
  await page.goto('/rdos?status=PENDENTE_APROVACAO')
  // filtra por projeto na lista
  const selecao = page.locator('select.fsel').filter({ has: page.locator('option', { hasText: 'Todos os projetos' }) })
  await selecao.selectOption(PROJETO_ID)
  await expect(page.locator('tbody tr').first()).toBeVisible()

  // ao abrir um RDO, o filtro vai junto para a fila e para as consultas das setas
  const pedido = page.waitForRequest(req => {
    const u = new URL(req.url())
    return u.pathname === '/api/app/rdos' && u.searchParams.get('status') === 'PENDENTE_APROVACAO'
      && u.searchParams.get('projetoId') === PROJETO_ID && u.searchParams.get('sortBy') === 'data'
  })
  await page.locator('tbody tr').first().click()
  await page.waitForURL(u => u.pathname.startsWith('/aprovacao/')
    && u.searchParams.get('fila') === 'pendentes' && u.searchParams.get('projetoId') === PROJETO_ID)
  await pedido

  // "Voltar à lista" recupera o filtro de projeto
  await page.getByRole('button', { name: 'Voltar à lista' }).click()
  await page.waitForURL(u => u.pathname === '/rdos' && u.searchParams.get('projetoId') === PROJETO_ID
    && u.searchParams.get('status') === 'PENDENTE_APROVACAO')
  await expect(page.locator('select.fsel').filter({ has: page.locator('option', { hasText: 'Todos os projetos' }) })).toHaveValue(PROJETO_ID)
})
