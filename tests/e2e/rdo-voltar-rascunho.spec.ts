import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID, LEITOR_EMAIL, EMISSOR_EMAIL, GERENTE_EMAIL } from '../../lib/fake-db-test'

// Depois de enviado para aprovação o RDO fica travado; para editar é preciso voltá-lo
// para rascunho (botão "Voltar para rascunho"), o que reseta as assinaturas e é registrado
// no log. Pode voltar: quem aprova RDOs, ou quem emitiu o RDO enquanto não estiver aprovado.
// Ver PATCH em app/api/app/rdos/[id]/route.ts e .../reabrir/route.ts.

type Api = Awaited<ReturnType<typeof apiComo>>

async function rdoRascunho(api: Api, data: string) {
  const r = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
  expect(r.status()).toBe(201)
  return (await r.json()).id as string
}
const enviar = (api: Api, id: string) => api.post(`/api/app/rdos/${id}/enviar`, { data: {} })
const reabrir = (api: Api, id: string) => api.post(`/api/app/rdos/${id}/reabrir`, { data: {} })
const editar = (api: Api, id: string, observacoes: string) =>
  api.patch(`/api/app/rdos/${id}`, { data: { observacoes } })

test('em rascunho edita; depois de enviado trava; voltando para rascunho edita de novo', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const id = await rdoRascunho(api, '2026-11-02')

  expect((await editar(api, id, 'v1')).status()).toBe(200)
  expect((await enviar(api, id)).status()).toBe(200)

  const travado = await editar(api, id, 'v2')
  expect(travado.status()).toBe(400)
  expect((await travado.json()).codigo).toBe('RDO_TRAVADO')

  expect((await reabrir(api, id)).status()).toBe(200)
  expect((await editar(api, id, 'v3')).status()).toBe(200)
  await api.dispose()
})

test('quem não aprova nem emitiu o RDO não consegue voltá-lo para rascunho', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const id = await rdoRascunho(admin, '2026-11-03')
  expect((await enviar(admin, id)).status()).toBe(200)

  const leitor = await apiComo(playwright, LEITOR_EMAIL)
  expect((await reabrir(leitor, id)).status()).toBe(403)
  // quem só gerencia equipe (nem aprova, nem emitiu este RDO) também não pode
  const gerente = await apiComo(playwright, GERENTE_EMAIL)
  expect((await reabrir(gerente, id)).status()).toBe(403)
  await leitor.dispose(); await gerente.dispose(); await admin.dispose()
})

test('quem emitiu o RDO (sem poder aprovar) volta o próprio RDO para rascunho', async ({ playwright }) => {
  const emissor = await apiComo(playwright, EMISSOR_EMAIL)
  const id = await rdoRascunho(emissor, '2026-11-04')
  expect((await enviar(emissor, id)).status()).toBe(200)
  expect((await editar(emissor, id, 'x')).status()).toBe(400)

  expect((await reabrir(emissor, id)).status()).toBe(200)
  expect((await editar(emissor, id, 'x')).status()).toBe(200)
  await emissor.dispose()
})
