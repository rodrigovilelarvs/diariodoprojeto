// src/lib/download-projeto.ts
// Downloads em lote para projetos concluídos — ZIP com todos os RDOs em PDF,
// e ZIP com todas as fotos/vídeos/arquivos organizados em pastas por dia.

import { api } from '@/lib/api'
import { gerarPdfRdo } from '@/lib/pdf'
import type { Rdo, ResumoMidiaItem } from '@/lib/types'

function slugify(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'projeto'
  )
}

function baixarBlob(blob: Blob, nomeArq: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArq
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Processa a lista com até `limite` itens em paralelo por vez.
async function executarEmLotes<T>(itens: T[], limite: number, onItem: (item: T) => Promise<void>) {
  let cursor = 0
  async function worker() {
    while (cursor < itens.length) {
      const item = itens[cursor++]
      await onItem(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker))
}

// ── Todos os RDOs do projeto, um PDF por RDO, dentro de um .zip ──
export async function baixarTodosRdosPdf(
  projetoId: string,
  projetoNome: string,
  tenantNome: string | undefined,
  onProgresso?: (feito: number, total: number) => void,
): Promise<void> {
  const { default: JSZip } = await import('jszip')

  const lista = await api.get<{ rdos: { id: string }[] }>(
    `/api/app/rdos?projetoId=${projetoId}&por=100000&sortBy=numero&sortDir=asc`,
  )
  const rdoIds = lista.rdos.map(r => r.id)
  if (rdoIds.length === 0) throw new Error('Nenhum RDO encontrado neste projeto.')

  const zip = new JSZip()
  let feito = 0
  await executarEmLotes(rdoIds, 3, async (rdoId) => {
    const rdoCompleto = await api.get<Rdo>(`/api/app/rdos/${rdoId}`)
    const resultado = await gerarPdfRdo(rdoCompleto, tenantNome, { retornarBlob: true })
    if (resultado) zip.file(resultado.nomeArq, resultado.blob)
    feito++
    onProgresso?.(feito, rdoIds.length)
  })

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  baixarBlob(zipBlob, `RDOs_${slugify(projetoNome)}.zip`)
}

// ── Todas as fotos, vídeos e arquivos do projeto, em pastas por dia (AAAA-MM-DD) ──
export async function baixarMidiasProjeto(
  midias: { fotos: ResumoMidiaItem[]; videos: ResumoMidiaItem[]; anexos: ResumoMidiaItem[] },
  projetoNome: string,
  onProgresso?: (feito: number, total: number) => void,
): Promise<void> {
  const { default: JSZip } = await import('jszip')

  const todas = [...midias.fotos, ...midias.videos, ...midias.anexos]
  if (todas.length === 0) throw new Error('Nenhuma foto, vídeo ou arquivo encontrado neste projeto.')

  const zip = new JSZip()
  const usos = new Map<string, number>() // "pasta/arquivo" -> quantas vezes já usado nesse zip

  function caminhoUnico(pasta: string, nomeArq: string): string {
    const chave = `${pasta}/${nomeArq}`
    const n = usos.get(chave) ?? 0
    usos.set(chave, n + 1)
    if (n === 0) return chave
    const ponto = nomeArq.lastIndexOf('.')
    const base = ponto > 0 ? nomeArq.slice(0, ponto) : nomeArq
    const ext = ponto > 0 ? nomeArq.slice(ponto) : ''
    return `${pasta}/${base} (${n})${ext}`
  }

  let feito = 0
  await executarEmLotes(todas, 5, async (item) => {
    try {
      const res = await fetch(item.url)
      if (res.ok) {
        const blob = await res.blob()
        zip.file(caminhoUnico(item.rdoData.slice(0, 10), item.nomeArq), blob)
      }
    } catch {
      // arquivo indisponível — segue para os demais em vez de abortar o zip inteiro
    }
    feito++
    onProgresso?.(feito, todas.length)
  })

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  baixarBlob(zipBlob, `Midias_${slugify(projetoNome)}.zip`)
}
