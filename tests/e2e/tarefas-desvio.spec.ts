import { test, expect, type APIRequestContext } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID, PROJETO_CONCLUIDO_ID } from '../../lib/fake-db-test'

// As datas de início/término das atividades são opcionais. Sem nenhuma data
// não existe prazo planejado, então o desvio (real − planejado) não pode virar
// o próprio progresso ("+40% adiantado" sem prazo nenhum).
//
// Dados do banco falso (lib/fake-db-test.ts):
//   p1 → duas atividades sem datas (50% e 30% → 40% real)
//   p2 → uma atividade com datas já vencidas, 40% feita → atrasada

test.describe('desvio quando as atividades não têm datas', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await apiComo(playwright) })
  test.afterAll(async () => { await api.dispose() })

  test('projeto sem nenhuma data: tem progresso real, mas desvio 0', async () => {
    const { kpis } = await (await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()
    expect(kpis.pctReal).toBe(40)
    expect(kpis.pctPlanejado).toBe(0)
    expect(kpis.desvio).toBe(0)
  })

  test('a lista de projetos também mostra desvio 0 para o projeto sem datas', async () => {
    const projetos = await (await api.get('/api/app/projetos')).json()
    const p1 = projetos.find((p: { id: string }) => p.id === PROJETO_ID)
    expect(p1.pctReal).toBe(40)
    expect(p1.desvio).toBe(0)
  })

  test('relatórios: desvio médio e ranking também tratam projeto sem datas como desvio 0', async () => {
    const r = await (await api.get('/api/app/relatorios')).json()
    expect(r.kpis.desvioMedio).toBe(0)
    const p1 = r.rankingPiorDesvio.find((p: { id: string }) => p.id === PROJETO_ID)
    expect(p1.pctReal).toBe(40)
    expect(p1.desvio).toBe(0)
  })

  test('projeto com datas continua calculando o desvio de verdade (atrasado = negativo)', async () => {
    const { kpis } = await (await api.get(`/api/app/projetos/${PROJETO_CONCLUIDO_ID}/resumo`)).json()
    expect(kpis.pctReal).toBe(40)
    expect(kpis.pctPlanejado).toBe(100) // prazo já venceu
    expect(kpis.desvio).toBe(-60)
  })
})

test('os campos de data ao criar atividade dizem que são opcionais', async ({ page }) => {
  await login(page)
  await page.goto(`/tarefas?projetoId=${PROJETO_ID}`)
  await page.getByRole('button', { name: /Nova atividade/ }).first().click()
  await expect(page.getByText('Início (opcional)')).toBeVisible()
  await expect(page.getByText('Término (opcional)')).toBeVisible()
})
