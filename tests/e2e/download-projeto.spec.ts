import { test, expect, type Page, type Download } from '@playwright/test'
import JSZip from 'jszip'
import { readFileSync } from 'fs'
import { login } from './helpers'
import { PROJETO_ID, PROJETO_CONCLUIDO_ID, PROJETO_GRANDE_ID, STORAGE_FAKE } from '../../lib/fake-db-test'

// PNG 1x1 válido — serve de "foto" pro PDF e pro ZIP de mídias
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

// As mídias do banco falso apontam pra um host inexistente; aqui ele passa a
// existir: foto e arquivo respondem normalmente, o vídeo responde 404 (pra
// exercitar o caminho "um arquivo falhou, o pacote sai mesmo assim").
async function simularStorage(page: Page) {
  await page.route(`${STORAGE_FAKE}/**`, (route) => {
    const nome = route.request().url().split('/').pop()
    const cors = { 'access-control-allow-origin': '*' }
    if (nome?.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1, headers: cors })
    if (nome === 'laudo.txt') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'laudo', headers: cors })
    return route.fulfill({ status: 404, body: 'nao encontrado', headers: cors })
  })
}

async function baixarZip(page: Page, nomeBotao: RegExp) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: nomeBotao }).click(),
  ])
  const caminho = await download.path()
  const zip = await JSZip.loadAsync(readFileSync(caminho))
  return { nomeArq: download.suggestedFilename(), zip, entradas: Object.keys(zip.files).filter(n => !zip.files[n].dir).sort() }
}

test('projeto ativo não oferece os downloads em massa', async ({ page }) => {
  await login(page)
  await page.goto(`/projetos/${PROJETO_ID}`)
  await expect(page.getByRole('button', { name: /Lista de tarefas/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Baixar RDOs/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Baixar fotos, vídeos e arquivos/ })).toHaveCount(0)
})

test('projeto concluído baixa todos os RDOs em PDF (rascunho marcado no nome)', async ({ page }) => {
  await login(page)
  await simularStorage(page)
  await page.goto(`/projetos/${PROJETO_CONCLUIDO_ID}`)

  const { nomeArq, zip, entradas } = await baixarZip(page, /Baixar RDOs/)

  expect(nomeArq).toBe('RDOs_Obra-Concluida-E2E.zip')
  expect(entradas).toEqual([
    'RDO_0001_Obra-Concluida-E2E.pdf',
    'RDO_0002_Obra-Concluida-E2E.pdf',
    'RDO_0003_Obra-Concluida-E2E_RASCUNHO.pdf',
  ])
  // Cada arquivo é um PDF de verdade
  for (const nome of entradas) {
    const cabecalho = (await zip.files[nome].async('string')).slice(0, 5)
    expect(cabecalho).toBe('%PDF-')
  }
  await expect(page.getByText('3 RDO(s) baixados em .zip!')).toBeVisible()
})

test('projeto concluído baixa fotos, vídeos e arquivos em pastas por dia, avisando o que falhou', async ({ page }) => {
  await login(page)
  await simularStorage(page)
  await page.goto(`/projetos/${PROJETO_CONCLUIDO_ID}`)

  const { nomeArq, zip, entradas } = await baixarZip(page, /Baixar fotos, vídeos e arquivos/)

  expect(nomeArq).toBe('Midias_Obra-Concluida-E2E.zip')
  // Mesmo nome (foto.png) em dois dias — cada um na sua pasta, sem sobrescrever
  expect(entradas).toEqual([
    '2026-08-10/foto.png',
    '2026-08-10/laudo.txt',
    '2026-08-11/foto.png',
    'ARQUIVOS_NAO_BAIXADOS.txt',
  ])
  // O vídeo que deu 404 não entra, mas fica registrado no relatório de falhas
  const relatorio = await zip.files['ARQUIVOS_NAO_BAIXADOS.txt'].async('string')
  expect(relatorio).toContain('quebrado.mp4')
  expect(relatorio).toContain('HTTP 404')
  // E o usuário é avisado (não recebe um "sucesso" enganoso)
  await expect(page.getByText(/3 arquivo\(s\) baixados, mas 1 não puderam ser baixados/)).toBeVisible()
})

test('projeto com muitas mídias é dividido em partes .zip (a pasta do dia se repete nas partes)', async ({ page }) => {
  await login(page)
  await simularStorage(page)
  await page.goto(`/projetos/${PROJETO_GRANDE_ID}`)

  // Limite de ~20 bytes por parte (ver playwright.config.ts): as 7 fotos vêm em
  // duas ondas de download (5 + 2) e a primeira já enche a parte 1.
  const baixados: Download[] = []
  page.on('download', d => baixados.push(d))
  await page.getByRole('button', { name: /Baixar fotos, vídeos e arquivos/ }).click()
  await expect.poll(() => baixados.length, { timeout: 60_000 }).toBe(2)

  const partes = await Promise.all(baixados.map(async (d) => {
    const zip = await JSZip.loadAsync(readFileSync(await d.path()))
    return { nome: d.suggestedFilename(), entradas: Object.keys(zip.files).filter(n => !zip.files[n].dir).sort() }
  }))
  partes.sort((a, b) => a.nome.localeCompare(b.nome))

  expect(partes.map(p => p.nome)).toEqual([
    'Midias_Obra-Grande-E2E_parte-01.zip',
    'Midias_Obra-Grande-E2E_parte-02.zip',
  ])
  expect(partes[0].entradas).toEqual(['1', '2', '3', '4', '5'].map(n => `2026-08-20/f${n}.png`))
  expect(partes[1].entradas).toEqual(['6', '7'].map(n => `2026-08-20/f${n}.png`))
  await expect(page.getByText(/Divididos em 2 arquivos .zip/)).toBeVisible()
})
