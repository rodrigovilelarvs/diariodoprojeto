import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { PROJETO_ID, LEITOR_EMAIL } from '../../lib/fake-db-test'

// O sistema serve a contratadas e a contratantes. Em "Dados da empresa" o
// administrador escolhe para quem a empresa cria projetos (tipoEmpresaProjeto) e o
// rótulo do campo da empresa — no cadastro do projeto, no RDO, na aprovação e nos
// PDFs — segue essa escolha ("Empresa contratada" ou "Empresa contratante").
// Ver app/(app)/empresa/page.tsx, components/projetos/EmpresaCampo.tsx e
// rotuloEmpresa() em lib/rdo-display.ts. Os testes rodam em sequência e compartilham
// o estado do banco falso, por isso o último devolve a empresa ao padrão.

test('a empresa começa como "contratada" (padrão) e o RDO e o projeto trazem o tipo', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const empresa = await (await api.get('/api/app/empresa')).json()
  expect(empresa.tipoEmpresaProjeto).toBe('CONTRATADA')

  const lista = await (await api.get(`/api/app/rdos?projetoId=${PROJETO_ID}`)).json()
  const rdo = await (await api.get(`/api/app/rdos/${lista.rdos[0].id}`)).json()
  expect(rdo.projeto.empresaTipo).toBe('CONTRATADA')
  const resumo = await (await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()
  expect(resumo.projeto.empresaTipo).toBe('CONTRATADA')
  await api.dispose()
})

test('só o administrador altera, e só para um valor válido', async ({ playwright }) => {
  const leitor = await apiComo(playwright, LEITOR_EMAIL)
  const negado = await leitor.patch('/api/app/empresa', { data: { tipoEmpresaProjeto: 'CONTRATANTE' } })
  expect(negado.status()).toBe(403)
  await leitor.dispose()

  const api = await apiComo(playwright)
  const ruim = await api.patch('/api/app/empresa', { data: { tipoEmpresaProjeto: 'FORNECEDOR' } })
  expect(ruim.status()).toBe(400)
  await api.dispose()
})

test('ao escolher "contratante", o RDO e o projeto passam a trazer esse tipo', async ({ playwright }) => {
  const api = await apiComo(playwright)
  const ok = await api.patch('/api/app/empresa', { data: { tipoEmpresaProjeto: 'CONTRATANTE' } })
  expect(ok.status()).toBe(200)
  expect((await ok.json()).tipoEmpresaProjeto).toBe('CONTRATANTE')

  const lista = await (await api.get(`/api/app/rdos?projetoId=${PROJETO_ID}`)).json()
  const rdo = await (await api.get(`/api/app/rdos/${lista.rdos[0].id}`)).json()
  expect(rdo.projeto.empresaTipo).toBe('CONTRATANTE')
  const resumo = await (await api.get(`/api/app/projetos/${PROJETO_ID}/resumo`)).json()
  expect(resumo.projeto.empresaTipo).toBe('CONTRATANTE')

  // devolve ao padrão para não afetar os outros testes
  const volta = await api.patch('/api/app/empresa', { data: { tipoEmpresaProjeto: 'CONTRATADA' } })
  expect(volta.status()).toBe(200)
  await api.dispose()
})
