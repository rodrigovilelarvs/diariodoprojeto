import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID, PROJETO_NOME, EMISSOR_EMAIL } from '../../lib/fake-db-test'

// Projetos escolhidos já no convite: quem convida marca "somente os projetos que eu escolher"
// (cada um com o seu nível) e a pessoa já entra só com eles — nunca vê os projetos abertos ao
// time. O acesso dela não fecha o projeto para os demais. Ver lib/acesso-convite.ts,
// lib/auth.ts (resolverAcessoProjeto / projetosSemAcesso) e o POST em app/api/app/usuarios/route.ts.

const BASE = 'http://localhost:3100'
const SENHA = 'senha-segura-1'
let contador = 0
const emailNovo = () => `convidado${Date.now()}${contador++}@teste.com`

type Api = PlaywrightWorkerArgs['playwright']

// Convida e já aceita o convite; devolve o cliente de API da pessoa recém-chegada.
// (No banco falso o token do convite é o id sem o prefixo "conv-".)
async function convidarEAceitar(playwright: Api, admin: APIRequestContext, dados: Record<string, unknown>) {
  const email = emailNovo()
  const res = await admin.post('/api/app/usuarios', { data: { email, perfil: 'PERSONALIZADO', permEmitirRdo: true, ...dados } })
  expect(res.status()).toBe(201)
  const { convite } = await res.json()

  const anonimo = await playwright.request.newContext({ baseURL: BASE })
  const aceite = await anonimo.post('/api/auth/convite', { data: { token: String(convite.id).replace(/^conv-/, ''), nome: 'Pessoa Convidada', senha: SENHA } })
  expect(aceite.status()).toBe(200)
  const { token } = await aceite.json()
  await anonimo.dispose()
  const api = await playwright.request.newContext({ baseURL: BASE, extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } })
  return { api, convite }
}

const nomesDosProjetos = async (api: APIRequestContext) =>
  ((await (await api.get('/api/app/projetos')).json()) as Array<{ nome: string }>).map(p => p.nome)

test('convite só com projetos escolhidos: sem nenhum marcado, a pessoa não vê nem os projetos abertos ao time', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const { api } = await convidarEAceitar(playwright, admin, { restringirProjetos: true, projetosAcesso: [] })

  expect(await nomesDosProjetos(api)).toEqual([])
  expect((await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).status()).toBe(404)
  await api.dispose(); await admin.dispose()
})

test('convite com um projeto liberado: a pessoa vê só ele e o projeto segue aberto ao resto do time', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const { api } = await convidarEAceitar(playwright, admin, {
    restringirProjetos: true, projetosAcesso: [{ projetoId: PROJETO_ID, nivel: 'VISUALIZAR' }],
  })
  expect(await nomesDosProjetos(api)).toEqual([PROJETO_NOME])
  expect((await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).status()).toBe(200)

  // o nível escolhido vale: só visualizar, não cria RDO no projeto
  const criar = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-05-01', copiarAnterior: false } })
  expect(criar.status()).toBe(403)

  // quem não é restrito continua vendo o projeto (a lista dele não "fechou" o projeto)
  const emissor = await apiComo(playwright, EMISSOR_EMAIL)
  expect(await nomesDosProjetos(emissor)).toContain(PROJETO_NOME)
  expect((await emissor.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).status()).toBe(200)
  await emissor.dispose(); await api.dispose(); await admin.dispose()
})

test('convite sem escolher projetos mantém o padrão: vê os projetos abertos ao time', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const { api } = await convidarEAceitar(playwright, admin, {})
  expect(await nomesDosProjetos(api)).toContain(PROJETO_NOME)
  await api.dispose(); await admin.dispose()
})

test('administrador ignora a restrição de projetos', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const { api, convite } = await convidarEAceitar(playwright, admin, { perfil: 'ADMIN', restringirProjetos: true, projetosAcesso: [] })
  expect(convite.restringirProjetos).toBe(false)
  expect(await nomesDosProjetos(api)).toContain(PROJETO_NOME)
  await api.dispose(); await admin.dispose()
})

