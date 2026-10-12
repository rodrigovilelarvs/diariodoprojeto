import { test, expect } from '@playwright/test'
import { apiComo, login } from './helpers'
import { PROJETO_ID } from '../../lib/fake-db-test'

// Depois de enviar o RDO para aprovação a pessoa continua na página do RDO (que passa a
// aparecer bloqueado) e tem um botão "Novo RDO" ali mesmo, já com o projeto selecionado,
// para não precisar ir a outra tela. Ver handleEnviar/handleNovoRdo em FormularioRdo.tsx.

test('enviar para aprovação mantém na página do RDO e oferece o botão Novo RDO', async ({ page, playwright }) => {
  const api = await apiComo(playwright)
  const criado = await api.post('/api/app/rdos', { data: { projetoId: PROJETO_ID, data: '2026-11-10', copiarAnterior: false } })
  expect(criado.status()).toBe(201)
  const { id } = await criado.json()
  await api.dispose()

  await login(page)
  await page.goto(`/rdos/${id}`)

  const enviou = page.waitForResponse(r => r.url().endsWith(`/api/app/rdos/${id}/enviar`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Enviar para aprovação/ }).click()
  expect((await enviou).status()).toBe(200)

  // continua no RDO, agora bloqueado, e não foi para a lista
  await expect(page.getByText(/já foi enviado para aprovação e está bloqueado/)).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(`/rdos/${id}`)

  // e dá para abrir um novo RDO do mesmo projeto direto daqui
  await page.getByRole('button', { name: 'Novo RDO' }).click()
  await page.waitForURL(`**/rdos/novo?projetoId=${PROJETO_ID}`)
})
