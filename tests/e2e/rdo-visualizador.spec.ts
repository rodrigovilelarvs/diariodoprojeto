import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID, LEITOR_EMAIL } from '../../lib/fake-db-test'

// Perfil visualizador (nem emite nem aprova RDOs): só enxerga o que já foi enviado para
// aprovação ou está aprovado; rascunhos e RDOs a revisar são invisíveis para ele, e ele não
// edita nada. Quem emite ou aprova continua vendo tudo. Ver soVeRdosEnviados() e
// rdoOcultoParaVisualizador() em lib/auth.ts.

type Api = Awaited<ReturnType<typeof apiComo>>

async function rdo(api: Api, data: string) {
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
  expect(r.status()).toBe(201)
  return (await r.json()).id as string
}
const ids = async (api: Api, qs = '') =>
  ((await (await api.get(`/api/app/rdos?projetoId=${PROJETO_ID}&por=500${qs}`)).json()).rdos as Array<{ id: string }>).map(r => r.id)

test('visualizador não vê rascunho; depois de enviado para aprovação passa a ver', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const id = await rdo(admin, '2027-02-01')
  await admin.patch(`/api/app/rdos/${id}`, { data: { observacoes: 'trabalho em andamento' } })

  const leitor = await apiComo(playwright, LEITOR_EMAIL)

  // rascunho: some da lista e o detalhe não existe para ele
  expect(await ids(leitor)).not.toContain(id)
  expect((await leitor.get(`/api/app/rdos/${id}`)).status()).toBe(404)
  // visualizador também não comenta (nem em RDO que ele não vê)
  expect((await leitor.post(`/api/app/rdos/${id}/comentarios`, { data: { texto: 'oi' } })).status()).toBe(403)
  expect((await leitor.get(`/api/app/rdos/${id}/log`)).status()).toBe(404)
  // quem emite continua vendo
  expect(await ids(admin)).toContain(id)

  // enviado para aprovação: o visualizador passa a ver, com o conteúdo
  expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  expect(await ids(leitor)).toContain(id)
  const visto = await (await leitor.get(`/api/app/rdos/${id}`)).json()
  expect(visto.observacoes).toBe('trabalho em andamento')

  await leitor.dispose(); await admin.dispose()
})

test('visualizador não consegue editar nem mexer no RDO enviado', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const id = await rdo(admin, '2027-02-02')
  expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)

  const leitor = await apiComo(playwright, LEITOR_EMAIL)
  expect((await leitor.patch(`/api/app/rdos/${id}`, { data: { observacoes: 'x' } })).status()).toBe(403)
  expect((await leitor.post(`/api/app/rdos/${id}/reabrir`, { data: {} })).status()).toBe(403)
  expect((await leitor.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(403)
  expect((await leitor.post(`/api/app/rdos/${id}/aprovar`, { data: { aprovado: true } })).status()).toBe(403)
  expect((await leitor.delete(`/api/app/rdos/${id}`)).status()).toBe(403)

  // e não comenta, nem edita, nem apaga comentário — mesmo no RDO que ele enxerga
  expect((await leitor.post(`/api/app/rdos/${id}/comentarios`, { data: { texto: 'oi' } })).status()).toBe(403)
  expect((await leitor.patch(`/api/app/rdos/${id}/comentarios/c1`, { data: { texto: 'x' } })).status()).toBe(403)
  expect((await leitor.delete(`/api/app/rdos/${id}/comentarios/c1`)).status()).toBe(403)
  await leitor.dispose(); await admin.dispose()
})

test('filtro por status "rascunho" devolve vazio para o visualizador', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  await rdo(admin, '2027-02-03')
  const leitor = await apiComo(playwright, LEITOR_EMAIL)
  expect(await ids(leitor, '&status=RASCUNHO')).toEqual([])
  expect((await ids(admin, '&status=RASCUNHO')).length).toBeGreaterThan(0)
  await leitor.dispose(); await admin.dispose()
})

test('na tela, o visualizador vê o RDO enviado mas sem caixa de comentário', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  const id = await rdo(admin, '2027-02-04')
  expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await admin.dispose()

  await login(page, LEITOR_EMAIL)
  await page.goto(`/aprovacao/${id}`)
  await expect(page.getByText('Comentários').first()).toBeVisible()
  await expect(page.getByPlaceholder(/Escrever comentário/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Comentar' })).toHaveCount(0)
})

test('na tela, quem emite ou aprova continua tendo a caixa de comentário', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  const id = await rdo(admin, '2027-02-05')
  expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  await admin.dispose()

  await login(page)
  await page.goto(`/aprovacao/${id}`)
  await expect(page.getByPlaceholder(/Escrever comentário/)).toBeVisible()
})
