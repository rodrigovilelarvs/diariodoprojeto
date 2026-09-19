import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import {
  ADMIN_EMAIL, ADMIN_SENHA, LEITOR_EMAIL, EMISSOR_EMAIL,
  PROJETO_CONCLUIDO_ID, PROJETO_GRANDE_ID,
} from '../../lib/fake-db-test'

// Autorização no servidor: perfil PERSONALIZADO só pode o que o administrador
// marcou, e nenhum perfil mexe em RDO aprovado. Testado direto na API (é lá que
// a regra vale — esconder botão na tela não protege nada).
//
// Dados do banco falso (lib/fake-db-test.ts):
//   admin   → tudo
//   leitor  → PERSONALIZADO sem nenhuma permissão
//   emissor → PERSONALIZADO só com "emitir RDO"
//   p2 (concluído): rc1 APROVADO com a mídia m1, rc3 RASCUNHO
//   p3 (acesso restrito): só o admin está liberado; rg1 é um RDO dele

type Playwright = PlaywrightWorkerArgs['playwright']

// O app real manda o token de duas formas: cookie app_token (o middleware exige
// pra deixar passar) e header Authorization: Bearer (o requireAuth lê). O token
// vem no corpo da resposta do login.
async function logarComo(playwright: Playwright, baseURL: string, email: string): Promise<APIRequestContext> {
  const login = await playwright.request.newContext({ baseURL })
  const res = await login.post('/api/auth/login', { data: { email, senha: ADMIN_SENHA } })
  expect(res.ok(), `login de ${email}`).toBeTruthy()
  const { token } = await res.json()
  await login.dispose()
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } })
}

const baseURL = 'http://localhost:3100'
const midiaNova = (rdoId: string) => ({ rdoId, tipo: 'FOTO', nomeArq: 'x.png', url: 'https://storage-fake.teste/rdos/x.png' })

test.describe('usuário Personalizado sem nenhuma permissão', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, LEITOR_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('não emite, não aprova, não vê relatórios, não convida usuários nem cria projetos', async () => {
    expect((await api.post('/api/app/rdos', { data: { projetoId: PROJETO_CONCLUIDO_ID, data: '2026-09-01' } })).status()).toBe(403)
    expect((await api.post('/api/app/rdos/rc3/aprovar', { data: { aprovado: true } })).status()).toBe(403)
    expect((await api.patch('/api/app/rdos/rc3', { data: { observacoes: 'x' } })).status()).toBe(403)
    expect((await api.get('/api/app/relatorios')).status()).toBe(403)
    expect((await api.post('/api/app/usuarios', { data: { email: 'novo@teste.com', perfil: 'ADMIN' } })).status()).toBe(403)
    expect((await api.post('/api/app/projetos', { data: { nome: 'Novo' } })).status()).toBe(403)
  })

  test('não mexe em mídia de RDO (adicionar, legendar, apagar)', async () => {
    expect((await api.post('/api/app/midias', { data: midiaNova('rc3') })).status()).toBe(403)
    expect((await api.patch('/api/app/midias?id=m1', { data: { descricao: 'x' } })).status()).toBe(403)
    expect((await api.delete('/api/app/midias?id=m1')).status()).toBe(403)
  })
})

test.describe('usuário Personalizado que só emite RDO', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, EMISSOR_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('continua sem poder aprovar, ver relatórios ou convidar usuários', async () => {
    expect((await api.post('/api/app/rdos/rc3/aprovar', { data: { aprovado: true } })).status()).toBe(403)
    expect((await api.get('/api/app/relatorios')).status()).toBe(403)
    expect((await api.post('/api/app/usuarios', { data: { email: 'novo@teste.com', perfil: 'ADMIN' } })).status()).toBe(403)
  })

  test('adiciona mídia em RDO em rascunho', async () => {
    expect((await api.post('/api/app/midias', { data: midiaNova('rc3') })).status()).toBe(201)
  })

  test('RDO aprovado é intocável: nem adicionar, nem legendar, nem apagar mídia', async () => {
    const add = await api.post('/api/app/midias', { data: midiaNova('rc1') })
    expect(add.status()).toBe(400)
    expect((await add.json()).erro).toMatch(/aprovado não pode ser editado/i)
    expect((await api.patch('/api/app/midias?id=m1', { data: { descricao: 'x' } })).status()).toBe(400)
    expect((await api.delete('/api/app/midias?id=m1')).status()).toBe(400)
  })

  test('projeto de acesso restrito, onde não foi liberado: não edita nem comenta', async () => {
    // tem permissão de emitir, mas o projeto p3 só libera o admin
    expect((await api.post('/api/app/midias', { data: midiaNova('rg1') })).status()).toBe(403)
    expect((await api.post('/api/app/rdos/rg1/comentarios', { data: { texto: 'oi' } })).status()).toBe(404)
  })
})

test.describe('administrador', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, ADMIN_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('acessa os relatórios', async () => {
    expect((await api.get('/api/app/relatorios')).status()).toBe(200)
  })

  test('adiciona mídia em rascunho, mas nem o administrador altera RDO aprovado', async () => {
    expect((await api.post('/api/app/midias', { data: midiaNova('rc3') })).status()).toBe(201)
    expect((await api.post('/api/app/midias', { data: midiaNova('rc1') })).status()).toBe(400)
    expect((await api.delete('/api/app/midias?id=m1')).status()).toBe(400)
  })
})
