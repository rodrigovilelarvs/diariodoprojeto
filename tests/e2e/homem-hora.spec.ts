import { test, expect, type APIRequestContext } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID, RDO_ANTERIOR_ID, LEITOR_EMAIL } from '../../lib/fake-db-test'
import { custoDaLinha, horasNoturnas, normalizarTipoHora, pessoasDistintas } from '../../lib/homem-hora'
import { infoDoDia } from '../../lib/feriados'
import { calcMoHH } from '../../lib/rdo-display'
import { agruparPorSemana, atalhosDePeriodo, semanaDoDia } from '../../lib/horas-relatorio'

// Modalidade "por homem-hora" (H/H): o projeto é medido por horas trabalhadas, e não por % das atividades.
// Cada linha de mão de obra tem hora normal ou extra (com o % de acréscimo: domingo/feriado 100%, sábado
// 75%...), a função pode ter valor da hora, o projeto pode ter um saldo de horas contratadas (abatido pelos
// RDOs APROVADOS; sem saldo, só soma) e o relatório "Horas por dia" mostra sábados, domingos e feriados.
// Não há cadastro de feriados: um dia de semana com hora extra de 100% é tratado como feriado.
// Ver lib/homem-hora.ts, lib/feriados.ts, o resumo do projeto e app/api/app/relatorios/horas/route.ts.
//
// Estes testes trocam o projeto de teste (p1) de modalidade durante a execução e o devolvem ao fim.

