// src/lib/download-projeto.ts
// Downloads em lote para projetos concluídos — ZIP com todos os RDOs em PDF,
// e ZIP(s) com todas as fotos/vídeos/arquivos organizados em pastas por dia.
//
// Tudo é montado no navegador (o servidor na Vercel tem limite de tempo e de
// tamanho de resposta, então não serve pra esse volume). Por isso:
//   - falha em um item nunca derruba o pacote todo: o item é pulado e listado
//     em ARQUIVOS_NAO_BAIXADOS.txt dentro do próprio ZIP (e o retorno avisa);
//   - o ZIP de mídias é dividido em partes de ~LIMITE_PARTE_BYTES, senão um
//     projeto grande estouraria a memória da aba.

import { api, mensagemErro } from '@/lib/api'
import { gerarPdfRdo } from '@/lib/pdf'
import type { Rdo, ResumoMidiaItem } from '@/lib/types'

// Cada parte do ZIP de mídias fecha assim que passa disso (o último arquivo
// adicionado pode ultrapassar um pouco — vídeos têm até 50MB). Configurável
// por NEXT_PUBLIC_DOWNLOAD_PARTE_MB só pra os testes conseguirem exercitar a
// divisão sem baixar centenas de MB; em produção vale sempre o padrão.
const LIMITE_PARTE_BYTES = Number(process.env.NEXT_PUBLIC_DOWNLOAD_PARTE_MB ?? 500) * 1024 * 1024

