import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Bug real: na Lista de RDOs a coluna "Gestor do Projeto" mostrava quem emitiu
// o RDO (emissor) em vez do gestor marcado no cadastro do projeto.
// Ver app/api/app/rdos/route.ts e app/(app)/rdos/page.tsx.

test('a lista de RDOs devolve o gestor do projeto, não o emissor', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const res = await api.get(`/api/app/rdos?projetoId=${PROJETO_ID}`)
  expect(res.status()).toBe(200)
  const { rdos } = await res.json()
  await api.dispose()

  expect(rdos.length).toBeGreaterThan(0)
  for (const r of rdos) {
    expect(r.projeto.gestor).toEqual({ id: 'gestor-proj', nome: 'Gestor Do Projeto' })
    expect(r.emissor.nome).not.toBe('Gestor Do Projeto')
  }
})
