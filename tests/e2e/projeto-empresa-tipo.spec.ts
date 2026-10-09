import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// O sistema serve a contratadas e a contratantes. Cada projeto marca de qual lado
// está a empresa informada (empresaTipo) e o rótulo escolhido aparece no RDO, na
// aprovação e nos PDFs ("Empresa contratada" ou "Empresa contratante").
// Ver components/projetos/EmpresaCampo.tsx e lib/rdo-display.ts (rotuloEmpresa).

test('criar projeto aceita o tipo de empresa e recusa valor inválido', async ({ playwright }) => {
  const api = await apiComo(playwright)

  const ok = await api.post('/api/app/projetos', { data: { nome: 'Obra do cliente', empresaContratada: 'Incorporadora Beta', empresaTipo: 'CONTRATANTE' } })
  expect(ok.status()).toBe(201)
  expect((await ok.json()).empresaTipo).toBe('CONTRATANTE')

  const ruim = await api.post('/api/app/projetos', { data: { nome: 'Obra', empresaTipo: 'FORNECEDOR' } })
  expect(ruim.status()).toBe(400)
  await api.dispose()
})

test('editar projeto recusa tipo de empresa inválido', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const ruim = await api.patch(`/api/app/projetos/${PROJETO_ID}`, { data: { empresaTipo: 'XYZ' } })
  expect(ruim.status()).toBe(400)
  const ok = await api.patch(`/api/app/projetos/${PROJETO_ID}`, { data: { empresaTipo: 'CONTRATADA' } })
  expect(ok.status()).toBe(200)
  await api.dispose()
})

test('o projeto no RDO traz o tipo de empresa (padrão: contratada)', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const lista = await (await api.get(`/api/app/rdos?projetoId=${PROJETO_ID}`)).json()
  const id = lista.rdos[0].id
  const rdo = await (await api.get(`/api/app/rdos/${id}`)).json()
  expect(rdo.projeto.empresaTipo).toBe('CONTRATADA')
  await api.dispose()
})
