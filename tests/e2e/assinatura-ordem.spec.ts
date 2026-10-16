import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID, APROVADOR1_EMAIL, APROVADOR2_EMAIL } from '../../lib/fake-db-test'
import { sequenciaDeAssinantes, vezDeAssinar, proximoAAssinar, ordenarPorSequencia } from '../../lib/assinatura-ordem'

// Com 2 ou 3 assinantes pré-definidos no projeto, a assinatura é em sequência: o 2º só assina
// depois do 1º, o 3º só depois do 2º. Pedir revisão continua livre. No modo aberto não há ordem.
// Ver lib/assinatura-ordem.ts e o POST em app/api/app/rdos/[id]/aprovar/route.ts.

test.describe('regra de ordem (funções puras)', () => {
  const seq = ['a', 'b', 'c']
  const slots = (...st: string[]) => seq.map((id, i) => ({ usuarioId: id, status: st[i] }))

  test('sequência só existe no modo pré-definido', () => {
    expect(sequenciaDeAssinantes({ assinaturaModo: 'ABERTA', assinante1Id: 'a' })).toEqual([])
    expect(sequenciaDeAssinantes({ assinaturaModo: 'DEFINIDA', assinante1Id: 'a', assinante2Id: null, assinante3Id: 'c' })).toEqual(['a', 'c'])
  })

  test('cada um só assina depois de todos os anteriores', () => {
    expect(vezDeAssinar(seq, slots('PENDENTE', 'PENDENTE', 'PENDENTE'), 'a').podeAssinar).toBe(true)
    expect(vezDeAssinar(seq, slots('PENDENTE', 'PENDENTE', 'PENDENTE'), 'b')).toEqual({ podeAssinar: false, aguardandoId: 'a' })
    expect(vezDeAssinar(seq, slots('PENDENTE', 'PENDENTE', 'PENDENTE'), 'c')).toEqual({ podeAssinar: false, aguardandoId: 'a' })
    expect(vezDeAssinar(seq, slots('ASSINADO', 'PENDENTE', 'PENDENTE'), 'b').podeAssinar).toBe(true)
    expect(vezDeAssinar(seq, slots('ASSINADO', 'PENDENTE', 'PENDENTE'), 'c')).toEqual({ podeAssinar: false, aguardandoId: 'b' })
    expect(vezDeAssinar(seq, slots('ASSINADO', 'ASSINADO', 'PENDENTE'), 'c').podeAssinar).toBe(true)
  })

  test('modo aberto (sem sequência) e quem não tem registro não travam ninguém', () => {
    expect(vezDeAssinar([], [{ usuarioId: 'x', status: 'PENDENTE' }], 'x').podeAssinar).toBe(true)
    // o 1º assinante não tem registro no RDO (ex.: desativado): o 2º não fica preso
    expect(vezDeAssinar(['a', 'b'], [{ usuarioId: 'b', status: 'PENDENTE' }], 'b').podeAssinar).toBe(true)
  })

  test('próximo a assinar e ordenação', () => {
    expect(proximoAAssinar(seq, slots('ASSINADO', 'PENDENTE', 'PENDENTE'))).toBe('b')
    expect(proximoAAssinar(seq, slots('ASSINADO', 'ASSINADO', 'ASSINADO'))).toBeUndefined()
    const embaralhado = [{ usuario: { id: 'c' } }, { usuario: { id: 'a' } }, { usuario: { id: 'b' } }]
    expect(ordenarPorSequencia(embaralhado, seq).map(x => x.usuario.id)).toEqual(['a', 'b', 'c'])
  })
})

