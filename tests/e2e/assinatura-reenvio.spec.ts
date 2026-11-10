import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Ao reenviar um RDO para aprovação (depois de "Voltar para rascunho"), só ficam os assinantes da
// configuração ATUAL do projeto. Bug real: o RDO tinha sido enviado com assinatura aberta (todos os
// aprovadores), voltou para rascunho, o projeto passou a ter 2 assinantes definidos — e o reenvio
// continuava exigindo as assinaturas antigas (4), porque "voltar para rascunho" só zera as linhas de
// assinatura, não apaga. Ver o início da transação em app/api/app/rdos/[id]/enviar/route.ts.

test('reenviar com 2 assinantes definidos descarta as assinaturas que sobraram do envio anterior', async ({ playwright }) => {
  const admin = await apiComo(playwright)
  const assinantes = (api: typeof admin, id: string) =>
    api.get(`/api/app/rdos/${id}`).then(async r => ((await r.json()).assinaturas as Array<{ usuario: { id: string } }>).map(a => a.usuario.id).sort())
  const configurar = (data: object) => admin.patch(`/api/app/projetos/${PROJETO_ID}/assinaturas`, { data })

  try {
    // 1º envio: assinatura aberta → todos os aprovadores entram
    expect((await configurar({ assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null })).status()).toBe(200)
    const { id } = await (await admin.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2027-09-01', copiarAnterior: false } })).json()
    expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
    expect((await assinantes(admin, id)).length).toBeGreaterThan(2)

    // volta para rascunho e a pasta passa a exigir só 2 assinantes
    expect((await admin.post(`/api/app/rdos/${id}/reabrir`, { data: {} })).status()).toBe(200)
    expect((await configurar({ assinaturaModo: 'DEFINIDA', assinante1Id: 'aprovador1', assinante2Id: 'aprovador2', assinante3Id: null })).status()).toBe(200)

    // reenvio: sobram exatamente os 2 configurados
    expect((await admin.post(`/api/app/rdos/${id}/enviar`, { data: {} })).status()).toBe(200)
    expect(await assinantes(admin, id)).toEqual(['aprovador1', 'aprovador2'])
  } finally {
    await configurar({ assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null })
  }
  await admin.dispose()
})