// ── regras puras ─────────────────────────────────────────────────────────────
test.describe('regras de hora normal/extra e custo (funções puras)', () => {
  test('semanas de segunda a domingo, subtotal por semana e atalhos de período', () => {
    expect(semanaDoDia('2027-11-07')).toEqual({ inicio: '2027-11-01', fim: '2027-11-07' })   // domingo fecha a semana
    expect(semanaDoDia('2027-11-08')).toEqual({ inicio: '2027-11-08', fim: '2027-11-14' })   // segunda abre outra
    const dia = (data: string, normais: number, extras: number, valor: number | null) => ({ data, normais, extras, noturnas: 0, total: normais + extras, valor })
    const semanas = agruparPorSemana([dia('2027-11-05', 8, 0, 100), dia('2027-11-07', 0, 4, null), dia('2027-11-09', 8, 2, 50.5)])
    expect(semanas).toHaveLength(2)
    expect(semanas[0]).toMatchObject({ inicio: '2027-11-01', fim: '2027-11-07', normais: 8, extras: 4, total: 12, valor: 100 })
    expect(semanas[1]).toMatchObject({ inicio: '2027-11-08', total: 10, valor: 50.5 })
    const a = Object.fromEntries(atalhosDePeriodo('2027-03-15').map(x => [x.id, x]))
    expect(a['este-mes']).toMatchObject({ inicio: '2027-03-01', fim: '2027-03-15' })
    expect(a['mes-passado']).toMatchObject({ inicio: '2027-02-01', fim: '2027-02-28' })
    expect(a['7-dias']).toMatchObject({ inicio: '2027-03-09', fim: '2027-03-15' })
    expect(a['30-dias']).toMatchObject({ inicio: '2027-02-14', fim: '2027-03-15' })
  })

  test('hora extra sem percentual válido vira 50%; normal não tem percentual', () => {
    expect(normalizarTipoHora('NORMAL', 100)).toEqual({ tipoHora: 'NORMAL', percentualExtra: null })
    expect(normalizarTipoHora(undefined, 50)).toEqual({ tipoHora: 'NORMAL', percentualExtra: null })
    expect(normalizarTipoHora('EXTRA', 100)).toEqual({ tipoHora: 'EXTRA', percentualExtra: 100 })
    expect(normalizarTipoHora('EXTRA', null)).toEqual({ tipoHora: 'EXTRA', percentualExtra: 50 })
    expect(normalizarTipoHora('EXTRA', 0)).toEqual({ tipoHora: 'EXTRA', percentualExtra: 50 })
    expect(normalizarTipoHora('EXTRA', 900)).toEqual({ tipoHora: 'EXTRA', percentualExtra: 50 })
  })

  test('intervalo só é descontado da linha que atravessa o meio-dia (sexta dividida às 16h)', () => {
    expect(calcMoHH('07:00', '17:00', 1, 1, true)).toBe(9)   // dia inteiro, como sempre
    expect(calcMoHH('07:00', '16:00', 1, 1, true)).toBe(8)   // parte normal da sexta
    expect(calcMoHH('16:00', '17:00', 1, 2, true)).toBe(2)   // parte extra: 1h × 2 pessoas, sem intervalo
    expect(calcMoHH('16:00', '17:00', 1, 1)).toBe(0)  // regra antiga (avanço) não muda: sempre desconta
  })

  test('adicional noturno: horas entre 22h e 05h pela entrada e saída (vira o dia, por pessoa)', () => {
    expect(horasNoturnas('07:00', '17:00')).toBe(0)
    expect(horasNoturnas('17:00', '22:00')).toBe(0)
    expect(horasNoturnas('17:00', '23:30')).toBe(1.5)
    expect(horasNoturnas('22:00', '05:00')).toBe(7)
    expect(horasNoturnas('20:00', '06:00')).toBe(7)        // 22h–24h + 00h–05h
    expect(horasNoturnas('20:00', '06:00', 3)).toBe(21)    // × pessoas
    expect(horasNoturnas('00:00', '04:00')).toBe(4)
    expect(horasNoturnas('04:00', '07:00')).toBe(1)
    expect(horasNoturnas('19:00', '19:00')).toBe(0)
  })

  test('pessoas distintas: quem tem hora normal e extra no mesmo dia conta uma vez', () => {
    expect(pessoasDistintas([{ funcaoNome: 'A - SOLDADOR', quantidade: 1 }, { funcaoNome: 'A - SOLDADOR', quantidade: 1 }])).toBe(1)
    expect(pessoasDistintas([{ funcaoNome: 'A - SOLDADOR', quantidade: 1 }, { funcaoNome: 'B - AJUDANTE', quantidade: 1 }])).toBe(2)
    expect(pessoasDistintas([{ funcaoNome: 'SOLDADOR', quantidade: 3 }, { funcaoNome: 'SOLDADOR', quantidade: 2 }])).toBe(3)
    expect(pessoasDistintas([])).toBe(0)
  })

  test('custo = horas × valor da hora × (1 + acréscimo da extra); sem valor da hora, não há custo', () => {
    expect(custoDaLinha(8, 50, 'NORMAL', null)).toBe(400)
    expect(custoDaLinha(8, 50, 'EXTRA', 100)).toBe(800)
    expect(custoDaLinha(4, 50, 'EXTRA', 50)).toBe(300)
    expect(custoDaLinha(8, null, 'NORMAL', null)).toBeNull()
    // adicional noturno de 20% só sobre as horas noturnas; na hora extra, sobre o valor já com o acréscimo
    expect(custoDaLinha(8, 50, 'NORMAL', null, 4)).toBe(440)      // 400 + 4h × 50 × 20%
    expect(custoDaLinha(8, 50, 'EXTRA', 100, 4)).toBe(880)        // 800 + 4h × 50 × 2 × 20%
  })

  test('calendário: o sistema só distingue sábado e domingo (tipo da hora e % da extra são de quem preenche)', () => {
    expect(infoDoDia('2027-10-17').tipo).toBe('DOMINGO')
    expect(infoDoDia('2027-10-16').tipo).toBe('SABADO')
    expect(infoDoDia('2027-10-19').tipo).toBe('UTIL')
  })
})

// ── utilitários dos testes de API ────────────────────────────────────────────
type Linha = { funcaoNome: string; funcaoCadastroId?: string; quantidade: number; horaEntrada: string; horaSaida: string; totalHH: number; tipoHora?: string; percentualExtra?: number | null }
const linha = (totalHH: number, extra: Partial<Linha> = {}): Linha => ({ funcaoNome: 'Soldador HH', quantidade: 1, horaEntrada: '07:00', horaSaida: '17:00', totalHH, ...extra })

