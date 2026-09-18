import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { PROJETO_NOME } from '../../lib/fake-db-test'

// Teste de regressão: criar um RDO e ser redirecionado pro detalhe não pode
// deixar a tela em branco (bug real de produção — a resposta do POST de
// criação vinha com relações faltando, e a tela quebrava ao montar o
// formulário com elas ausentes). Ver app/(app)/rdos/[id]/FormularioRdo.tsx
// (estadoInicial) e app/api/app/rdos/route.ts.
test('criar RDO abre o formulário do RDO novo, sem tela em branco', async ({ page }) => {
  await login(page)

  await page.goto('/rdos/novo')
  // Os campos desta tela não têm <label for=...> associado ao <select>,
  // então localizamos pelo próprio elemento (único select na página).
  await page.locator('select').selectOption({ label: PROJETO_NOME })
  await page.getByRole('button', { name: 'Criar RDO' }).click()

  // Cuidado: /\/rdos\/.+/ também bate com a própria "/rdos/novo" — usa um
  // predicado que exige sair dela de fato, senão o teste segue adiante
  // antes da navegação real acontecer.
  await page.waitForURL((url) => /\/rdos\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/novo'), { timeout: 15_000 })

  // O error boundary mostraria exatamente este texto se a tela tivesse quebrado
  await expect(page.getByText('Algo deu errado nesta tela')).toHaveCount(0)

  // E o formulário de verdade precisa estar visível
  await expect(page.getByText('Identificação')).toBeVisible()
  await expect(page.getByText('Condições climáticas')).toBeVisible()
})