export interface ResultadoDownload {
  /** Quantos itens entraram no(s) ZIP(s). */
  baixados: number
  /** Itens que não puderam ser incluídos (nome + motivo). */
  falhas: string[]
  /** Quantos arquivos .zip foram entregues ao navegador. */
  partes: number
}

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
  // Revogar na hora pode cancelar o download em alguns navegadores
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function textoFalhas(titulo: string, falhas: string[]): string {
  return [titulo, '', ...falhas.map(f => `- ${f}`), ''].join('\r\n')
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

// Rascunho / em aprovação / rejeitado entram no pacote, mas com o status no
// nome — num dossiê de encerramento, ninguém deve confundir com RDO aprovado.
function nomePdfNoZip(nomeArq: string, status: string): string {
  if (status === 'APROVADO') return nomeArq
  return nomeArq.replace(/\.pdf$/i, `_${status}.pdf`)
}

// ── Todos os RDOs do projeto, um PDF por RDO, dentro de um .zip ──
export async function baixarTodosRdosPdf(
  projetoId: string,
  projetoNome: string,
  tenantNome: string | undefined,
  onProgresso?: (feito: number, total: number) => void,
): Promise<ResultadoDownload> {
  const { default: JSZip } = await import('jszip')

  const lista = await api.get<{ rdos: { id: string; numero: number }[] }>(
    `/api/app/rdos?projetoId=${projetoId}&por=100000&sortBy=numero&sortDir=asc`,
  )
  if (lista.rdos.length === 0) throw new Error('Nenhum RDO encontrado neste projeto.')

  const zip = new JSZip()
  const falhas: string[] = []
  let baixados = 0
  let feito = 0

  await executarEmLotes(lista.rdos, 3, async (rdo) => {
    try {
      const rdoCompleto = await api.get<Rdo>(`/api/app/rdos/${rdo.id}`)
      const resultado = await gerarPdfRdo(rdoCompleto, tenantNome, { retornarBlob: true })
      if (!resultado) throw new Error('PDF não gerado.')
      zip.file(nomePdfNoZip(resultado.nomeArq, rdoCompleto.status), resultado.blob)
      baixados++
    } catch (err) {
      falhas.push(`RDO #${rdo.numero}: ${mensagemErro(err, 'erro ao gerar o PDF')}`)
    }
    feito++
    onProgresso?.(feito, lista.rdos.length)
  })

  if (baixados === 0) throw new Error('Não foi possível gerar nenhum PDF.')
  if (falhas.length > 0) {
    zip.file('RDOS_NAO_GERADOS.txt', textoFalhas('RDOs que não puderam ser gerados em PDF:', falhas))
  }

  baixarBlob(await zip.generateAsync({ type: 'blob' }), `RDOs_${slugify(projetoNome)}.zip`)
  return { baixados, falhas, partes: 1 }
}

// ── Todas as fotos, vídeos e arquivos do projeto, em pastas por dia (AAAA-MM-DD) ──
export async function baixarMidiasProjeto(
  midias: { fotos: ResumoMidiaItem[]; videos: ResumoMidiaItem[]; anexos: ResumoMidiaItem[] },
  projetoNome: string,
  onProgresso?: (feito: number, total: number) => void,
): Promise<ResultadoDownload> {
  const { default: JSZip } = await import('jszip')

  // Em ordem cronológica, pra cada parte do ZIP cobrir um período contínuo
  const todas = [...midias.fotos, ...midias.videos, ...midias.anexos].sort(
    (a, b) => a.rdoData.localeCompare(b.rdoData) || a.rdoNumero - b.rdoNumero,
  )
  if (todas.length === 0) throw new Error('Nenhuma foto, vídeo ou arquivo encontrado neste projeto.')

  const base = slugify(projetoNome)
  const falhas: string[] = []
  let baixados = 0
  let feito = 0
  let partes = 0

  let zip = new JSZip()
  let bytesNaParte = 0
  let itensNaParte = 0
  const usos = new Map<string, number>() // "pasta/arquivo" -> quantas vezes já usado nessa parte

  function caminhoUnico(pasta: string, nomeArq: string): string {
    const chave = `${pasta}/${nomeArq}`
    const n = usos.get(chave) ?? 0
    usos.set(chave, n + 1)
    if (n === 0) return chave
    const ponto = nomeArq.lastIndexOf('.')
    const nome = ponto > 0 ? nomeArq.slice(0, ponto) : nomeArq
    const ext = ponto > 0 ? nomeArq.slice(ponto) : ''
    return `${pasta}/${nome} (${n})${ext}`
  }

  async function fecharParte(ultima: boolean) {
    if (itensNaParte === 0 && !(ultima && falhas.length > 0)) return
    if (ultima && falhas.length > 0) {
      zip.file('ARQUIVOS_NAO_BAIXADOS.txt', textoFalhas('Arquivos que não puderam ser baixados:', falhas))
    }
    partes++
    // Sem sufixo quando tudo coube em uma parte só
    const sufixo = ultima && partes === 1 ? '' : `_parte-${String(partes).padStart(2, '0')}`
    baixarBlob(await zip.generateAsync({ type: 'blob' }), `Midias_${base}${sufixo}.zip`)
    zip = new JSZip()
    bytesNaParte = 0
    itensNaParte = 0
    usos.clear()
  }

  // Em ondas: baixa N em paralelo, e só entre uma onda e outra decide se a
  // parte atual já está cheia (com um pool contínuo, fechar a parte no meio
  // do voo deixaria arquivos "órfãos" sem lugar).
  const TAMANHO_ONDA = 5
  for (let i = 0; i < todas.length; i += TAMANHO_ONDA) {
    const onda = todas.slice(i, i + TAMANHO_ONDA)
    await executarEmLotes(onda, TAMANHO_ONDA, async (item) => {
      try {
        const res = await fetch(item.url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        zip.file(caminhoUnico(item.rdoData.slice(0, 10), item.nomeArq), blob)
        bytesNaParte += blob.size
        itensNaParte++
        baixados++
      } catch (err) {
        falhas.push(`${item.rdoData.slice(0, 10)}/${item.nomeArq} (RDO #${item.rdoNumero}): ${mensagemErro(err, 'falha de rede')}`)
      }
      feito++
      onProgresso?.(feito, todas.length)
    })
    const haMais = i + TAMANHO_ONDA < todas.length
    if (haMais && bytesNaParte >= LIMITE_PARTE_BYTES) await fecharParte(false)
  }

  if (baixados === 0) throw new Error('Não foi possível baixar nenhum arquivo. Verifique sua conexão e tente novamente.')
  await fecharParte(true)
  return { baixados, falhas, partes }
}
