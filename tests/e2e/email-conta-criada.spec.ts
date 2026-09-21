import http from 'node:http'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { apiComo, apiAdmin } from './helpers'

// Quando um acesso é cadastrado direto com senha inicial (sem convite), a pessoa
// recebe um e-mail de AVISO: em qual empresa a conta foi criada e como entrar.
// A SENHA nunca vai no e-mail.
//
// O servidor de teste manda os e-mails para um receptor local (porta 3199, ver
// playwright.config.ts: RESEND_BASE_URL), que aqui guarda o que chegou — assim o
// teste vê o e-mail de verdade, sem enviar nada pela internet.

type Email = { to: string | string[]; subject: string; html: string }
const recebidos: Email[] = []
let receptor: http.Server

test.beforeAll(async () => {
  receptor = http.createServer((req, res) => {
    let corpo = ''
    req.on('data', (parte) => { corpo += parte })
    req.on('end', () => {
      try { recebidos.push(JSON.parse(corpo)) } catch { /* corpo que não é e-mail: ignora */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: 'email-de-teste' }))
    })
  })
  await new Promise<void>((ok) => receptor.listen(3199, '127.0.0.1', ok))
})
test.afterAll(async () => { await new Promise<void>((ok) => receptor.close(() => ok())) })

const paraEndereco = (e: Email, endereco: string) => [e.to].flat().includes(endereco)

async function esperarEmailPara(endereco: string): Promise<Email> {
  await expect.poll(() => recebidos.some(e => paraEndereco(e, endereco)), { timeout: 15_000, message: `e-mail para ${endereco}` }).toBe(true)
  return recebidos.find(e => paraEndereco(e, endereco))!
}

test.describe('cadastro direto com senha inicial (na empresa)', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await apiComo(playwright) })
  test.afterAll(async () => { await api.dispose() })

  test('avisa a pessoa por e-mail, com a empresa e o link de acesso — e SEM a senha', async () => {
    const senha = 'SenhaInicial#987'
    const r = await api.post('/api/app/usuarios', {
      data: { email: 'novo.cadastro@teste.com', nome: 'Nova Pessoa', perfil: 'PERSONALIZADO', senha, permEmitirRdo: true },
    })
    expect(r.status()).toBe(201)
    expect((await r.json()).senhaDefinida).toBe(true)

    const email = await esperarEmailPara('novo.cadastro@teste.com')
    expect(email.subject).toContain('Seu acesso ao Diário do Projeto')
    expect(email.subject).toContain('Empresa Teste')
    expect(email.html).toContain('Nova Pessoa')
    expect(email.html).toContain('novo.cadastro@teste.com')
    expect(email.html).toContain('/login')
    expect(email.html).toContain('administrador da sua empresa')
    // a senha não vai no e-mail, em nenhuma forma
    expect(email.subject + email.html).not.toContain(senha)
    expect(email.html).toContain('não é enviada por e-mail')
  })

  test('nome digitado por terceiros não injeta HTML no e-mail', async () => {
    const r = await api.post('/api/app/usuarios', {
      data: { email: 'html.injetado@teste.com', nome: '<a href="https://evil.example">clique aqui</a>', perfil: 'PERSONALIZADO', senha: 'SenhaInicial#111' },
    })
    expect(r.status()).toBe(201)
    const email = await esperarEmailPara('html.injetado@teste.com')
    expect(email.html).not.toContain('<a href="https://evil.example">')
    expect(email.html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;')
  })

  test('convite (sem senha) continua mandando o e-mail de convite, não o aviso de conta criada', async () => {
    const r = await api.post('/api/app/usuarios', { data: { email: 'so.convite@teste.com', perfil: 'PERSONALIZADO' } })
    expect(r.status()).toBe(201)
    const email = await esperarEmailPara('so.convite@teste.com')
    expect(email.subject).toContain('Convite')
    expect(email.subject).not.toContain('Seu acesso')
  })
})

test('super-admin cria empresa já com senha: o administrador recebe o aviso (sem a senha)', async ({ playwright }) => {
  const admin = await apiAdmin(playwright)
  const senha = 'SenhaInicial#456'
  const r = await admin.post('/api/admin/tenants', {
    data: { nome: 'Construtora Nova', admNome: 'Admin Novo', admEmail: 'admin.novo@teste.com', senha, plano: 'STARTER' },
  })
  expect(r.status()).toBe(201)
  await admin.dispose()

  const email = await esperarEmailPara('admin.novo@teste.com')
  expect(email.subject).toContain('Construtora Nova')
  expect(email.html).toContain('equipe do Diário do Projeto')
  expect(email.html).toContain('Administrador')
  expect(email.subject + email.html).not.toContain(senha)
})
