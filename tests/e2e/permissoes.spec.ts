import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import {
  ADMIN_EMAIL, ADMIN_SENHA, LEITOR_EMAIL, EMISSOR_EMAIL, GERENTE_EMAIL,
  PROJETO_CONCLUIDO_ID, PROJETO_GRANDE_ID, TENANT_ID,
} from '../../lib/fake-db-test'

// Autorização no servidor: perfil PERSONALIZADO só pode o que o administrador
// marcou, e nenhum perfil mexe em RDO aprovado. Testado direto na API (é lá que
// a regra vale — esconder botão na tela não protege nada).
//
// Dados do banco falso (lib/fake-db-test.ts):
//   admin   → tudo
//   leitor  → PERSONALIZADO sem nenhuma permissão
//   emissor → PERSONALIZADO só com "emitir RDO"
//   gerente → PERSONALIZADO só com "gerenciar equipe" (não é ADMIN)
//   p2 (concluído): rc1 APROVADO com a mídia m1, rc3 RASCUNHO
//   p3 (acesso restrito): admin e leitor (GERENCIAMENTO explícito) liberados; rg1 é um RDO dele

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
// Mesmo formato que o upload real gera: <tenantId>/<rdoId>/<arquivo> no bucket rdos-midias
const urlStorage = (pasta: string) => `https://mock.supabase.co/storage/v1/object/public/rdos-midias/${pasta}/1-x.png`
const midiaNova = (rdoId: string) => ({ rdoId, tipo: 'FOTO', nomeArq: 'x.png', url: urlStorage(`${TENANT_ID}/${rdoId}`) })

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

  test('não cria itens nos catálogos (tipos de ocorrência, equipamentos, funções)', async () => {
    expect((await api.post('/api/app/ocorrencia-tipos', { data: { nome: 'Tipo novo' } })).status()).toBe(403)
    expect((await api.post('/api/app/equipamentos', { data: { nome: 'Guindaste', tipo: 'PESADO' } })).status()).toBe(403)
    expect((await api.post('/api/app/funcoes', { data: { nome: 'Pedreiro', categoria: 'DIRETA' } })).status()).toBe(403)
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

// Administrar projeto (editar, excluir, assinaturas, acessos) exige a permissão
// global OU o nível GERENCIAMENTO liberado naquele projeto. "Projeto sem
// restrição" só significa que todos VEEM — antes, qualquer usuário, mesmo sem
// permissão nenhuma, editava e excluía projetos sem restrição.
for (const [quem, email] of [['sem nenhuma permissão', LEITOR_EMAIL], ['que só emite RDO', EMISSOR_EMAIL]] as const) {
  test.describe(`administrar projeto — usuário ${quem}`, () => {
    let api: APIRequestContext
    test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, email) })
    test.afterAll(async () => { await api.dispose() })

    test('não edita nem exclui projeto, nem mexe em assinaturas e acessos', async () => {
      const p = PROJETO_CONCLUIDO_ID
      expect((await api.patch(`/api/app/projetos/${p}`, { data: { nome: 'Hack' } })).status()).toBe(403)
      expect((await api.delete(`/api/app/projetos/${p}`)).status()).toBe(403)
      expect((await api.get(`/api/app/projetos/${p}/assinaturas`)).status()).toBe(403)
      expect((await api.patch(`/api/app/projetos/${p}/assinaturas`, { data: { assinaturaModo: 'ABERTA' } })).status()).toBe(403)
      expect((await api.get(`/api/app/projetos/${p}/acesso`)).status()).toBe(403)
      expect((await api.post(`/api/app/projetos/${p}/acesso`, { data: { usuarioId: 'leitor1', nivel: 'GERENCIAMENTO' } })).status()).toBe(403)
    })
  })
}

test.describe('administrar projeto — GERENCIAMENTO liberado só num projeto', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, LEITOR_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('o leitor, sem permissão global, administra o projeto onde recebeu GERENCIAMENTO', async () => {
    expect((await api.get(`/api/app/projetos/${PROJETO_GRANDE_ID}/assinaturas`)).status()).toBe(200)
    expect((await api.get(`/api/app/projetos/${PROJETO_GRANDE_ID}/acesso`)).status()).toBe(200)
  })
})

