import { test, expect } from '@playwright/test'
import { login, abrirJanelaNovoRdo } from './helpers'
import { PROJETO_NOME } from '../../lib/fake-db-test'

// Teste de regressão: criar um RDO e ser redirecionado pro detalhe não pode
// deixar a tela em branco (bug real de produção — a resposta do POST de
// criação vinha com relações faltando, e a tela quebrava ao montar o
// formulário com elas ausentes). Ver app/(app)/rdos/[id]/FormularioRdo.tsx
// (estadoInicial) e app/api/app/rdos/route.ts.
test('criar RDO abre o formulário do RDO novo, sem tela em branco', async ({ page }) => {
  await login(page)

  // O Novo RDO é uma janela (modal) aberta pelo menu lateral
  await page.goto('/painel')
  await abrirJanelaNovoRdo(page, page.locator('.sb').getByRole('button', { name: 'Novo RDO' }))
  await page.locator('.modal select').selectOption({ label: PROJETO_NOME })
  await page.getByRole('button', { name: 'Criar RDO' }).click()

  // Exige um RDO de fato (id depois de /rdos/): senão o teste segue adiante
  // antes da navegação real acontecer.
  await page.waitForURL((url) => /\/rdos\/[^/]+$/.test(url.pathname), { timeout: 15_000 })

  // O error boundary mostraria exatamente este texto se a tela tivesse quebrado
  await expect(page.getByText('Algo deu errado nesta tela')).toHaveCount(0)

  // E o formulário de verdade precisa estar visível
  await expect(page.getByText('Identificação')).toBeVisible()
  await expect(page.getByText('Condições climáticas')).toBeVisible()
})
