import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_CONCLUIDO_ID } from '../../lib/fake-db-test'

// Cartões da Lista de RDOs (Total / Aprovados / Pendentes / Rascunhos): somam os RDOs de TODAS as
// páginas, não só os da página mostrada. Bug real: só o Total considerava tudo; os demais
// contavam apenas a página atual. Ver porStatus em app/api/app/rdos/route.ts.

test('contagem por status cobre todas as páginas e ignora o filtro de status', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const todos = (await (await api.get(`/api/app/rdos?projetoId=${PROJETO_CONCLUIDO_ID}&por=500`)).json()).rdos as Array<{ status: string }>
  expect(todos.length).toBeGreaterThan(2)
  const esperado: Record<string, number> = {}
  for (const r of todos) esperado[r.status] = (esperado[r.status] ?? 0) + 1

  // a contagem é do projeto inteiro, independente da paginação (por=1)
  const pagina = await (await api.get(`/api/app/rdos?projetoId=${PROJETO_CONCLUIDO_ID}&por=1&contagens=1`)).json()
  expect(pagina.porStatus).toEqual(esperado)

  // filtrando por um status, os cartões não zeram os outros
  const status = Object.keys(esperado)[0]
  const filtrado = await (await api.get(`/api/app/rdos?projetoId=${PROJETO_CONCLUIDO_ID}&por=1&contagens=1&status=${status}`)).json()
  expect(filtrado.porStatus).toEqual(esperado)

  // sem pedir, a resposta não carrega a contagem (a navegação entre RDOs não paga por ela)
  expect((await (await api.get(`/api/app/rdos?projetoId=${PROJETO_CONCLUIDO_ID}&por=1`)).json()).porStatus).toBeUndefined()
  await api.dispose()
})