test('o servidor barra a assinatura fora de ordem e libera cada assinante na sua vez', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const ap1 = await apiComo(playwright, APROVADOR1_EMAIL)
  const ap2 = await apiComo(playwright, APROVADOR2_EMAIL)

  // projeto com 3 assinantes em sequência: Primeiro, Segundo e o administrador
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
    data: { assinaturaModo: 'DEFINIDA', assinante1Id: 'aprovador1', assinante2Id: 'aprovador2', assinante3Id: 'admin1' },
  })).status()).toBe(200)

  try {
    const criado = await admin.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-04-01', copiarAnterior: false } })
    const { id } = await criado.json()
    expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)

    // as 3 assinaturas nascem pendentes, na ordem configurada
    const antes = (await (await admin.get(`/api/app/rdos/${id}`)).json()).assinaturas as Array<{ usuario: { id: string }; status: string }>
    expect(antes.map(a => a.usuario.id)).toEqual(['aprovador1', 'aprovador2', 'admin1'])
    expect(antes.every(a => a.status === 'PENDENTE')).toBe(true)

    const assinar = (api: typeof admin) => api.post(`/api/app/rdos/${id}/aprovar`, { data: { aprovado: true } })

    // fora de ordem: 3º e 2º não conseguem assinar primeiro
    const terceiro = await assinar(admin)
    expect(terceiro.status()).toBe(409)
    expect((await terceiro.json()).codigo).toBe('ORDEM_ASSINATURA')
    expect((await terceiro.json()).erro).toContain('Primeiro Assinante')
    const segundo = await assinar(ap2)
    expect(segundo.status()).toBe(409)
    expect((await segundo.json()).erro).toContain('Primeiro Assinante')

    // 1º assina → agora é a vez do 2º; o 3º ainda espera o 2º
    expect((await assinar(ap1)).status()).toBe(200)
    const aindaTerceiro = await assinar(admin)
    expect(aindaTerceiro.status()).toBe(409)
    expect((await aindaTerceiro.json()).erro).toContain('Segundo Assinante')

    expect((await assinar(ap2)).status()).toBe(200)

    // 3º assina e o RDO fica totalmente aprovado
    const ultimo = await assinar(admin)
    expect(ultimo.status()).toBe(200)
    expect((await ultimo.json()).todosAssinaram).toBe(true)
  } finally {
    // devolve o projeto ao modo aberto para não afetar os outros testes
    await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
      data: { assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null },
    })
  }
  await ap1.dispose(); await ap2.dispose(); await admin.dispose()
})

test('pedir revisão não depende da ordem', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const ap2 = await apiComo(playwright, APROVADOR2_EMAIL)
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
    data: { assinaturaModo: 'DEFINIDA', assinante1Id: 'aprovador1', assinante2Id: 'aprovador2', assinante3Id: null },
  })).status()).toBe(200)
  try {
    const { id } = await (await admin.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-04-02', copiarAnterior: false } })).json()
    expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
    // o 2º assinante ainda não pode assinar, mas pode pedir revisão
    const r = await ap2.post(`/api/app/rdos/${id}/aprovar`, { data: { aprovado: false, comentario: 'ajustar horário' } })
    expect(r.status()).toBe(200)
  } finally {
    await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
      data: { assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null },
    })
  }
  await ap2.dispose(); await admin.dispose()
})

test('na tela, o 2º assinante vê que está aguardando o 1º e não tem o botão Assinar', async ({ page, playwright }) => {
  const admin = await apiComo(playwright)
  expect((await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
    data: { assinaturaModo: 'DEFINIDA', assinante1Id: 'aprovador1', assinante2Id: 'aprovador2', assinante3Id: null },
  })).status()).toBe(200)
  let id = ''
  try {
    id = (await (await admin.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-04-03', copiarAnterior: false } })).json()).id
    expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)

    await login(page, APROVADOR2_EMAIL)
    await page.goto(`/aprovacao/${id}`)
    await expect(page.getByText(/Aguardando a assinatura de Primeiro Assinante/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Assinar', exact: true })).toHaveCount(0)
    // a revisão continua disponível
    await expect(page.getByRole('button', { name: 'Revisar' })).toBeVisible()
  } finally {
    await admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, {
      data: { assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null },
    })
  }
  await admin.dispose()
})
