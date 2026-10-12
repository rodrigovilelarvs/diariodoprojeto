import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Bug real: ao tirar uma atividade de um RDO em rascunho e salvar, ela voltava ao
// recarregar a tela — o salvamento só inseria/atualizava os registros enviados e nunca
// apagava os que a pessoa havia removido. Ver PATCH em app/api/app/rdos/[id]/route.ts.

type Reg = { id?: string; avulsa: boolean; avulsaNome: string; pctAnterior: number; pctAtual: number }
const avulsa = (nome: string, extra: Partial<Reg> = {}): Reg => ({ avulsa: true, avulsaNome: nome, pctAnterior: 0, pctAtual: 10, ...extra })

test('atividade removida do RDO em rascunho não volta depois de salvar', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const criado = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2026-10-20', copiarAnterior: false } })
  expect(criado.status()).toBe(201)
  const { id } = await criado.json()

  const nomes = async () => ((await (await api.get(`/api/app/rdos/${id}`)).json()).atividadeRegistros as Array<{ avulsaNome: string }>).map(r => r.avulsaNome).sort()

  // salva duas atividades
  expect((await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: [avulsa('Escavação'), avulsa('Limpeza')] } })).status()).toBe(200)
  expect(await nomes()).toEqual(['Escavação', 'Limpeza'])

  // a pessoa remove "Limpeza" na tela e salva: a tela manda só as que sobraram (com o id já salvo)
  const atuais = (await (await api.get(`/api/app/rdos/${id}`)).json()).atividadeRegistros as Array<{ id: string; avulsaNome: string; pctAnterior: number; pctAtual: number }>
  const escavacao = atuais.find(r => r.avulsaNome === 'Escavação')!
  expect((await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: [{ ...avulsa('Escavação'), id: escavacao.id }] } })).status()).toBe(200)
  expect(await nomes()).toEqual(['Escavação'])

  // remover a última também persiste
  expect((await api.patch(`/api/app/rdos/${id}`, { data: { atividadeRegistros: [] } })).status()).toBe(200)
  expect(await nomes()).toEqual([])
  await api.dispose()
})
