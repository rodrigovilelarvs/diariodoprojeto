import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Bug real: "Copiar dados do RDO anterior" (checkbox em /rdos/novo) não copiava
// nada quando o último RDO do projeto estava em RASCUNHO ou REJEITADO — a busca
// do "anterior" só considerava status APROVADO/PENDENTE_APROVACAO. RASCUNHO é
// justamente o caso mais comum (o RDO de ontem, ainda não enviado pra
// aprovação), então a cópia falhava silenciosamente na maioria das vezes.
// Ver app/api/app/rdos/route.ts.
//
// O banco falso (lib/fake-db-test.ts) tem um RDO fixo em RASCUNHO no projeto
// p1 (RDO_ANTERIOR_ID, número bem alto pra continuar sendo "o mais recente"
// mesmo com outros RDOs criados durante a suíte), com horários, 1 mão de obra,
// 1 equipamento e 1 atividade avulsa preenchidos.

test('copiarAnterior=true copia horários, mão de obra, equipamento e atividade do RDO em RASCUNHO', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const res = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2026-09-10', copiarAnterior: true } })
  expect(res.status()).toBe(201)
  const rdo = await res.json()
  await api.dispose()

  expect([rdo.horaInicio, rdo.horaTermino, rdo.intervaloHoras, rdo.totalHoras]).toEqual(['07:00', '17:00', 1, 9])

  expect(rdo.maoDeObra).toHaveLength(1)
  expect(rdo.maoDeObra[0]).toMatchObject({ funcaoNome: 'Pedreiro', quantidade: 3, totalHH: 27 })

  expect(rdo.equipamentos).toHaveLength(1)
  expect(rdo.equipamentos[0]).toMatchObject({ equipamentoNome: 'Betoneira', quantidade: 1 })

  // % anterior do novo RDO começa igual ao % atual do RDO copiado (delta = 0
  // até o usuário registrar o avanço de hoje) — não repete o pctAnterior antigo
  expect(rdo.atividadeRegistros).toHaveLength(1)
  expect(rdo.atividadeRegistros[0]).toMatchObject({
    avulsa: true, avulsaNome: 'Serviço avulso', pctAnterior: 40, pctAtual: 40, deltaHoje: 0,
  })
})

test('copiarAnterior=false não copia nada, mesmo havendo um RDO anterior', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const res = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2026-09-11', copiarAnterior: false } })
  expect(res.status()).toBe(201)
  const rdo = await res.json()
  await api.dispose()

  expect([rdo.horaInicio, rdo.horaTermino, rdo.intervaloHoras, rdo.totalHoras]).toEqual([null, null, null, null])
  expect(rdo.maoDeObra).toHaveLength(0)
  expect(rdo.equipamentos).toHaveLength(0)
  expect(rdo.atividadeRegistros).toHaveLength(0)
})
