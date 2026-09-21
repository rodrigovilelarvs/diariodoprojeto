import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import {
  ADMIN_SENHA, MULTI_EMAIL, DONO_EMAIL, VIAJANTE_EMAIL, NOVATO_EMAIL, TENANT_ID, TENANT2_ID,
} from '../../lib/fake-db-test'

// Um e-mail pode ter conta em mais de uma empresa, com perfil e permissões
// próprios em cada uma. A SENHA é uma só por e-mail:
//   - o login confere a senha em todas as contas do e-mail e, se houver mais de
//     uma empresa, pede a escolha;
//   - dentro do sistema dá pra trocar de empresa sem digitar a senha (mesma credencial);
//   - trocar a senha vale pras contas que compartilham a credencial;
//   - aceitar convite pra e-mail que já tem senha exige a senha atual.
// Contas do mesmo e-mail com credenciais DIFERENTES não se misturam: senão quem
// controla uma conta cadastrada com o e-mail de outra pessoa pularia pra conta
// dela em outra empresa.
//
// Dados do banco falso (lib/fake-db-test.ts):
//   multi@   → conta em t1 (ADMIN) e t2 (PERSONALIZADO), mesma credencial (teste123)
//   dono@    → t1: teste123 · t2: outra credencial (atacante123), como se cadastrada à parte
//   viajante@→ conta só em t1 (teste123); convite pendente pra t2
//   novato@  → e-mail novo; convite pendente pra t2
// Os testes rodam em sequência e compartilham o estado.

const baseURL = 'http://localhost:3100'
type Playwright = PlaywrightWorkerArgs['playwright']