async function configurarProjeto(admin: APIRequestContext, dados: object) {
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}`, { data: dados })).status()).toBe(200)
}
async function configurarAssinaturas(admin: APIRequestContext, dados: object) {
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, { data: dados })).status()).toBe(200)
}
async function criarRdo(admin: APIRequestContext, data: string, linhas: Linha[]) {
  const criado = await admin.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data, copiarAnterior: false } })
  expect(criado.status()).toBe(201)
  const { id } = await criado.json()
  expect((await admin.patch(`/api/app/rdos/${id}`, { data: { maoDeObra: linhas } })).status()).toBe(200)
  return id as string
}
async function aprovar(admin: APIRequestContext, id: string) {
  expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
  const r = await admin.post(`/api/app/rdos/${id}/aprovar`, { data: { aprovado: true } })
  expect(r.status()).toBe(200)
  expect((await r.json()).todosAssinaram).toBe(true)
}
const resumoHH = async (api: APIRequestContext) => (await (await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()).hh as Record<string, number | null>

async function voltarParaAvanco(admin: APIRequestContext) {
  await admin.patch(`/api/app/projetos/${PROJETO_ID}`, { data: { modalidade: 'AVANCO', hhContratado: null } })
  await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, { data: { assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null } })
}

// ── fluxo completo pela API ──────────────────────────────────────────────────
test('horas normais/extras, valor da hora, saldo do contrato e relatório por dia (só aprovados)', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const leitor = await apiComo(playwright, LEITOR_EMAIL)
  try {
    await configurarAssinaturas(admin, { assinaturaModo: 'DEFINIDA', assinante1Id: 'admin1', assinante2Id: null, assinante3Id: null })
    await configurarProjeto(admin, { modalidade: 'HOMEM_HORA', hhContratado: 100 })

    // valor da hora da função: quem gerencia projetos define e vê; quem não, nem recebe o campo
    const nova = await admin.post('/api/app/funcoes', { data: { nome: 'Soldador HH', categoria: 'DIRETA', valorHora: 50 } })
    expect([200, 201]).toContain(nova.status())
    const funcaoId = (await nova.json()).id as string
    const doAdmin = (await (await admin.get('/api/app/funcoes')).json()).find((f: { nome: string }) => f.nome === 'Soldador HH')
    expect(doAdmin.valorHora).toBe(50)
    const doLeitor = (await (await leitor.get('/api/app/funcoes')).json()).find((f: { nome: string }) => f.nome === 'Soldador HH')
    expect(doLeitor).toBeTruthy()
    expect(doLeitor.valorHora).toBeUndefined()

    const antes = await resumoHH(admin)
    expect(antes.contratado).toBe(100)

    // RDO de DOMINGO: 16h normais + 8h extras 100% + 4h extras sem % informado (vira 50%)
    const domingo = await criarRdo(admin, '2027-10-17', [
      linha(16, { funcaoCadastroId: funcaoId, tipoHora: 'NORMAL' }),
      linha(8, { funcaoCadastroId: funcaoId, tipoHora: 'EXTRA', percentualExtra: 100 }),
      linha(4, { funcaoCadastroId: funcaoId, tipoHora: 'EXTRA', percentualExtra: null }),
    ])
    const lido = await (await admin.get(`/api/app/rdos/${domingo}`)).json()
    expect(lido.projeto.modalidade).toBe('HOMEM_HORA')
    expect(lido.maoDeObra.map((m: { tipoHora: string; percentualExtra: number | null }) => [m.tipoHora, m.percentualExtra]))
      .toEqual([['NORMAL', null], ['EXTRA', 100], ['EXTRA', 50]])
    // o RDO não traz o valor da hora da função (informação financeira)
    expect(JSON.stringify(lido.maoDeObra)).not.toContain('valorHora"')

    // RDO de TERÇA com 10h de hora extra 100% (feriado) e 8h normais
    const feriado = await criarRdo(admin, '2027-10-19', [
      linha(8, { funcaoCadastroId: funcaoId, tipoHora: 'NORMAL' }),
      linha(10, { funcaoCadastroId: funcaoId, tipoHora: 'EXTRA', percentualExtra: 100 }),
    ])

    // enquanto não aprovados, não entram na medição (relatório padrão) nem abatem o saldo
    const dia = (r: { dias: Array<{ data: string }> }, d: string) => r.dias.find(x => x.data === d)
    const periodo = 'dataInicio=2027-10-01&dataFim=2027-10-31'
    const pendente = await (await admin.get(`/api/app/relatorios/horas?projetoId=${PROJETO_ID}&${periodo}`)).json()
    expect(dia(pendente, '2027-10-17')).toBeUndefined()
    expect(dia(pendente, '2027-10-19')).toBeUndefined()
    const todos = await (await admin.get(`/api/app/relatorios/horas?projetoId=${PROJETO_ID}&${periodo}&status=TODOS`)).json()
    expect(dia(todos, '2027-10-17')).toBeTruthy()
    expect((await resumoHH(admin)).aprovadas).toBe(antes.aprovadas)

    await aprovar(admin, domingo)
    await aprovar(admin, feriado)

    // saldo: abate as horas aprovadas (28 + 18 = 46); sem contrato cadastrado só somaria
    const depois = await resumoHH(admin)
    expect(depois.contratado).toBe(100)
    expect(Number(depois.aprovadas) - Number(antes.aprovadas)).toBe(46)
    expect(Number(depois.extras) - Number(antes.extras)).toBe(22)
    expect(Number(depois.normais) - Number(antes.normais)).toBe(24)
    expect(depois.saldo).toBe(100 - Number(depois.aprovadas))
    // custo: 16×50 + 8×50×2 + 4×50×1,5 + 8×50 + 10×50×2 = 3.300 (a 50/h)
    expect(Number(depois.valor ?? 0) - Number(antes.valor ?? 0)).toBe(3300)
    // quem não gerencia projetos nem vê relatórios não recebe valores
    expect((await resumoHH(leitor)).valor).toBeNull()
    expect((await leitor.get(`/api/app/relatorios/horas?projetoId=${PROJETO_ID}&${periodo}`)).status()).toBe(403)

    // relatório por dia
    const rel = await (await admin.get(`/api/app/relatorios/horas?projetoId=${PROJETO_ID}&${periodo}`)).json()
    const d17 = dia(rel, '2027-10-17') as unknown as { tipoDia: string; normais: number; extras: number; total: number; valor: number; linhas: unknown[] }
    expect(d17).toMatchObject({ tipoDia: 'DOMINGO', normais: 16, extras: 12, total: 28, valor: 1900 })
    expect(d17.linhas).toHaveLength(3)
    const d19 = dia(rel, '2027-10-19') as unknown as { tipoDia: string; normais: number; extras: number; total: number; valor: number }
    expect(d19).toMatchObject({ tipoDia: 'FERIADO', normais: 8, extras: 10, total: 18, valor: 1400 })
    expect(rel.totais.domingos).toBeGreaterThanOrEqual(28)
    expect(rel.totais.feriados).toBeGreaterThanOrEqual(18)

    // a lista de projetos mostra as horas aprovadas no lugar do avanço
    const lista = (await (await admin.get('/api/app/projetos')).json()) as Array<{ id: string; modalidade: string; hhContratado: number; hhConsumido: number }>
    const p1 = lista.find(p => p.id === PROJETO_ID)!
    expect(p1).toMatchObject({ modalidade: 'HOMEM_HORA', hhContratado: 100 })
    expect(p1.hhConsumido).toBe(Number(depois.aprovadas))
  } finally {
    await voltarParaAvanco(admin)
  }
  await leitor.dispose(); await admin.dispose()
})

test('projeto sem horas contratadas: só soma, sem saldo', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  try {
    await configurarProjeto(admin, { modalidade: 'HOMEM_HORA', hhContratado: null })
    const hh = await resumoHH(admin)
    expect(hh.contratado).toBeNull()
    expect(hh.saldo).toBeNull()
    expect(typeof hh.aprovadas).toBe('number')
  } finally {
    await voltarParaAvanco(admin)
  }
  await admin.dispose()
})

test('projeto por avanço não traz o bloco de homem-hora e valida a modalidade', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const r = await (await admin.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()
  expect(r.hh).toBeUndefined()
  expect(r.projeto.modalidade).toBe('AVANCO')
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}`, { data: { modalidade: 'OUTRA' } })).status()).toBe(400)
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}`, { data: { hhContratado: -5 } })).status()).toBe(400)
  await admin.dispose()
})

// ── telas ────────────────────────────────────────────────────────────────────
test('RDO de projeto por homem-hora: tipo de hora por linha, sem % de atividades, aviso de fim de semana', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  try {
    await configurarProjeto(admin, { modalidade: 'HOMEM_HORA' })
    const domingo = await criarRdo(admin, '2027-10-24', [linha(9, { tipoHora: 'EXTRA', percentualExtra: 100 })]) // domingo

    await login(page)
    await page.goto(`/rdos/${domingo}`)
    const tipo = page.getByLabel('Tipo de hora').first()
    await expect(tipo).toBeVisible()
    await expect(tipo).toHaveValue('100')
    await expect(page.getByRole('button', { name: 'Adicionar atividade' })).toHaveCount(0)
    await expect(page.getByText('Atividades executadas (observações)')).toBeVisible()
    await expect(page.getByTestId('aviso-dia-hh')).toContainText('domingo')

    // trocar para hora normal / outro percentual
    await tipo.selectOption('NORMAL')
    await expect(tipo).toHaveValue('NORMAL')
    await tipo.selectOption('75')
    await expect(tipo).toHaveValue('75')
    await expect(page.getByLabel('Percentual da hora extra')).toHaveCount(0)
    await tipo.selectOption('OUTRO')
    const livre = page.getByLabel('Percentual da hora extra')
    await expect(livre).toBeVisible()
    // qualquer valor, inclusive os que coincidem com as opções prontas: o campo não some ao digitar
    await livre.fill('75')
    await expect(livre).toBeVisible()
    await livre.fill('120')
    await expect(livre).toHaveValue('120')
    await expect(tipo).toHaveValue('OUTRO')
  } finally {
    await voltarParaAvanco(admin)
    await admin.dispose()
  }
})

test('adicional noturno: aparece no RDO, no relatório por dia e na pasta do projeto', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  try {
    await configurarProjeto(admin, { modalidade: 'HOMEM_HORA' })
    // terça-feira, turno da noite: 20:00 às 06:00 = 7 h entre 22h e 05h
    const noite = await criarRdo(admin, '2027-11-09', [linha(10, { horaEntrada: '20:00', horaSaida: '06:00', tipoHora: 'EXTRA', percentualExtra: 75 })])

    const rel = await (await admin.get('/api/app/relatorios/horas?projetoId=' + PROJETO_ID + '&dataInicio=2027-11-09&dataFim=2027-11-09&status=TODOS')).json()
    expect(rel.totais.noturnas).toBe(7)
    expect(rel.dias[0].noturnas).toBe(7)
    expect(rel.dias[0].linhas[0].noturnas).toBe(7)

    await login(page)
    await page.goto(`/rdos/${noite}`)
    await expect(page.getByTestId('selo-noturno')).toContainText('7')
    await expect(page.getByTestId('pill-noturno')).toContainText('7')

    // RDO sem hora na faixa da noite não mostra o selo
    // a mesma pessoa com linha normal e linha extra no dia conta como 1 pessoa no relatório
    const dia = await criarRdo(admin, '2027-11-10', [linha(8), linha(1, { horaEntrada: '17:00', horaSaida: '18:00', tipoHora: 'EXTRA', percentualExtra: 75 })])
    const relDia = await (await admin.get('/api/app/relatorios/horas?projetoId=' + PROJETO_ID + '&dataInicio=2027-11-10&dataFim=2027-11-10&status=TODOS')).json()
    expect(relDia.dias[0].pessoas).toBe(1)
    expect(relDia.dias[0].normais).toBe(8)
    expect(relDia.dias[0].extras).toBe(1)
    await page.goto(`/rdos/${dia}`)
    await expect(page.getByLabel('Tipo de hora').first()).toBeVisible()
    await expect(page.getByTestId('selo-noturno')).toHaveCount(0)
  } finally {
    await voltarParaAvanco(admin)
    await admin.dispose()
  }
})

test('RDO de projeto por avanço continua com atividades e sem tipo de hora', async ({ page }) => {
  await login(page)
  await page.goto(`/rdos/${RDO_ANTERIOR_ID}`)
  await expect(page.getByRole('button', { name: 'Adicionar atividade' })).toBeVisible()
  await expect(page.getByLabel('Tipo de hora')).toHaveCount(0)
})

test('editar projeto: escolher a modalidade por homem-hora mostra as horas contratadas', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  const editar = page.getByRole('button', { name: 'Editar' })
  await expect(async () => {
    await editar.click()
    await expect(page.getByText('Modalidade de medição')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  await expect(page.getByText('Horas contratadas (H/H)')).toHaveCount(0)
  await page.locator('.modal select').filter({ has: page.locator('option', { hasText: 'Por homem-hora' }) }).selectOption('HOMEM_HORA')
  await expect(page.getByText('Horas contratadas (H/H)')).toBeVisible()
})

test('Relatórios: aba "Horas por dia" destaca domingo e feriado; painel e pasta mostram as horas', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  try {
    await configurarAssinaturas(admin, { assinaturaModo: 'DEFINIDA', assinante1Id: 'admin1', assinante2Id: null, assinante3Id: null })
    await configurarProjeto(admin, { modalidade: 'HOMEM_HORA', hhContratado: 500 })
    const domingo = await criarRdo(admin, '2027-11-07', [linha(8, { tipoHora: 'EXTRA', percentualExtra: 100 })])   // domingo
    const feriado = await criarRdo(admin, '2027-11-09', [linha(6, { tipoHora: 'EXTRA', percentualExtra: 100 })])   // terça (feriado marcado)
    const domingoNormal = await criarRdo(admin, '2027-11-14', [linha(8, { tipoHora: 'NORMAL' })])                     // domingo com hora normal
    await aprovar(admin, domingo)
    await aprovar(admin, feriado)
    await aprovar(admin, domingoNormal)

    await login(page)
    await page.goto('/relatorios')
    const aba = page.getByRole('button', { name: /Horas por dia/ })
    await expect(async () => {
      await aba.click()
      await expect(page.getByTestId('relatorio-horas')).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 20_000 })
    await page.getByLabel('Data inicial').fill('2027-11-01')
    await page.getByLabel('Data final').fill('2027-11-30')

    const tabela = page.getByTestId('tabela-horas')
    const linhaDomingo = tabela.locator('tr[data-tipo-dia="DOMINGO"]', { hasText: '07/11/2027' })
    const linhaFeriado = tabela.locator('tr[data-tipo-dia="FERIADO"]', { hasText: '09/11/2027' })
    await expect(linhaDomingo).toContainText('Domingo')
    await expect(linhaFeriado).toContainText('Feriado')
    // domingo com horas normais: alerta para conferir (talvez fossem extras); domingo só com extra: sem alerta
    await expect(tabela.locator('tr[data-tipo-dia="DOMINGO"]', { hasText: '14/11/2027' }).getByTestId('alerta-normal-fim-semana')).toBeVisible()
    await expect(linhaDomingo.getByTestId('alerta-normal-fim-semana')).toHaveCount(0)
    // o período filtra: os RDOs de outubro (de outros testes) não aparecem em novembro
    await expect(tabela).not.toContainText('17/10/2027')
    // clicar na data mostra as funções do dia
    await linhaDomingo.click()
    await expect(tabela).toContainText('Soldador HH')
    await expect(tabela).toContainText('Extra 100%')
    // expandir/recolher tudo
    await page.getByTestId('alternar-todos').click()
    await expect(page.getByTestId('alternar-todos')).toContainText('Recolher tudo')
    await page.getByTestId('alternar-todos').click()
    await expect(page.getByTestId('alternar-todos')).toContainText('Expandir tudo')

    // subtotal por semana (segunda a domingo): 01–07/11 e 08–14/11
    await expect(tabela.getByTestId('subtotal-semana')).toHaveCount(2)
    await expect(tabela.getByTestId('subtotal-semana').first()).toContainText('Semana 01/11 a 07/11')
    // a coluna Qtd. some quando toda linha é de 1 pessoa
    await linhaDomingo.click()
    await expect(tabela.getByText('Qtd.')).toHaveCount(0)
    // atalho de período preenche as datas
    await page.getByTestId('atalhos-periodo').getByRole('button', { name: 'Este mês' }).click()
    await expect(page.getByLabel('Data inicial')).toHaveValue(/-01$/)
    await page.getByLabel('Data inicial').fill('2027-11-01')
    await page.getByLabel('Data final').fill('2027-11-30')
    await expect(tabela).toContainText('07/11/2027')
    // visão por pessoa
    await page.getByTestId('visao-pessoa').click()
    await expect(page.getByTestId('tabela-pessoas')).toContainText('Soldador')
    await page.getByTestId('visao-dia').click()
    // exportar PDF
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('exportar-pdf-horas').click(),
    ])
    expect(download.suggestedFilename()).toBe('Horas-por-dia_2027-11-01_2027-11-30.pdf')
    // celular: a tabela vira cartões, com o subtotal da semana
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(page.getByTestId('cartoes-horas')).toBeVisible()
    await expect(page.getByTestId('tabela-horas')).toHaveCount(0)
    await expect(page.getByTestId('cartoes-horas').getByTestId('subtotal-semana').first()).toContainText('Semana')
    await page.setViewportSize({ width: 1280, height: 800 })

    // painel: horas aprovadas em vez do % de avanço; pasta: bloco Homem-hora com o saldo
    await page.goto('/painel')
    await expect(page.getByText(/de 500 H\/H/).first()).toBeVisible()
    await page.goto(`/projetos/${PROJETO_ID}`)
    await expect(page.getByTestId('painel-hh')).toContainText('Saldo')
    await expect(page.getByTestId('painel-hh')).toContainText('Contratadas')
  } finally {
    await voltarParaAvanco(admin)
    await admin.dispose()
  }
})
