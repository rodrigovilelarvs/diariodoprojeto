import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test'
import { SUPERADMIN_EMAIL, ADMIN_SENHA } from '../../lib/fake-db-test'

// Quando o super-admin altera um limite de um plano, as empresas que estão
// nesse plano passam a ter o novo limite (antes, cada empresa guardava uma
// cópia da contratação e a alteração só valia pra empresas novas). Preço e
// funcionalidades são lidos do plano na hora, e o MRR usa o preço do plano.
//
// Dados do banco falso (lib/fake-db-test.ts):
//   Empresa A e B → plano STARTER (3 usuários, 30 RDOs/mês, 2 projetos)
//   Empresa C     → plano PRO (10, 100, 10)
//   Preços: STARTER 0, PRO 297. Os testes rodam em sequência e compartilham o estado.

const baseURL = 'http://localhost:3100'

async function adminApi(playwright: PlaywrightWorkerArgs['playwright']): Promise<APIRequestContext> {
  const login = await playwright.request.newContext({ baseURL })
  const res = await login.post('/api/admin/auth/login', { data: { email: SUPERADMIN_EMAIL, senha: ADMIN_SENHA } })
  expect(res.ok(), 'login do super-admin').toBeTruthy()
  const { token } = await res.json()
  await login.dispose()
  // /api/admin exige o cookie admin_token (middleware) e o header Bearer (requireAdmin)
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}`, Cookie: `admin_token=${token}` } })
}

type Empresa = { id: string; limiteUsuarios: number; limiteRdosMes: number; limiteProjetos: number }
async function empresas(api: APIRequestContext) {
  const r = await (await api.get('/api/admin/tenants')).json()
  const por = (id: string) => r.tenants.find((t: Empresa) => t.id === id) as Empresa
  return { A: por('ta'), B: por('tb'), C: por('tc'), mrr: r.resumo.mrr as number }
}

test.describe.configure({ mode: 'serial' })

test.describe('alterar um plano no super-admin', () => {
  let api: APIRequestContext
  test.beforeAll(async ({ playwright }) => { api = await adminApi(playwright) })
  test.afterAll(async () => { await api.dispose() })

  test('ponto de partida: limites das empresas iguais aos do plano; MRR = preço do plano Pro', async () => {
    const e = await empresas(api)
    expect([e.A.limiteUsuarios, e.A.limiteRdosMes, e.A.limiteProjetos]).toEqual([3, 30, 2])
    expect([e.C.limiteUsuarios, e.C.limiteRdosMes, e.C.limiteProjetos]).toEqual([10, 100, 10])
    expect(e.mrr).toBe(297)
  })

  test('mudar limite e preço do Starter: as empresas do Starter absorvem o limite; a do Pro fica como está', async () => {
    const r = await api.patch('/api/admin/planos', { data: { tipo: 'STARTER', limiteUsuarios: 8, limiteProjetos: 5, precoMensal: 49.9 } })
    expect(r.status()).toBe(200)
    expect((await r.json()).empresasAtualizadas).toBe(2)

    const e = await empresas(api)
    for (const emp of [e.A, e.B]) {
      expect(emp.limiteUsuarios).toBe(8)
      expect(emp.limiteProjetos).toBe(5)
      expect(emp.limiteRdosMes).toBe(30) // não foi alterado: continua igual
    }
    expect([e.C.limiteUsuarios, e.C.limiteRdosMes, e.C.limiteProjetos]).toEqual([10, 100, 10])
    // O preço novo aparece no MRR (2 empresas Starter a 49,90 + 1 Pro a 297)
    expect(e.mrr).toBeCloseTo(49.9 * 2 + 297, 2)
  })

  test('mudar só o preço: os limites das empresas não são tocados', async () => {
    // a tela reenvia todos os campos; os limites vêm com o mesmo valor de antes
    const r = await api.patch('/api/admin/planos', { data: { tipo: 'PRO', precoMensal: 350, limiteUsuarios: 10, limiteRdosMes: 100, limiteProjetos: 10 } })
    expect(r.status()).toBe(200)
    expect((await r.json()).empresasAtualizadas).toBe(0)

    const e = await empresas(api)
    expect([e.C.limiteUsuarios, e.C.limiteRdosMes, e.C.limiteProjetos]).toEqual([10, 100, 10])
    expect(e.mrr).toBeCloseTo(49.9 * 2 + 350, 2)
  })

  test('valor inválido é recusado e não altera nada', async () => {
    for (const data of [
      { tipo: 'STARTER', limiteUsuarios: -1 },
      { tipo: 'STARTER', limiteProjetos: 2.5 },
      { tipo: 'STARTER', limiteRdosMes: 'muitos' },
      { tipo: 'STARTER', precoMensal: -10 },
    ]) {
      expect((await api.patch('/api/admin/planos', { data })).status(), JSON.stringify(data)).toBe(400)
    }
    const e = await empresas(api)
    expect([e.A.limiteUsuarios, e.A.limiteRdosMes, e.A.limiteProjetos]).toEqual([8, 30, 5])
  })

  test('sem login de super-admin não altera plano', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL })
    expect((await anon.patch('/api/admin/planos', { data: { tipo: 'STARTER', limiteUsuarios: 999 } })).status()).toBe(401)
    await anon.dispose()
  })
})
