import { test, expect, type APIRequestContext } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// No preenchimento do RDO a pessoa pode reordenar as atividades (↑ ↓) e editar as
// atividades avulsas (✎). A ordem é gravada (coluna ordem) e vale também na aprovação
// e no PDF. Ver FormularioRdo.tsx e o PATCH em app/api/app/rdos/[id]/route.ts.

type Reg = { id: string; avulsaNome: string; avulsaEtapa: string | null; pctAnterior: number; pctAtual: number }
const nova = (nome: string, extra: object = {}) => ({ avulsa: true, avulsaNome: nome, pctAnterior: 0, pctAtual: 10, ...extra })

async function criarRdoCom(api: APIRequestContext, nomes: string[], data: string) {
  const criado = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
  expect(criado.status()).toBe(201)
  const { id } = await criado.json()
  const ok = await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: nomes.map(n => nova(n)) } })
  expect(ok.status()).toBe(200)
  return id as string
}
const registros = async (api: APIRequestContext, id: string) =>
  (await (await api.get(`/api/app/rdos/${id}`)).json()).atividadeRegistros as Reg[]

test('a ordem das atividades e a edição da avulsa são gravadas pela API', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const id = await criarRdoCom(api, ['A', 'B', 'C'], '2026-10-21')
  const antes = await registros(api, id)
  expect(antes.map(r => r.avulsaNome)).toEqual(['A', 'B', 'C'])

  // reordena para C, A, B e renomeia a A (com etapa)
  const [a, b, c] = antes
  const lista = [c, { ...a, avulsaNome: 'A editada', avulsaEtapa: 'Etapa X' }, b].map(r => ({ ...r, avulsa: true }))
  expect((await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: lista } })).status()).toBe(200)
  const depois = await registros(api, id)
  expect(depois.map(r => r.avulsaNome)).toEqual(['C', 'A editada', 'B'])
  expect(depois[1].avulsaEtapa).toBe('Etapa X')

  // limpar a etapa também persiste
  const semEtapa = depois.map(r => ({ ...r, avulsa: true, avulsaEtapa: r.avulsaNome === 'A editada' ? null : r.avulsaEtapa }))
  expect((await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: semEtapa } })).status()).toBe(200)
  expect((await registros(api, id))[1].avulsaEtapa).toBeNull()
  await api.dispose()
})

test('na tela: mover para baixo e editar a avulsa, salvando o rascunho', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const id = await criarRdoCom(api, ['Primeira', 'Segunda'], '2026-10-22')

  await login(page)
  await page.goto(`/rdos/${id}`)
  await expect(page.getByText('Primeira')).toBeVisible()

  // o botão ↑ da primeira está desabilitado; ↓ troca com a segunda
  await expect(page.getByRole('button', { name: 'Mover atividade para cima' }).first()).toBeDisabled()
  await page.getByRole('button', { name: 'Mover atividade para baixo' }).first().click()

  // edita a (agora) segunda: "Primeira" → "Primeira revisada"
  await page.getByRole('button', { name: 'Editar atividade avulsa' }).nth(1).click()
  await page.getByPlaceholder('Descreva a atividade').fill('Primeira revisada')
  await page.locator('.mf2 .btn-p').click()

  const salvou = page.waitForResponse(r => r.url().includes(`/api/app/rdos/${id}`) && r.request().method() === 'PATCH')
  await page.locator('.ab').getByRole('button', { name: 'Rascunho' }).click()
  expect((await salvou).status()).toBe(200)

  expect((await registros(api, id)).map(r => r.avulsaNome)).toEqual(['Segunda', 'Primeira revisada'])
  await api.dispose()
})