// "Gerenciar equipe" não pode virar atalho pra virar ADMIN: quem não é
// administrador só delega o que ele mesmo tem.
test.describe('usuário que só gerencia a equipe (não é administrador)', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, GERENTE_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('não concede o perfil de administrador (a outro usuário, a si mesmo ou em convite)', async () => {
    const r = await api.patch('/api/app/usuarios/emissor1', { data: { perfil: 'ADMIN' } })
    expect(r.status()).toBe(403)
    expect((await r.json()).erro).toMatch(/somente um administrador/i)
    expect((await api.patch('/api/app/usuarios/gerente1', { data: { perfil: 'ADMIN' } })).status()).toBe(403)
    expect((await api.post('/api/app/usuarios', { data: { email: 'novo@teste.com', perfil: 'ADMIN' } })).status()).toBe(403)
  })

  test('não altera nem desativa um administrador', async () => {
    expect((await api.patch('/api/app/usuarios/admin1', { data: { status: 'INATIVO' } })).status()).toBe(403)
    expect((await api.patch('/api/app/usuarios/admin1', { data: { perfil: 'PERSONALIZADO' } })).status()).toBe(403)
  })

  test('não liga permissão que ele mesmo não tem', async () => {
    const r = await api.patch('/api/app/usuarios/leitor1', { data: { permAprovarRdo: true } })
    expect(r.status()).toBe(403)
    expect((await r.json()).erro).toMatch(/permissões que você mesmo possui/i)
    expect((await api.post('/api/app/usuarios', { data: { email: 'novo@teste.com', perfil: 'PERSONALIZADO', permAprovarRdo: true } })).status()).toBe(403)
  })

  test('mas gerencia a equipe normalmente: concede o que tem e reenvia o que já estava concedido', async () => {
    // ele tem "gerenciar equipe" → pode conceder essa
    expect((await api.patch('/api/app/usuarios/leitor1', { data: { permGerenciarEquipe: true } })).status()).toBe(200)
    // o emissor já tem "emitir RDO" (que o gerente não tem): a tela reenvia tudo, e isso não é conceder nada
    expect((await api.patch('/api/app/usuarios/emissor1', { data: { nome: 'Emissor', permEmitirRdo: true, permAprovarRdo: false } })).status()).toBe(200)
  })
})

// A URL da mídia vira, na exclusão, um caminho apagado com a chave de serviço do
// Storage: se o servidor aceitasse uma URL da pasta de outra empresa, dava pra
// mandar apagar arquivo alheio.
test.describe('mídia: só aceita arquivo da própria pasta (tenant/RDO)', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, EMISSOR_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('rejeita URL da pasta de outra empresa, de outro RDO, http e lixo', async () => {
    const com = (url: unknown) => api.post('/api/app/midias', { data: { ...midiaNova('rc3'), url } })
    expect((await com(urlStorage('outra-empresa/rc3'))).status()).toBe(400)          // outro tenant
    expect((await com(urlStorage(`${TENANT_ID}/rdo-de-outro`))).status()).toBe(400) // outro RDO
    expect((await com(urlStorage(`${TENANT_ID}/rc3`).replace('https', 'http'))).status()).toBe(400)
    expect((await com('https://evil.example/qualquer.png')).status()).toBe(400)      // fora do bucket
    expect((await com(undefined)).status()).toBe(400)
    expect((await com(`https://mock.supabase.co/storage/v1/object/public/rdos-midias/${TENANT_ID}/rc3/../../outra/x.png`)).status()).toBe(400)
  })

  test('rejeita tipo inválido e aceita a URL correta', async () => {
    expect((await api.post('/api/app/midias', { data: { ...midiaNova('rc3'), tipo: 'EXECUTAVEL' } })).status()).toBe(400)
    expect((await api.post('/api/app/midias', { data: midiaNova('rc3') })).status()).toBe(201)
  })
})

test.describe('administrador', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await logarComo(playwright, baseURL, ADMIN_EMAIL) })
  test.afterAll(async () => { await api.dispose() })

  test('acessa os relatórios', async () => {
    expect((await api.get('/api/app/relatorios')).status()).toBe(200)
  })

  test('concede o perfil de administrador e administra projetos', async () => {
    expect((await api.patch('/api/app/usuarios/emissor1', { data: { perfil: 'ADMIN' } })).status()).toBe(200)
    expect((await api.patch(`/api/app/projetos/${PROJETO_CONCLUIDO_ID}`, { data: { nome: 'Obra Concluida E2E' } })).status()).toBe(200)
    expect((await api.get(`/api/app/projetos/${PROJETO_CONCLUIDO_ID}/assinaturas`)).status()).toBe(200)
  })

  test('adiciona mídia em rascunho, mas nem o administrador altera RDO aprovado', async () => {
    expect((await api.post('/api/app/midias', { data: midiaNova('rc3') })).status()).toBe(201)
    expect((await api.post('/api/app/midias', { data: midiaNova('rc1') })).status()).toBe(400)
    expect((await api.delete('/api/app/midias?id=m1')).status()).toBe(400)
  })
})