test('reenviar o convite sem mandar os projetos mantém os que já estavam escolhidos', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const email = emailNovo()
  const dados = { email, perfil: 'PERSONALIZADO', permEmitirRdo: true }
  const primeiro = await admin.post('/api/app/usuarios', {
    data: { ...dados, restringirProjetos: true, projetosAcesso: [{ projetoId: PROJETO_ID, nivel: 'EDITAR' }] },
  })
  expect(primeiro.status()).toBe(201)
  const reenvio = await admin.post('/api/app/usuarios', { data: dados })
  const { convite } = await reenvio.json()
  expect(convite.restringirProjetos).toBe(true)
  expect(convite.projetosAcesso).toEqual([{ projetoId: PROJETO_ID, nivel: 'EDITAR' }])
  await admin.dispose()
})

test('cadastro direto com senha também já libera só os projetos escolhidos, e dá para mudar depois', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const email = emailNovo()
  const res = await admin.post('/api/app/usuarios', {
    data: {
      email, nome: 'Cadastrada Direto', senha: 'teste123', perfil: 'PERSONALIZADO', permEmitirRdo: true,
      restringirProjetos: true, projetosAcesso: [{ projetoId: PROJETO_ID, nivel: 'EDITAR' }],
    },
  })
  expect(res.status()).toBe(201)
  const { usuario } = await res.json()

  const api = await apiComo(playwright, email)
  expect(await nomesDosProjetos(api)).toEqual([PROJETO_NOME])

  // desmarcar "só projetos liberados" na tela de Usuários: volta a ver os abertos ao time
  expect((await admin.patch(`/api/app/usuarios/${usuario.id}`, { data: { restringirProjetos: false } })).status()).toBe(200)
  const acessos = await (await admin.get(`/api/app/usuarios/${usuario.id}/acessos`)).json()
  expect(acessos.restringirProjetos).toBe(false)
  // Cuidado com o estado compartilhado do banco falso: sem a marca, o acesso dela ao projeto passaria a
  // "fechar" o projeto p1 para os demais testes. Volta a marcar para deixar tudo como estava.
  expect((await admin.patch(`/api/app/usuarios/${usuario.id}`, { data: { restringirProjetos: true } })).status()).toBe(200)
  await api.dispose(); await admin.dispose()
})

test('na tela, escolher "somente os projetos que eu escolher" lista os projetos e envia a escolha', async ({ page }) => {
  await login(page)
  await page.goto('/usuarios')
  await page.getByRole('button', { name: /Cadastro de usuário/ }).click()
  await page.getByPlaceholder('email@empresa.com').fill(emailNovo())

  // administrador: a escolha de projetos nem aparece (ele já vê todos)
  const campo = page.getByTestId('acesso-projetos-convite')
  await expect(campo).toBeVisible()
  await page.getByRole('button', { name: 'Administrador', exact: true }).click()
  await expect(campo).toHaveCount(0)
  await page.getByRole('button', { name: 'Personalizado', exact: true }).click()

  await campo.getByRole('button', { name: 'Somente os projetos que eu escolher' }).click()
  await expect(campo.getByText('Nenhum projeto marcado')).toBeVisible()
  await campo.getByText(PROJETO_NOME).click()
  await expect(campo.getByText(/1 projeto liberado/)).toBeVisible()
  await campo.getByLabel(`Nível de acesso em ${PROJETO_NOME}`).selectOption('EDITAR')

  const envio = page.waitForRequest(r => r.url().endsWith('/api/app/usuarios') && r.method() === 'POST')
  await page.locator('button[type="submit"]', { hasText: 'Enviar convite' }).click()
  const corpo = (await envio).postDataJSON()
  expect(corpo.restringirProjetos).toBe(true)
  expect(corpo.projetosAcesso).toEqual([{ projetoId: PROJETO_ID, nivel: 'EDITAR' }])
})