async function post(playwright: Playwright, path: string, data: unknown, token?: string) {
  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` } : {},
  })
  const res = await ctx.post(path, { data })
  const corpo = await res.json().catch(() => ({}))
  await ctx.dispose()
  return { status: res.status(), corpo }
}

const login = (p: Playwright, email: string, senha: string, tenantId?: string) =>
  post(p, '/api/auth/login', { email, senha, ...(tenantId ? { tenantId } : {}) })

async function quemSou(p: Playwright, token: string): Promise<string> {
  const ctx: APIRequestContext = await p.request.newContext({
    baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `app_token=${token}` },
  })
  const { id } = await (await ctx.get('/api/app/perfil')).json()
  await ctx.dispose()
  return id
}

test.describe.configure({ mode: 'serial' })

test.describe('login com o mesmo e-mail em mais de uma empresa', () => {
  test('pede a escolha da empresa, sem entregar sessão antes', async ({ playwright }) => {
    const r = await login(playwright, MULTI_EMAIL, ADMIN_SENHA)
    expect(r.status).toBe(200)
    expect(r.corpo.escolherEmpresa).toBe(true)
    expect(r.corpo.token).toBeUndefined()
    expect(r.corpo.empresas.map((e: { nome: string }) => e.nome).sort()).toEqual(['Empresa Dois', 'Empresa Teste'])
  })

  test('escolhendo a empresa entra nela, com o perfil daquela empresa', async ({ playwright }) => {
    const a = await login(playwright, MULTI_EMAIL, ADMIN_SENHA, TENANT_ID)
    expect(a.status).toBe(200)
    expect([a.corpo.tenant.id, a.corpo.usuario.id, a.corpo.usuario.perfil]).toEqual([TENANT_ID, 'multi-a', 'ADMIN'])

    const b = await login(playwright, MULTI_EMAIL, ADMIN_SENHA, TENANT2_ID)
    expect([b.corpo.tenant.id, b.corpo.usuario.id, b.corpo.usuario.perfil]).toEqual([TENANT2_ID, 'multi-b', 'PERSONALIZADO'])

    expect((await login(playwright, MULTI_EMAIL, ADMIN_SENHA, 'empresa-que-nao-existe')).status).toBe(400)
    expect((await login(playwright, MULTI_EMAIL, 'senha-errada-123')).status).toBe(401)
  })
})

test.describe('trocar de empresa dentro do sistema', () => {
  test('mesma credencial: troca direto, sem digitar a senha', async ({ playwright }) => {
    const entrada = await login(playwright, MULTI_EMAIL, ADMIN_SENHA, TENANT_ID)
    const troca = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT2_ID }, entrada.corpo.token)
    expect(troca.status).toBe(200)
    expect(troca.corpo.tenant.id).toBe(TENANT2_ID)
    // o token novo é da conta da outra empresa
    expect(await quemSou(playwright, troca.corpo.token)).toBe('multi-b')

    // e de volta
    const volta = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT_ID }, troca.corpo.token)
    expect(volta.status).toBe(200)
    expect(await quemSou(playwright, volta.corpo.token)).toBe('multi-a')
  })

  test('recusa: empresa atual, empresa onde não tem conta, e sem estar logado', async ({ playwright }) => {
    const entrada = await login(playwright, MULTI_EMAIL, ADMIN_SENHA, TENANT_ID)
    expect((await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT_ID }, entrada.corpo.token)).status).toBe(400)
    expect((await post(playwright, '/api/auth/trocar-empresa', { tenantId: 'outra-empresa' }, entrada.corpo.token)).status).toBe(404)
    expect((await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT2_ID })).status).toBe(401)
  })
})

test.describe('contas do mesmo e-mail com credenciais diferentes não se misturam', () => {
  test('quem tem a senha de cada conta entra em cada uma e precisa digitá-la para trocar', async ({ playwright }) => {
    // teste123 só abre a conta de t1 (a de t2 tem outra credencial): entra direto
    const a = await login(playwright, DONO_EMAIL, ADMIN_SENHA)
    expect(a.status).toBe(200)
    expect(a.corpo.tenant.id).toBe(TENANT_ID)

    const semSenha = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT2_ID }, a.corpo.token)
    expect(semSenha.status).toBe(403) // 403, não 401: 401 derrubaria a sessão no cliente
    expect(semSenha.corpo.codigo).toBe('PEDIR_SENHA')

    const errada = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT2_ID, senha: 'senha-errada-123' }, a.corpo.token)
    expect([errada.status, errada.corpo.codigo]).toEqual([403, 'SENHA_INCORRETA'])

    const certa = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT2_ID, senha: 'atacante123' }, a.corpo.token)
    expect(certa.status).toBe(200)
    expect(certa.corpo.tenant.id).toBe(TENANT2_ID)
  })

  test('ATAQUE: quem controla a conta cadastrada à parte NÃO pula para a conta do dono em outra empresa', async ({ playwright }) => {
    // Um administrador da empresa 2 cadastrou o e-mail do dono com uma senha que ele escolheu
    const atacante = await login(playwright, DONO_EMAIL, 'atacante123')
    expect(atacante.status).toBe(200)
    expect(atacante.corpo.tenant.id).toBe(TENANT2_ID)

    // sem senha da empresa 1: recusado
    const pula = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT_ID }, atacante.corpo.token)
    expect([pula.status, pula.corpo.codigo]).toEqual([403, 'PEDIR_SENHA'])
    // chutando a própria senha como se fosse a da empresa 1: recusado
    const chuta = await post(playwright, '/api/auth/trocar-empresa', { tenantId: TENANT_ID, senha: 'atacante123' }, atacante.corpo.token)
    expect([chuta.status, chuta.corpo.codigo]).toEqual([403, 'SENHA_INCORRETA'])

    // trocando a senha DELE, a conta do dono continua intacta
    const troca = await post(playwright, '/api/app/perfil/senha', { senhaAtual: 'atacante123', novaSenha: 'novasenha999' }, atacante.corpo.token)
    expect(troca.status).toBe(200)
    const dono = await login(playwright, DONO_EMAIL, ADMIN_SENHA) // a senha do dono segue valendo
    expect([dono.status, dono.corpo.tenant.id]).toEqual([200, TENANT_ID])
    const atacanteNovo = await login(playwright, DONO_EMAIL, 'novasenha999')
    expect(atacanteNovo.corpo.tenant.id).toBe(TENANT2_ID)
  })
})

test('a tela de login pede a empresa e Meu perfil permite trocar de empresa', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('seu@email.com').fill(MULTI_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_SENHA)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Escolha a empresa')).toBeVisible()
  await page.getByRole('button', { name: /Empresa Dois/ }).click()
  await page.waitForURL('**/painel', { timeout: 15_000 })
  const sessao = () => page.evaluate(() => JSON.parse(localStorage.getItem('app_session') ?? '{}').tenantNome)
  expect(await sessao()).toBe('Empresa Dois')

  // Meu perfil lista as duas empresas e troca direto (mesma credencial)
  await page.goto('/perfil')
  await expect(page.getByText('Empresa atual')).toBeVisible()
  await page.getByRole('button', { name: /Entrar/ }).click()
  await page.waitForURL('**/painel', { timeout: 15_000 })
  expect(await sessao()).toBe('Empresa Teste')
})

test.describe('trocar a senha', () => {
  test('vale para as contas que compartilham a credencial; errar a senha atual não derruba a sessão', async ({ playwright }) => {
    const entrada = await login(playwright, MULTI_EMAIL, ADMIN_SENHA, TENANT_ID)

    // senha atual errada: 403 com código (era 401, que o cliente tratava como "sessão expirada")
    const errada = await post(playwright, '/api/app/perfil/senha', { senhaAtual: 'nao-e-essa-123', novaSenha: 'senha-nova-123' }, entrada.corpo.token)
    expect([errada.status, errada.corpo.codigo]).toEqual([403, 'SENHA_ATUAL_INCORRETA'])

    const ok = await post(playwright, '/api/app/perfil/senha', { senhaAtual: ADMIN_SENHA, novaSenha: 'senha-nova-123' }, entrada.corpo.token)
    expect(ok.status).toBe(200)

    // a senha nova vale nas DUAS empresas (continua pedindo a escolha); a antiga não vale mais
    const nova = await login(playwright, MULTI_EMAIL, 'senha-nova-123')
    expect(nova.corpo.escolherEmpresa).toBe(true)
    expect(nova.corpo.empresas).toHaveLength(2)
    expect((await login(playwright, MULTI_EMAIL, ADMIN_SENHA)).status).toBe(401)
  })
})

test.describe('convite para um e-mail que já tem senha', () => {
  const consultar = async (p: Playwright, token: string) => {
    const ctx = await p.request.newContext({ baseURL })
    const r = await ctx.get(`/api/auth/convite?token=${token}`)
    const corpo = await r.json()
    await ctx.dispose()
    return corpo
  }

  test('a tela do convite sabe se o e-mail já tem senha', async ({ playwright }) => {
    expect((await consultar(playwright, 'conv-viajante')).contaExistente).toBe(true)
    expect((await consultar(playwright, 'conv-novato')).contaExistente).toBe(false)
  })

  test('e-mail com senha: exige a senha atual e a nova conta usa a mesma credencial', async ({ playwright }) => {
    const errada = await post(playwright, '/api/auth/convite', { token: 'conv-viajante', nome: 'Viajante', senha: 'outra-senha-123' })
    expect(errada.status).toBe(401)
    expect(errada.corpo.erro).toMatch(/senha incorreta/i)

    const certa = await post(playwright, '/api/auth/convite', { token: 'conv-viajante', nome: 'Viajante', senha: ADMIN_SENHA })
    expect(certa.status).toBe(200)
    expect(certa.corpo.tenant.id).toBe(TENANT2_ID)

    // agora o e-mail tem conta nas duas empresas com a MESMA senha: o login pede a escolha
    const entrada = await login(playwright, VIAJANTE_EMAIL, ADMIN_SENHA)
    expect(entrada.corpo.escolherEmpresa).toBe(true)
    expect(entrada.corpo.empresas).toHaveLength(2)

    // o convite não serve duas vezes
    expect((await post(playwright, '/api/auth/convite', { token: 'conv-viajante', nome: 'Viajante', senha: ADMIN_SENHA })).status).toBe(400)
  })

  test('e-mail novo: cria a senha (mínimo 8 caracteres)', async ({ playwright }) => {
    const curta = await post(playwright, '/api/auth/convite', { token: 'conv-novato', nome: 'Novato', senha: 'curta' })
    expect(curta.status).toBe(400)

    const ok = await post(playwright, '/api/auth/convite', { token: 'conv-novato', nome: 'Novato', senha: 'novasenha123' })
    expect(ok.status).toBe(200)
    const entrada = await login(playwright, NOVATO_EMAIL, 'novasenha123')
    expect([entrada.status, entrada.corpo.tenant.id]).toEqual([200, TENANT2_ID])
  })
})
