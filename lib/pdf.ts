// lib/pdf.ts
// Geração de PDF do RDO direto no browser via jsPDF
// Chamado no botão "Gerar PDF" do FormularioRdo e da AprovacaoPage
//
// O PDF sempre cabe em 1 página: o conteúdo é "medido" numa passada
// descartável (mesmo doc/mesma lógica, sem desenhar nem buscar imagens) pra
// saber quanto espaço precisaria numa página infinita; a partir disso calcula
// uma escala (fontes + espaçamentos verticais) que faz tudo caber na altura
// real da página, com um piso mínimo pra nunca ficar ilegível — se mesmo no
// piso não couber (RDO com quantidade extrema de conteúdo), aí sim permite
// 2ª página em vez de cortar/sobrepor conteúdo.

import type { Rdo, RelatorioResponse } from '@/lib/types'
import { numeroRdo, fmtData } from '@/lib/format'
import { CLIMA_L, calcHH, calcOcDur, calcPrazo, CATEGORIA_L } from '@/lib/rdo-display'

// Cores do design system — paleta clara, pensada pra um documento impresso/
// exportado (não uma tela escura): fundo branco/quase-branco, cartões em
// cinza muito claro, e cor só onde carrega significado — segue a convenção
// usual de relatórios técnicos e sinalização (ISO 3864 / semáforo):
//   azul   → identidade/institucional, informação neutra
//   verde  → aprovado / positivo / dentro do esperado
//   âmbar  → atenção / pendente / parcial
//   vermelho → rejeitado / crítico — só onde exige mesmo atenção
//   cinza  → neutro/estrutural (texto secundário, bordas, trilhos)
// Fundos escuros foram removidos de propósito: em papel/impressão eles
// gastam mais tinta, perdem contraste sob luz direta e destoam do padrão
// de laudos e diários de obra, que são tradicionalmente claros.
const COR = {
  s0:   [244, 248, 251] as [number,number,number],  // faixa do cabeçalho/rodapé — quase-branco
  s1:   [241, 245, 249] as [number,number,number],  // fundo dos cartões (seções, atividades, comentários...)
  s2:   [231, 236, 243] as [number,number,number],  // fundo alternado (linhas de tabela, moldura de foto)
  ta:   [17,  110, 138] as [number,number,number],  // azul institucional — legível em texto sobre branco
  tsu:  [39,  128, 86]  as [number,number,number],  // verde — aprovado/positivo
  tw:   [163, 110, 8]   as [number,number,number],  // âmbar — pendente/atenção
  td:   [178, 44,  44]  as [number,number,number],  // vermelho — rejeitado/crítico
  tpu:  [142, 36,  170] as [number,number,number],  // roxo — só usado nos gráficos de relatórios (mão de obra indireta)
  tp:   [28,  38,  51]  as [number,number,number],  // texto principal (títulos, nomes) — grafite escuro
  ts:   [100, 112, 130] as [number,number,number],  // texto secundário — cinza-ardósia, legível sobre claro
  brd:  [214, 221, 231] as [number,number,number],  // linha/borda sutil
  // texto legível sobre o fundo branco da página (fora dos cartões)
  txt:  [28,  32,  42]  as [number,number,number],
  // trilho (parte vazia) das barras de progresso — um cinza visível sobre
  // o cartão claro, sem chegar a escuro
  trk:  [216, 222, 232] as [number,number,number],
  // separador de células das tabelas — branco puro, usado só como respiro
  // fino entre blocos de coluna sobre o fundo levemente acinzentado da tabela
  white: [255, 255, 255] as [number,number,number],
  // texto sobre o chip colorido do número de seção (permanece claro mesmo
  // com o resto da paleta virando clara, porque o chip em si é colorido)
  onAccent: [255, 255, 255] as [number,number,number],
}

const STATUS_L: Record<string,string> = {
  RASCUNHO:'Rascunho', PENDENTE_APROVACAO:'Pendente aprovação',
  APROVADO:'Aprovado', REJEITADO:'Revisar',
}

// Converte a URL em data URI já cortada pra preencher a caixa alvo sem
// distorcer — mesmo efeito do `object-fit: cover` usado na grade de mídias
// do preenchimento do RDO (styles/globals.css .midia-thumb img). O jsPDF não
// tem um "cover" nativo: addImage sempre estica pro w/h dado, então aqui a
// gente pré-recorta num canvas do próprio tamanho/proporção da caixa antes
// de embutir — assim o addImage final é 1:1 com a caixa e não distorce nada.
// Usado tanto pras fotos quanto pra assinatura (cuja caixa muda de proporção
// conforme a escala de compactação da página).
async function toCoverDataUri(url: string, aspectoAlvo: number): Promise<{ dataUri: string; format: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload  = () => resolve(el)
        el.onerror = () => reject(new Error('Falha ao carregar imagem.'))
        el.src = objUrl
      })

      const srcAspecto = img.naturalWidth / img.naturalHeight
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
      if (srcAspecto > aspectoAlvo) {
        // imagem mais larga que a caixa — corta as laterais
        sw = img.naturalHeight * aspectoAlvo
        sx = (img.naturalWidth - sw) / 2
      } else {
        // imagem mais alta que a caixa — corta topo/base
        sh = img.naturalWidth / aspectoAlvo
        sy = (img.naturalHeight - sh) / 2
      }

      const canvas = document.createElement('canvas')
      // resolução de saída fixa (independe do tamanho da foto original)
      canvas.width  = 480
      canvas.height = Math.round(480 / aspectoAlvo)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      // Preenche de branco antes de desenhar — JPEG não tem canal alfa, então
      // a área transparente de uma assinatura (PNG com fundo transparente)
      // vira preto sólido se o canvas ficar com o fundo padrão (transparente).
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      return { dataUri: canvas.toDataURL('image/jpeg', 0.85), format: 'JPEG' }
    } finally {
      URL.revokeObjectURL(objUrl)
    }
  } catch {
    return null
  }
}

// Mesma ideia do toCoverDataUri, mas com efeito "object-fit: contain" — a
// imagem inteira sempre aparece, redimensionada pra caber dentro da caixa
// (sobra espaço em branco na sobra do menor eixo em vez de cortar). Usado só
// pra assinatura: "cover" cortava as pontas do traço quando a proporção do
// desenho capturado não batia com a da caixa (mais achatada com a página
// compactada) — pra assinatura, perder um pedaço do traço é pior do que
// sobrar uma margem branca, então aqui nunca corta nada.
async function toContainDataUri(url: string, aspectoAlvo: number): Promise<{ dataUri: string; format: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload  = () => resolve(el)
        el.onerror = () => reject(new Error('Falha ao carregar imagem.'))
        el.src = objUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width  = 480
      canvas.height = Math.round(480 / aspectoAlvo)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const escalaImg = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
      const dw = img.naturalWidth * escalaImg
      const dh = img.naturalHeight * escalaImg
      const dx = (canvas.width - dw) / 2
      const dy = (canvas.height - dh) / 2
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh)

      return { dataUri: canvas.toDataURL('image/jpeg', 0.85), format: 'JPEG' }
    } finally {
      URL.revokeObjectURL(objUrl)
    }
  } catch {
    return null
  }
}

// Piso de escala — abaixo disso o texto fica ilegível, então preferimos
// deixar sobrar pra 2ª página a comprimir além desse ponto.
const ESCALA_MIN = 0.65

export async function gerarPdfRdo(
  rdo: Rdo,
  empresaNome?: string,
  opcoes?: { retornarBlob?: boolean },
): Promise<{ blob: Blob; nomeArq: string } | void> {
  // Import dinâmico — evita SSR
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const W = 210  // largura A4
  const M = 12   // margem
  const CW = W - M * 2  // largura do conteúdo — nunca é escalada; só altura/fonte compactam
  const PAGE_BREAK_Y = 286  // abaixo disso, quebra de página (rodapé começa em 290)
  const HEADER_H = 19

  // Dados pré-computados — não dependem do doc, calculados uma vez só
  const regs    = rdo.atividadeRegistros ?? []
  const totalHH = (rdo.maoDeObra ?? []).reduce((s:number,m)=>s+Number(m.totalHH),0)
  const prazo   = calcPrazo(rdo.projeto.dataInicioContrato, rdo.projeto.dataFimContrato, rdo.data)
  const midias    = rdo.midias ?? []
  const fotos     = midias.filter((m) => m.tipo === 'FOTO')
  const videos    = midias.filter((m) => m.tipo === 'VIDEO')
  const arquivos  = midias.filter((m) => m.tipo === 'ARQUIVO')
  const comentarios = rdo.comentarios ?? []
  const assinaturas = rdo.assinaturas ?? []
  const categoriasMO = ['INDIRETA','DIRETA','TERCEIRIZADO'] as const
  const subtotaisMO = categoriasMO
    .map(cat => {
      const linhas = (rdo.maoDeObra ?? []).filter((m) => (m.categoria ?? 'DIRETA') === cat)
      return {
        cat,
        pessoas: linhas.reduce((s:number,m)=>s+Number(m.quantidade),0),
        hh:      linhas.reduce((s:number,m)=>s+Number(m.totalHH),0),
      }
    })
    .filter(s => s.pessoas > 0)
  let badgeMO = ''
  if (subtotaisMO.length > 0) {
    badgeMO = subtotaisMO.map(s => `${CATEGORIA_L[s.cat]}: ${s.pessoas}p · ${s.hh}H/H`).join('  |  ') + '  |  '
  }
  badgeMO += `Total: ${totalHH} H/H`

  // ── Desenha (ou só mede) todo o conteúdo do RDO ──────────────────────
  // `medindo=true`: não desenha nada de verdade nem busca imagem — só corre
  // a mesma lógica de layout pra saber quanto `y` cresceria numa página
  // infinita, na escala 1 (tamanho normal). O resultado dessa medição decide
  // a escala usada na passada real.
  async function desenharConteudo(doc: any, escala: number, medindo: boolean): Promise<number> {
    let y = 0
    const E = (n: number) => n * escala

    function rect(x:number, yy:number, w:number, h:number, fill:[number,number,number], r=0) {
      if (medindo) return
      doc.setFillColor(...fill)
      if (r > 0) doc.roundedRect(x, yy, w, h, r, r, 'F')
      else       doc.rect(x, yy, w, h, 'F')
    }

    function txt(
      texto:string, x:number, yy:number,
      { size=9, bold=false, cor=COR.txt, align='left' as 'left'|'center'|'right'|'justify' } = {}
    ) {
      // O tamanho da fonte precisa ficar setado mesmo medindo — é dele que
      // depende o splitTextToSize() usado logo depois pra saber quantas
      // linhas um texto vai ocupar nesta escala.
      doc.setFontSize(size * escala)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      if (medindo) return
      doc.setTextColor(...cor)
      doc.text(texto, x, yy, { align })
    }

    // Cabeçalho de seção compacto: barra fina + numeração + título — `badge`
    // (opcional) mostra uma quantidade-resumo à direita, igual à tela do RDO
    function secHeader(titulo:string, num:string, badge?: string, badgeCor: [number,number,number] = COR.ts) {
      y += E(1)
      const h = E(4.2)
      rect(M, y, CW, h, COR.s1, 1.2)
      rect(M, y, h, h, COR.ta, 1.2)
      txt(num, M+h/2, y+h/2+E(0.9), { size:6, bold:true, cor:COR.onAccent, align:'center' })
      txt(titulo, M+h+E(2.5), y+h/2+E(0.9), { size:7, bold:true, cor:COR.tp })
      if (badge) {
        txt(badge, M+CW-E(3), y+h/2+E(0.9), { size:6.5, bold:true, cor:badgeCor, align:'right' })
      }
      y += h + E(1.3)
    }

    function vazio(msg: string) {
      txt(msg, M, y+E(2.8), { size:7, cor:COR.ts })
      y += E(6)
    }

    // Encurta um valor de célula do infoGrid pra sempre caber numa linha só —
    // usado em campos que podem vir com texto longo (ex.: razão social de
    // empresa contratada) pra não fazer a linha do grid crescer com a quebra
    // pra 2/3 linhas (o objetivo é o campo caber dentro da área já reservada
    // pela seção, sem aumentá-la).
    function truncarCelula(texto: string, larguraMax: number, tamanhoFonte: number): string {
      // Salva e restaura a fonte/tamanho ativos do doc — sem isso, o estado
      // fica "vazando" pra frente e desalinha a medição de largura (via
      // splitTextToSize) das próximas seções desenhadas depois desta.
      const fonteAnterior = doc.getFont()
      const tamanhoAnterior = doc.internal.getFontSize()
      doc.setFontSize(tamanhoFonte)
      doc.setFont('helvetica', 'bold')
      let resultado = texto
      if (doc.getTextWidth(texto) > larguraMax) {
        let t = texto
        while (t.length > 0 && doc.getTextWidth(t + '…') > larguraMax) t = t.slice(0, -1)
        resultado = t.trimEnd() + '…'
      }
      doc.setFont(fonteAnterior.fontName, fonteAnterior.fontStyle)
      doc.setFontSize(tamanhoAnterior)
      return resultado
    }

    // Quebra o valor em quantas linhas forem necessárias para caber na coluna
    // (até 3 linhas) — evita que um texto longo (nome de projeto, contrato etc.)
    // invada a coluna vizinha ou saia da página. A altura da linha se ajusta
    // por linha do grid, não por item, para manter todo o grid alinhado.
    function infoGrid(items: Array<{label:string; valor:string}>, colsOuLarguras: number | number[] = 3) {
      // Aceita um número de colunas (largura igual, comportamento original)
      // ou um array de larguras em mm (colunas desiguais — usado na
      // Identificação pra dar mais espaço pra coluna com nome de projeto).
      const larguras = Array.isArray(colsOuLarguras) ? colsOuLarguras : Array(colsOuLarguras).fill(CW / colsOuLarguras)
      const cols   = larguras.length
      const colX: number[] = []
      larguras.reduce((acc, w, i) => { colX[i] = acc; return acc + w }, 0)
      const baseH  = E(5.2)
      const lineH  = E(3.3)
      const padR   = 3
      const rows   = Math.ceil(items.length / cols)
      doc.setFontSize(7 * escala)
      const wrapped = items.map((it, i) => doc.splitTextToSize(String(it.valor ?? '—'), larguras[i % cols] - padR).slice(0, 3))

      const rowH: number[] = []
      for (let r = 0; r < rows; r++) {
        let maxLines = 1
        for (let c = 0; c < cols; c++) {
          const idx = r*cols + c
          if (idx < items.length) maxLines = Math.max(maxLines, wrapped[idx].length)
        }
        rowH.push(baseH + (maxLines - 1) * lineH)
      }

      items.forEach((it, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x   = M + colX[col]
        const yy  = y + rowH.slice(0, row).reduce((a,b) => a+b, 0)
        txt(it.label, x, yy+E(2), { size:6, cor:COR.ts })
        wrapped[i].forEach((linha:string, li:number) => {
          txt(linha, x, yy+E(4.7)+li*lineH, { size:7, bold:true, cor:COR.txt })
        })
      })

      y += rowH.reduce((a,b) => a+b, 0) + E(1)
    }

    function novaPaginaSeNecessario(precisaH: number) {
      // Medindo: deixa crescer como se a página fosse infinita — é isso que
      // dá a altura total real pra calcular a escala depois.
      if (medindo) return
      if (y + precisaH > PAGE_BREAK_Y) {
        doc.addPage()
        // Mini header na nova página
        rect(0, 0, W, 7, COR.s0)
        doc.setDrawColor(...COR.brd)
        doc.setLineWidth(0.3)
        doc.line(0, 7, W, 7)
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        let miniTexto = `Diário do Projeto · RDO #${numeroRdo(rdo.numero)} · ${rdo.projeto.nome}`
        if (doc.getTextWidth(miniTexto) > CW) {
          while (miniTexto.length > 0 && doc.getTextWidth(miniTexto + '…') > CW) {
            miniTexto = miniTexto.slice(0, -1)
          }
          miniTexto = miniTexto.trimEnd() + '…'
        }
        txt(miniTexto, W/2, 4.8, { size:6.5, cor:COR.ts, align:'center' })
        y = 11
      }
    }

    // ════════════════════════════════════════════════════
    // CAPA / HEADER
    // ════════════════════════════════════════════════════
    const headerH = E(HEADER_H)
    rect(0, 0, W, headerH, COR.s0)
    rect(0, 0, 3, headerH, COR.ta)      // marca lateral
    if (!medindo) {
      doc.setDrawColor(...COR.brd)
      doc.setLineWidth(0.3)
      doc.line(0, headerH, W, headerH)  // linha fina fechando o cabeçalho — sem faixa escura
    }

    txt('DIÁRIO DO PROJETO', M+2, E(7), { size:6.5, bold:true, cor:COR.ta })
    txt('Registro Diário de Obra', W/2, E(7), { size:8.5, bold:true, cor:COR.ts, align:'center' })
    txt(empresaNome?.trim() || 'Registro Diário de Obra', M+2, E(14.5), { size:12, bold:true, cor:COR.tp })

    const stCor = rdo.status==='APROVADO' ? COR.tsu : rdo.status==='PENDENTE_APROVACAO' ? COR.tw : rdo.status==='REJEITADO' ? COR.td : COR.ts
    txt(`RDO #${numeroRdo(rdo.numero)}`, W-M, E(9.5), { size:14, bold:true, cor:COR.ta, align:'right' })
    txt(STATUS_L[rdo.status] ?? rdo.status, W-M, E(15), { size:7.5, cor:stCor, align:'right' })

    y = headerH + E(3)

    // ════════════════════════════════════════════════════
    // SEC 1 — IDENTIFICAÇÃO
    // ════════════════════════════════════════════════════
    secHeader('Identificação', '1')

    // Colunas desiguais na Identificação — a 1ª e 2ª mais estreitas e
    // "coladas" à esquerda (valores curtos: número, data, gestor, prazo...),
    // sobrando praticamente o dobro de largura pra 3ª coluna, onde entra o
    // Projeto (nome que costuma ser o mais comprido do formulário).
    const larguraColsId = [CW*0.25, CW*0.25, CW*0.5]
    const larguraEstreitaId = larguraColsId[0] - 3
    const larguraLargaId    = larguraColsId[2] - 3

    infoGrid([
      { label:'Nº do RDO',              valor:`#${numeroRdo(rdo.numero)}` },
      { label:'Data do registro',       valor:fmtData(rdo.data) },
      { label:'Projeto',                valor:truncarCelula(rdo.projeto.nome, larguraLargaId, 7*escala) },
      ...(rdo.projeto.pedidoCompraContrato ? [{ label:'Pedido de compra ou contrato', valor:rdo.projeto.pedidoCompraContrato }] : []),
      ...(rdo.projeto.empresaContratada ? [{ label:'Empresa contratada', valor:truncarCelula(rdo.projeto.empresaContratada, larguraEstreitaId, 7*escala) }] : []),
      { label:'Gestor do Projeto',      valor:rdo.projeto.gestor?.nome ?? 'Sem gestor' },
      ...(prazo ? [
        { label:'Prazo contratual', valor:`${prazo.inicio} a ${prazo.fim}` },
        { label:'Decorridos',       valor:`${prazo.decorridos}d (${prazo.pctDecorrido}%)` },
        { label:'Restantes',        valor:`${prazo.restantes}d` },
      ] : []),
    ], larguraColsId)

    // ════════════════════════════════════════════════════
    // SEC 2 — CLIMA
    // ════════════════════════════════════════════════════
    secHeader('Condições climáticas', '2')

    infoGrid([
      { label:'Manhã',          valor:CLIMA_L[rdo.climaManha??''] ?? '—' },
      { label:'Tarde',          valor:CLIMA_L[rdo.climaTarde??''] ?? '—' },
      ...(rdo.climaNoite ? [{ label:'Noite', valor:CLIMA_L[rdo.climaNoite] ?? '—' }] : []),
      { label:'Precipitação',   valor:rdo.precipitacaoMm ? `${rdo.precipitacaoMm}mm` : '0mm' },
      { label:'Impacto',        valor:rdo.climaImpacto === 'NENHUM' ? 'Nenhum' : rdo.climaImpacto === 'PARCIAL' ? 'Parcial' : rdo.climaImpacto === 'TOTAL' ? 'Total — paralisado' : (rdo.climaImpacto ?? 'Nenhum') },
    ], 4)

    // ════════════════════════════════════════════════════
    // SEC 3 — ATIVIDADES E PROGRESSO
    // ════════════════════════════════════════════════════
    novaPaginaSeNecessario(E(20))
    secHeader('Atividade, horários e progresso', '3',
      regs.length > 0 ? `${regs.length} atividade${regs.length !== 1 ? 's' : ''}` : undefined)

    infoGrid([
      { label:'Início',           valor:rdo.horaInicio ?? '—' },
      { label:'Término',          valor:rdo.horaTermino ?? '—' },
      { label:'Intervalo (h)',    valor:String(rdo.intervaloHoras ?? 0) },
      { label:'Total trabalhado', valor:calcHH(rdo.horaInicio ?? '', rdo.horaTermino ?? '', Number(rdo.intervaloHoras ?? 0)) },
    ], 4)

    if (regs.length === 0) {
      vazio('Nenhuma atividade registrada.')
    } else {
      regs.forEach((r) => {
        const ativ  = r.atividade
        const etapaLabel = r.avulsa ? (r.avulsaEtapa ?? 'Avulsa') : (ativ?.etapa ? `${ativ.etapa.numero} · ${ativ.etapa.nome}` : '')
        const nome  = r.avulsa ? (r.avulsaNome ?? '') : (ativ ? `${ativ.numero} · ${ativ.nome}` : '—')
        const pct   = r.pctAtual
        const corPb = pct>=90 ? COR.tsu : pct>=60 ? COR.ta : pct>0 ? COR.tw : COR.ts

        novaPaginaSeNecessario(E(11))

        // Cartão compacto de 2 linhas — etapa em cima (pequena), atividade embaixo
        // (mesma ordem usada na tela do RDO), com respiro entre a barra e o texto
        // "Anterior" logo abaixo dela.
        rect(M, y, CW, E(9), COR.s1, 1.2)

        const nomeMax = CW*0.44
        doc.setFontSize(5.5 * escala)
        if (etapaLabel) {
          const etapaLines = doc.splitTextToSize(etapaLabel, nomeMax)
          txt(etapaLines[0], M+2.5, y+E(2.6), { size:5.5, cor:COR.ts })
        }
        doc.setFontSize(7 * escala)
        const nomeLines = doc.splitTextToSize(nome, nomeMax)
        txt(nomeLines[0], M+2.5, y+E(6), { size:7, bold:true, cor:COR.ta })

        const barX = M + CW*0.5, barW = CW*0.26, barH = E(2.6)
        rect(barX, y+E(2.4), barW, barH, COR.trk, 0.8)
        if (pct > 0) rect(barX, y+E(2.4), barW * (pct/100), barH, corPb, 0.8)
        txt(`${pct}%`, W-M-2.5, y+E(4.5), { size:8.5, bold:true, cor:corPb, align:'right' })

        const delta = r.deltaHoje
        txt(`Anterior: ${r.pctAnterior}%`, barX, y+E(7.7), { size:5.5, cor:COR.ts })
        txt(`${delta>=0?'+':''}${delta}% hoje`, W-M-2.5, y+E(7.7), { size:5.5, cor:delta>0?COR.tsu:COR.ts, align:'right' })

        y += E(10.5)
      })
    }

    // Observações — sempre mostrado, mesmo vazio
    novaPaginaSeNecessario(E(10))
    txt('Observações', M, y+E(2), { size:6, bold:true, cor:COR.ts })
    y += E(3.4)
    rect(M, y, CW, E(0.3), COR.brd)
    y += E(1.8)
    if (rdo.observacoes) {
      doc.setFontSize(7 * escala)
      const obs = doc.splitTextToSize(rdo.observacoes, CW)
      obs.forEach((l:string) => {
        txt(l, M, y, { size:7, cor:COR.txt })
        y += E(3.3)
      })
      y += E(1.2)
    } else {
      txt('Nenhuma observação registrada.', M, y+E(1), { size:7, cor:COR.ts })
      y += E(4.3)
    }

    // ════════════════════════════════════════════════════
    // SEC 4 — MÃO DE OBRA
    // ════════════════════════════════════════════════════
    novaPaginaSeNecessario(E(24))
    secHeader('Mão de obra', '4', badgeMO, COR.ts)

    if ((rdo.maoDeObra?.length ?? 0) === 0) {
      vazio('Nenhuma mão de obra registrada.')
    } else {
      // Tabela com 2 funções por linha (cada função ocupa um bloco de 5 colunas)
      const maoDeObraArr = rdo.maoDeObra ?? []
      const bodyMO: string[][] = []
      for (let i = 0; i < maoDeObraArr.length; i += 2) {
        const a = maoDeObraArr[i], b = maoDeObraArr[i+1]
        bodyMO.push([
          a.funcaoNome ?? '—', CATEGORIA_L[a.categoria as keyof typeof CATEGORIA_L] ?? '—',
          `${a.quantidade}`, `${a.horaEntrada}-${a.horaSaida}`, `${a.totalHH}`,
          b ? (b.funcaoNome ?? '—') : '',
          b ? (CATEGORIA_L[b.categoria as keyof typeof CATEGORIA_L] ?? '—') : '',
          b ? `${b.quantidade}` : '',
          b ? `${b.horaEntrada}-${b.horaSaida}` : '',
          b ? `${b.totalHH}` : '',
        ])
      }

      if (medindo) {
        // autoTable não tem modo "só medir" — roda de verdade no doc
        // descartável (é jogado fora depois) só pra saber a altura real.
        autoTable(doc, {
          startY: y,
          margin: { left:M, right:M },
          head: [['Função','Tipo','Qtd.','Horário','H/H','Função','Tipo','Qtd.','Horário','H/H']],
          body: bodyMO,
          styles: { fontSize:6.5*escala, cellPadding:0.8*escala },
          columnStyles: {
            0: { cellWidth:31 }, 1: { cellWidth:16 }, 2: { cellWidth:10 }, 3: { cellWidth:22 }, 4: { cellWidth:14 },
            5: { cellWidth:31 }, 6: { cellWidth:16 }, 7: { cellWidth:10 }, 8: { cellWidth:22 }, 9: { cellWidth:14 },
          },
        })
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left:M, right:M },
          head: [['Função','Tipo','Qtd.','Horário','H/H','Função','Tipo','Qtd.','Horário','H/H']],
          body: bodyMO,
          styles: {
            fontSize:6.5*escala, cellPadding:0.8*escala,
            fillColor:COR.s2, textColor:COR.tp, lineColor:COR.brd, lineWidth:0.2,
          },
          headStyles: { fillColor:COR.s1, textColor:COR.ta, fontStyle:'bold' },
          alternateRowStyles: { fillColor:COR.s1 },
          columnStyles: {
            0: { cellWidth:31 }, 1: { cellWidth:16, halign:'center' }, 2: { cellWidth:10, halign:'center' }, 3: { cellWidth:22, halign:'center' }, 4: { cellWidth:14, halign:'center', fontStyle:'bold', textColor:COR.ta },
            5: { cellWidth:31 }, 6: { cellWidth:16, halign:'center' }, 7: { cellWidth:10, halign:'center' }, 8: { cellWidth:22, halign:'center' }, 9: { cellWidth:14, halign:'center', fontStyle:'bold', textColor:COR.ta },
          },
          // Separador mais grosso e em branco só entre os dois blocos de função
          // (não em todas as colunas)
          didDrawCell: (data: any) => {
            if (data.column.index === 4) {
              doc.setDrawColor(...COR.white)
              doc.setLineWidth(0.8)
              const xLinha = data.cell.x + data.cell.width
              doc.line(xLinha, data.cell.y, xLinha, data.cell.y + data.cell.height)
            }
          },
        })
      }
      y = (doc as any).lastAutoTable.finalY + E(2.5)
    }

    // ════════════════════════════════════════════════════
    // SEC 5 — EQUIPAMENTOS
    // ════════════════════════════════════════════════════
    const totalEquip = rdo.equipamentos?.length ?? 0
    novaPaginaSeNecessario(E(20))
    secHeader('Equipamentos', '5', totalEquip > 0 ? `${totalEquip} equipamento${totalEquip !== 1 ? 's' : ''}` : undefined)

    if (totalEquip === 0) {
      vazio('Nenhum equipamento registrado.')
    } else {
      // Tabela com 3 equipamentos por linha (cada um ocupa um bloco de 2 colunas,
      // sem coluna de tipo)
      const equipArr = rdo.equipamentos ?? []
      const bodyEq: string[][] = []
      for (let i = 0; i < equipArr.length; i += 3) {
        const [a, b, c] = [equipArr[i], equipArr[i+1], equipArr[i+2]]
        bodyEq.push([
          a.equipamentoNome ?? '—', `${a.quantidade}`,
          b ? (b.equipamentoNome ?? '—') : '', b ? `${b.quantidade}` : '',
          c ? (c.equipamentoNome ?? '—') : '', c ? `${c.quantidade}` : '',
        ])
      }

      if (medindo) {
        autoTable(doc, {
          startY: y,
          margin: { left:M, right:M },
          head: [['Equipamento','Qtd.','Equipamento','Qtd.','Equipamento','Qtd.']],
          body: bodyEq,
          styles: { fontSize:6.5*escala, cellPadding:0.8*escala },
          columnStyles: {
            0: { cellWidth:46 }, 1: { cellWidth:16 },
            2: { cellWidth:46 }, 3: { cellWidth:16 },
            4: { cellWidth:46 }, 5: { cellWidth:16 },
          },
        })
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left:M, right:M },
          head: [['Equipamento','Qtd.','Equipamento','Qtd.','Equipamento','Qtd.']],
          body: bodyEq,
          styles: {
            fontSize:6.5*escala, cellPadding:0.8*escala,
            fillColor:COR.s2, textColor:COR.tp, lineColor:COR.brd, lineWidth:0.2,
          },
          headStyles: { fillColor:COR.s1, textColor:COR.ta, fontStyle:'bold' },
          alternateRowStyles: { fillColor:COR.s1 },
          // Separador mais grosso e em branco só entre os três blocos de equipamento
          // (não em todas as colunas)
          didDrawCell: (data: any) => {
            if (data.column.index === 1 || data.column.index === 3) {
              doc.setDrawColor(...COR.white)
              doc.setLineWidth(0.8)
              const xLinha = data.cell.x + data.cell.width
              doc.line(xLinha, data.cell.y, xLinha, data.cell.y + data.cell.height)
            }
          },
          columnStyles: {
            0: { cellWidth:46 }, 1: { cellWidth:16, halign:'center', fontStyle:'bold', textColor:COR.ta },
            2: { cellWidth:46 }, 3: { cellWidth:16, halign:'center', fontStyle:'bold', textColor:COR.ta },
            4: { cellWidth:46 }, 5: { cellWidth:16, halign:'center', fontStyle:'bold', textColor:COR.ta },
          },
        })
      }
      y = (doc as any).lastAutoTable.finalY + E(2.5)
    }

    // ════════════════════════════════════════════════════
    // SEC 6 — OCORRÊNCIAS
    // ════════════════════════════════════════════════════
    const totalOc = rdo.ocorrencias?.length ?? 0
    novaPaginaSeNecessario(E(18))
    secHeader('Ocorrências', '6', totalOc > 0 ? `${totalOc} ocorrência${totalOc !== 1 ? 's' : ''}` : undefined)

    if (totalOc === 0) {
      vazio('Nenhuma ocorrência registrada.')
    } else {
      ;(rdo.ocorrencias ?? []).forEach((oc, i:number) => {
        novaPaginaSeNecessario(E(9))
        const dur = oc.horaInicio && oc.horaTermino ? calcOcDur(oc.horaInicio, oc.horaTermino) : null

        rect(M, y, CW, E(8), COR.s1, 1.2)

        txt(`#${i+1}`, M+2.5, y+E(3.5), { size:7, bold:true, cor:COR.ta })
        txt(oc.tipo ?? '—', M+9, y+E(3.5), { size:7, bold:true, cor:COR.tp })
        if (dur) txt(dur, W-M-2.5, y+E(3.5), { size:6, cor:COR.ts, align:'right' })

        // Horário e descrição na mesma linha — mede a largura do horário pra
        // emendar a descrição logo em seguida, em vez de pular linha.
        let xDesc = M + 2.5
        if (oc.horaInicio && oc.horaTermino) {
          const horario = `${oc.horaInicio} - ${oc.horaTermino}`
          txt(horario, M+2.5, y+E(6.5), { size:6, cor:COR.ts })
          doc.setFontSize(6 * escala)
          doc.setFont('helvetica', 'normal')
          xDesc = M + 2.5 + doc.getTextWidth(horario) + 2
        }

        doc.setFontSize(6 * escala)
        const descLines = doc.splitTextToSize(oc.descricao ?? '—', M+CW-3 - xDesc)
        txt(descLines[0] ?? '—', xDesc, y+E(6.5), { size:6, cor:COR.tp })

        y += E(9)
      })
    }

    // ════════════════════════════════════════════════════
    // SEC 7 — FOTOS, VÍDEOS E ARQUIVOS
    // ════════════════════════════════════════════════════
    // Só fotos têm miniatura de verdade — vídeo e arquivo não têm o que
    // mostrar visualmente, então entram só como uma citação de quantidade
    // depois da grade (em vez de uma caixa vazia tipo "VÍDEO"/"ARQUIVO").
    novaPaginaSeNecessario(E(20))
    secHeader('Fotos, vídeos e arquivos', '7', midias.length > 0 ? `${midias.length} item${midias.length !== 1 ? 's' : ''}` : undefined)

    if (midias.length === 0) {
      vazio('Nenhum arquivo registrado.')
    } else {
      if (fotos.length === 0) {
        vazio('Nenhuma foto registrada.')
      } else {
        const perRow  = 6
        const gap     = 2
        const thumbW  = (CW - gap*(perRow-1)) / perRow  // largura NÃO escala — usa a página inteira sempre
        const thumbH  = thumbW * 0.5 * escala

        for (let i = 0; i < fotos.length; i += perRow) {
          const linha = fotos.slice(i, i + perRow)
          novaPaginaSeNecessario(thumbH + E(7))

          const aspectoCaixa = (thumbW-0.6) / (thumbH-0.6)
          const dataUris = medindo
            ? linha.map(() => null)
            : await Promise.all(linha.map((m) => toCoverDataUri(m.url, aspectoCaixa)))

          linha.forEach((m, j:number) => {
            const x = M + j*(thumbW+gap)
            // O fundo (COR.s2) por trás da imagem funciona como moldura — o
            // respiro entre ele e a imagem é o que aparece como "borda"; deixamos
            // esse respiro bem fino (0.3mm) em vez do 1mm de antes
            rect(x, y, thumbW, thumbH, COR.s2, 1.2)

            if (dataUris[j]) {
              try {
                doc.addImage(dataUris[j]!.dataUri, dataUris[j]!.format, x+0.3, y+0.3, thumbW-0.6, thumbH-0.6)
              } catch {
                txt('Foto indisponível', x+thumbW/2, y+thumbH/2, { size:5.5, cor:COR.ts, align:'center' })
              }
            } else if (!medindo) {
              txt('Foto indisponível', x+thumbW/2, y+thumbH/2, { size:5.5, cor:COR.ts, align:'center' })
            }

            const legenda = (m.descricao || m.nomeArq || '').trim()
            if (legenda) {
              doc.setFontSize(5.5 * escala)
              const linhaTxt = doc.splitTextToSize(legenda, thumbW-2)
              txt(linhaTxt[0] ?? '', x+thumbW/2, y+thumbH+E(2.8), { size:5.5, cor:COR.ts, align:'center' })
            }
          })

          y += thumbH + E(4.5)
        }
      }

      // Citação de vídeos/arquivos — só a contagem, sem caixa vazia
      if (videos.length > 0 || arquivos.length > 0) {
        const partes: string[] = []
        if (videos.length   > 0) partes.push(`${videos.length} vídeo${videos.length !== 1 ? 's' : ''}`)
        if (arquivos.length > 0) partes.push(`${arquivos.length} arquivo${arquivos.length !== 1 ? 's' : ''}`)
        novaPaginaSeNecessario(E(5))
        txt(`+ ${partes.join(' e ')} anexado${(videos.length+arquivos.length) !== 1 ? 's' : ''} ao RDO.`,
          M, y+E(2), { size:6.5, cor:COR.ts })
        y += E(5)
      }
    }

    // ════════════════════════════════════════════════════
    // SEC 8 — COMENTÁRIOS
    // ════════════════════════════════════════════════════
    novaPaginaSeNecessario(E(18))
    secHeader('Comentários', '8', comentarios.length > 0 ? `${comentarios.length}` : undefined)

    if (comentarios.length === 0) {
      vazio('Nenhum comentário registrado.')
    } else {
      comentarios.forEach((c) => {
        doc.setFontSize(6.5 * escala)
        const linhasTxt = doc.splitTextToSize(c.texto ?? '', CW-5)
        const h = E(5.4) + linhasTxt.length*E(3.5)
        novaPaginaSeNecessario(h+E(2))

        rect(M, y, CW, h, COR.s1, 1.2)
        txt(c.autor?.nome ?? '—', M+2.5, y+E(3.6), { size:7, bold:true, cor:COR.ta })
        txt(new Date(c.criadoEm).toLocaleDateString('pt-BR'), W-M-2.5, y+E(3.6), { size:6, cor:COR.ts, align:'right' })

        let ly = y + E(6.6)
        linhasTxt.forEach((l:string) => {
          txt(l, M+2.5, ly, { size:6.5, cor:COR.tp })
          ly += E(3.5)
        })

        y += h + E(1.6)
      })
    }

    // ════════════════════════════════════════════════════
    // SEC 9 — ASSINATURAS
    // ════════════════════════════════════════════════════
    novaPaginaSeNecessario(E(40))
    secHeader('Assinaturas digitais', '9')

    if (assinaturas.length === 0) {
      vazio('Nenhuma assinatura configurada para este RDO.')
    } else {
      // Largura sempre calculada pra caber 3 colunas (o caso máximo) — não
      // escala (usa a página inteira sempre) — só a altura da caixa
      // compacta. A imagem da assinatura sempre passa pelo ajuste "contain",
      // então nunca distorce nem corta o traço mesmo quando a caixa fica
      // mais achatada com a página compactada ou mais baixa por causa do
      // corte abaixo.
      //
      // Área de desenho reduzida pra ~75% do tamanho anterior — a assinatura
      // não precisa ocupar tanto espaço. O "-5"/"+5" é o respiro fixo ao
      // redor da imagem (não deve encolher, senão o traço vira um risco
      // colado na borda); só a parte "útil" da altura (13mm antes) é que
      // encolhe pra 75%. O cartão todo (sigH) perde a mesma altura que a
      // área de desenho perdeu, mantendo intacto o espaço reservado pro
      // nome/cargo abaixo dela.
      const AREA_H_ANTIGA = 18
      const PADDING_AREA  = 5
      const areaHBase = (AREA_H_ANTIGA - PADDING_AREA) * 0.75 + PADDING_AREA
      const sigHBase  = 30 - (AREA_H_ANTIGA - areaHBase)

      const sigW  = (CW - 2*3) / 3
      const areaH = areaHBase * escala
      const sigH  = sigHBase * escala

      const aspectoSig = (sigW-6) / Math.max(areaH-5, 1)
      const sigDataUris = medindo
        ? assinaturas.slice(0,3).map(() => null)
        : await Promise.all(assinaturas.slice(0,3).map((a) =>
            a.status==='ASSINADO' && a.assinaturaDigital?.imagemUrl
              ? toContainDataUri(a.assinaturaDigital.imagemUrl, aspectoSig)
              : Promise.resolve(null),
          ))

      assinaturas.slice(0,3).forEach((a, i:number) => {
        const x = M + i*(sigW+3)
        const assinado = a.status==='ASSINADO'

        rect(x, y, sigW, sigH, COR.s1, 1.2)

        if (assinado) {
          // Área branca da assinatura
          rect(x+1.5, y+1.5, sigW-3, areaH, [250,250,250], 0.8)
          // Linha base
          if (!medindo) {
            doc.setDrawColor(200,200,200)
            doc.setLineWidth(0.3)
            doc.line(x+3, y+1.5+areaH-2.5, x+sigW-3, y+1.5+areaH-2.5)
          }

          const sigUri = sigDataUris[i]
          if (sigUri) {
            try {
              doc.addImage(sigUri.dataUri, sigUri.format, x+3, y+2.5, sigW-6, areaH-5)
            } catch { /* ignora se imagem falhar */ }
          } else if (!medindo) {
            txt('Assinado', x+sigW/2, y+1.5+areaH/2+1, { size:6.5, bold:true, cor:COR.tsu, align:'center' })
          }

          txt(a.usuario.nome, x+sigW/2, y+1.5+areaH+E(3.6), { size:6, bold:true, cor:COR.tp, align:'center' })
          txt(a.cargo?.replace(/_/g,' ')??'', x+sigW/2, y+1.5+areaH+E(6.1), { size:5, cor:COR.ts, align:'center' })
        } else {
          rect(x+1.5, y+1.5, sigW-3, areaH, COR.s2, 0.8)
          txt('Aguardando', x+sigW/2, y+1.5+areaH/2+1, { size:6, cor:COR.ts, align:'center' })
          txt(a.usuario.nome, x+sigW/2, y+1.5+areaH+E(3.6), { size:6, bold:true, cor:COR.tp, align:'center' })
          txt(a.cargo?.replace(/_/g,' ')??'', x+sigW/2, y+1.5+areaH+E(6.1), { size:5, cor:COR.ts, align:'center' })
        }
      })

      y += sigH + E(1.5)
    }

    // Nota legal — linha simples, sem cartão
    novaPaginaSeNecessario(E(3.5))
    txt('Assinaturas digitais em conformidade com a Lei nº 14.063/2020.',
      M + CW/2, y+E(1.6), { size:6, cor:COR.ts, align:'center' })
    y += E(3.5)

    return y
  }

  // ── Passo 1/2 — mede e ajusta a escala iterativamente até caber ──────
  // A relação entre escala e altura final não é perfeitamente linear (texto
  // pode quebrar em menos/mais linhas, autoTable tem alturas mínimas de
  // célula) — então em vez de confiar numa única conta, remede a cada
  // tentativa na escala candidata e refina, com uma pequena folga a cada
  // volta, até caber (ou até bater no piso de legibilidade).
  let escala = 1
  let alturaTotal = await desenharConteudo(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }), escala, true)
  for (let tentativa = 0; tentativa < 5 && alturaTotal > PAGE_BREAK_Y && escala > ESCALA_MIN; tentativa++) {
    escala = Math.max(ESCALA_MIN, escala * (PAGE_BREAK_Y / alturaTotal) * 0.98)
    // Doc novo a cada tentativa — evita qualquer estado (ex.: paginação
    // interna do autoTable) acumulado entre medições.
    alturaTotal = await desenharConteudo(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }), escala, true)
  }

  // ── Passo 3 — desenha de verdade, já na escala calculada ─────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await desenharConteudo(doc, escala, false)

  // ════════════════════════════════════════════════════
  // RODAPÉ em todas as páginas — tamanho fixo, não escala com o conteúdo
  // ════════════════════════════════════════════════════
  function rect(x:number, yy:number, w:number, h:number, fill:[number,number,number], r=0) {
    doc.setFillColor(...fill)
    if (r > 0) doc.roundedRect(x, yy, w, h, r, r, 'F')
    else       doc.rect(x, yy, w, h, 'F')
  }
  function txt(
    texto:string, x:number, yy:number,
    { size=9, bold=false, cor=COR.txt, align='left' as 'left'|'center'|'right'|'justify' } = {}
  ) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...cor)
    doc.text(texto, x, yy, { align })
  }

  const totalPag = doc.getNumberOfPages()
  const geradoTexto = `Gerado em ${new Date().toLocaleString('pt-BR')}`
  for (let p = 1; p <= totalPag; p++) {
    doc.setPage(p)
    rect(0, 290, W, 10, COR.s0)
    doc.setDrawColor(...COR.brd)
    doc.setLineWidth(0.3)
    doc.line(0, 290, W, 290)

    const pagTexto = `Página ${p} / ${totalPag}`
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    const geradoW = doc.getTextWidth(geradoTexto)
    const pagW    = doc.getTextWidth(pagTexto)

    // O texto da esquerda (com nome do projeto, que pode ser bem longo) não
    // pode invadir o texto central nem o da direita — encurta com reticências
    // até caber no espaço disponível antes de qualquer um dos dois.
    const maxLeftW = Math.min(W/2 - geradoW/2, W-M-pagW) - M - 4
    let rodapeEsq = `Diário do Projeto · RDO #${numeroRdo(rdo.numero)} · ${rdo.projeto.nome}`
    if (doc.getTextWidth(rodapeEsq) > maxLeftW) {
      while (rodapeEsq.length > 0 && doc.getTextWidth(rodapeEsq + '…') > maxLeftW) {
        rodapeEsq = rodapeEsq.slice(0, -1)
      }
      rodapeEsq = rodapeEsq.trimEnd() + '…'
    }

    txt(rodapeEsq, M, 296, { size:6, cor:COR.ts })
    txt(geradoTexto, W/2, 296, { size:6, cor:COR.ts, align:'center' })
    txt(pagTexto, W-M, 296, { size:6, cor:COR.ts, align:'right' })
  }

  // ── Download ──
  const nomeArq = `RDO_${numeroRdo(rdo.numero)}_${rdo.projeto.nome.replace(/\s+/g,'-')}.pdf`
  if (opcoes?.retornarBlob) {
    return { blob: doc.output('blob'), nomeArq }
  }
  doc.save(nomeArq)
}

// ════════════════════════════════════════════════════════════
// PDF da tela de Relatórios — botão "Exportar PDF"
// ════════════════════════════════════════════════════════════
// Mesma paleta/estilo do PDF do RDO (COR, cartões de seção, autoTable), mas
// sem a lógica de "caber numa página só": um relatório naturalmente passa de
// 1 página (vira normal ter 2-3), então aqui é escala fixa (1) com quebra de
// página simples via novaPaginaSeNecessario, sem a medição prévia iterativa.
const OC_L_PDF: Record<string,string> = {
  ATRASO_MATERIAL: 'Atraso de material', PROBLEMA_TECNICO: 'Problema técnico',
  CONDICAO_CLIMATICA: 'Condição climática', FALTA_MAO_DE_OBRA: 'Falta de mão de obra',
  ACIDENTE_INCIDENTE: 'Acidente/incidente', PARALISACAO: 'Paralisação', OUTRO: 'Outro',
}
// Mesmas cores usadas nos gráficos da tela (DonutStatusRdos/STATUS_COR e
// CATEGORIA_COR em app/(app)/relatorios/page.tsx), mapeadas pra RGB da
// paleta clara deste arquivo.
const STATUS_COR_PDF: Record<string,[number,number,number]> = {
  RASCUNHO: COR.ts, PENDENTE_APROVACAO: COR.tw, APROVADO: COR.tsu, REJEITADO: COR.td,
}
const CATEGORIA_COR_PDF: Record<string,[number,number,number]> = {
  DIRETA: COR.ta, INDIRETA: COR.tpu, TERCEIRIZADO: COR.tsu,
}

function fmtBytesPdf(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`
}

function fmtHorasPdf(horas: number): string {
  if (horas < 24) return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`
  return `${(horas / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

function fmtLabelBucketPdf(iso: string, agrupamento: 'dia' | 'semana' | 'mes'): string {
  const d = new Date(`${iso}T00:00:00`)
  if (agrupamento === 'mes') return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Arredonda o topo do eixo Y do gráfico "RDOs ao longo do tempo" pra um
// número redondo (1/2/5 × potência de 10) — mesma lógica de niceMax() em
// app/(app)/relatorios/page.tsx.
function niceMaxPdf(valor: number): number {
  if (valor <= 0) return 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(valor)))
  const residual = valor / magnitude
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  return niceResidual * magnitude
}

export async function gerarPdfRelatorio(
  data: RelatorioResponse,
  filtros: { periodoLabel: string; filtrosTexto?: string },
  empresaNome?: string,
  opcoes?: { retornarBlob?: boolean },
): Promise<{ blob: Blob; nomeArq: string } | void> {
  const { default: jsPDF } = await import('jspdf')

  const W = 210, M = 12, CW = W - M * 2
  const PAGE_BREAK_Y = 282
  const HEADER_H = 22

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 0

  function rect(x:number, yy:number, w:number, h:number, fill:[number,number,number], r=0) {
    doc.setFillColor(...fill)
    if (r > 0) doc.roundedRect(x, yy, w, h, r, r, 'F')
    else       doc.rect(x, yy, w, h, 'F')
  }
  function txt(
    texto:string, x:number, yy:number,
    { size=9, bold=false, cor=COR.txt, align='left' as 'left'|'center'|'right' } = {}
  ) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...cor)
    doc.text(texto, x, yy, { align })
  }
  function secHeader(titulo:string, badge?: string) {
    y += 1
    const h = 5.5
    rect(M, y, CW, h, COR.s1, 1.2)
    rect(M, y, 1.4, h, COR.ta)
    txt(titulo, M+3.5, y+h/2+1, { size:8.5, bold:true, cor:COR.tp })
    if (badge) txt(badge, M+CW-3, y+h/2+1, { size:7, bold:true, cor:COR.ts, align:'right' })
    y += h + 2
  }
  function vazio(msg: string) {
    txt(msg, M, y+3, { size:7.5, cor:COR.ts })
    y += 7
  }
  function novaPaginaSeNecessario(precisaH: number) {
    if (y + precisaH <= PAGE_BREAK_Y) return
    doc.addPage()
    rect(0, 0, W, 7, COR.s0)
    doc.setDrawColor(...COR.brd)
    doc.setLineWidth(0.3)
    doc.line(0, 7, W, 7)
    txt('Diário do Projeto · Relatórios', W/2, 4.8, { size:6.5, cor:COR.ts, align:'center' })
    y = 11
  }
  // Grid de cartões de indicador — usado pros 12 KPIs do topo da tela
  function kpiGrid(items: Array<{label:string; valor:string; cor?:[number,number,number]}>, cols=3) {
    const gap = 2.5
    const cardW = (CW - gap*(cols-1)) / cols
    const cardH = 13
    const rows = Math.ceil(items.length / cols)
    items.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const x = M + col*(cardW+gap)
      const yy = y + row*(cardH+gap)
      rect(x, yy, cardW, cardH, COR.s1, 1.5)
      txt(it.valor, x+3, yy+7, { size:11, bold:true, cor: it.cor ?? COR.tp })
      doc.setFontSize(6)
      const labelLines = doc.splitTextToSize(it.label, cardW-6)
      txt(labelLines[0] ?? it.label, x+3, yy+10.8, { size:6, cor:COR.ts })
    })
    y += rows*(cardH+gap) + 2
  }

  // ── Helpers de desenho de gráfico — réplicas vetoriais dos componentes
  // SVG/div da tela (DonutStatusRdos, FunnelChart, barras) ─────────────
  function fillPolygon(points: Array<[number,number]>, color:[number,number,number]) {
    if (points.length < 3) return
    doc.setFillColor(...color)
    const deltas: Array<[number,number]> = []
    for (let i = 1; i < points.length; i++) deltas.push([points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]])
    doc.lines(deltas, points[0][0], points[0][1], [1,1], 'F', true)
  }
  // Clareia uma cor em direção ao branco (mistura) — usado nos degradês do
  // funil, já que o jsPDF não tem opacidade confiável em preenchimentos.
  function blend(c:[number,number,number], factor:number): [number,number,number] {
    return [
      Math.round(c[0]*factor + 255*(1-factor)),
      Math.round(c[1]*factor + 255*(1-factor)),
      Math.round(c[2]*factor + 255*(1-factor)),
    ]
  }
  // Um "gomo" do anel do donut — aproxima o arco por pequenos quadriláteros
  // (o jsPDF não tem stroke de arco nativo confiável).
  function drawRingSegment(cx:number, cy:number, rInner:number, rOuter:number, startDeg:number, endDeg:number, color:[number,number,number]) {
    if (endDeg <= startDeg) return
    const steps = Math.max(1, Math.ceil((endDeg-startDeg)/4))
    for (let i = 0; i < steps; i++) {
      const a0 = (startDeg + (endDeg-startDeg)*i/steps) * Math.PI/180
      const a1 = (startDeg + (endDeg-startDeg)*(i+1)/steps) * Math.PI/180
      fillPolygon([
        [cx+rOuter*Math.cos(a0), cy+rOuter*Math.sin(a0)],
        [cx+rOuter*Math.cos(a1), cy+rOuter*Math.sin(a1)],
        [cx+rInner*Math.cos(a1), cy+rInner*Math.sin(a1)],
        [cx+rInner*Math.cos(a0), cy+rInner*Math.sin(a0)],
      ], color)
    }
  }
  // Donut + legenda lateral — réplica de DonutStatusRdos
  function donutSection(dados: Array<{status:string; total:number}>, totalRdos:number) {
    const rOuter = 15, rInner = 9.5
    const topo = y
    const cx = M + rOuter + 1, cy = topo + rOuter
    if (totalRdos > 0) {
      let ang = -90
      dados.filter(d => d.total > 0).forEach(d => {
        const sweep = (d.total/totalRdos) * 360
        const gap = Math.min(3, sweep*0.08)
        drawRingSegment(cx, cy, rInner, rOuter, ang, ang + Math.max(0, sweep-gap), STATUS_COR_PDF[d.status] ?? COR.ts)
        ang += sweep
      })
    } else {
      drawRingSegment(cx, cy, rInner, rOuter, -90, 269.9, COR.s2)
    }
    txt(String(totalRdos), cx, cy+1.3, { size:12, bold:true, cor:COR.tp, align:'center' })
    txt(`RDO${totalRdos===1?'':'s'}`, cx, cy+4.6, { size:5, cor:COR.ts, align:'center' })

    const legX = M + rOuter*2 + 10
    let legY = topo + 4
    dados.forEach(d => {
      const pct = totalRdos > 0 ? Math.round((d.total/totalRdos)*100) : 0
      rect(legX, legY-2.3, 2.3, 2.3, STATUS_COR_PDF[d.status] ?? COR.ts, 0.5)
      txt(STATUS_L[d.status] ?? d.status, legX+4, legY, { size:7, cor:COR.ts })
      txt(String(d.total), M+CW-14, legY, { size:7, bold:true, cor:COR.tp, align:'right' })
      txt(`${pct}%`, M+CW, legY, { size:6.5, cor:COR.ts, align:'right' })
      legY += 4.8
    })
    y = topo + Math.max(rOuter*2+4, legY-topo+1)
  }
  // Funil + rótulos — réplica de FunnelChart
  function funnelSection(dados: Array<{label:string; valor:number; sufixo?:string}>, corBase:[number,number,number]) {
    const max = Math.max(1, ...dados.map(d => d.valor))
    const n = dados.length
    const chartW = 50, rowH = 6.2
    const topo = y
    dados.forEach((d, i) => {
      const topPct = d.valor/max
      const botPct = (i < n-1 ? dados[i+1].valor : d.valor)/max
      const topHalf = (topPct*chartW)/2
      const botHalf = (botPct*chartW)/2
      const y1 = topo + i*rowH
      const y2 = y1 + rowH - 0.6
      const cx = M + chartW/2
      const opac = n > 1 ? 1 - (i/(n-1))*0.55 : 1
      fillPolygon([[cx-topHalf,y1],[cx+topHalf,y1],[cx+botHalf,y2],[cx-botHalf,y2]], blend(corBase, opac))
    })
    const labX = M + chartW + 6
    dados.forEach((d, i) => {
      const meio = topo + i*rowH + rowH/2
      doc.setFontSize(6.5)
      const labelLines = doc.splitTextToSize(d.label, M+CW-labX-20)
      txt(labelLines[0] ?? d.label, labX, meio-0.3, { size:6.5, cor:COR.ts })
      txt(`${d.valor}${d.sufixo ?? ''}`, M+CW, meio-0.3, { size:6.5, bold:true, cor:COR.tp, align:'right' })
    })
    y = topo + n*rowH + 3
  }
  // Barra empilhada + legenda — réplica do bloco "H/H por categoria"
  function stackedBarSection(itens: Array<{label:string; valor:number; sub:string; cor:[number,number,number]}>) {
    const total = itens.reduce((s,it) => s+it.valor, 0)
    const barH = 6, topo = y
    let xCur = M
    itens.forEach(it => {
      const w = total > 0 ? (it.valor/total)*CW : 0
      if (w > 0.3) rect(xCur, topo, Math.max(0, w-0.5), barH, it.cor, 1)
      xCur += w
    })
    let ly = topo + barH + 5
    let lx = M
    itens.forEach(it => {
      rect(lx, ly-2.3, 2.3, 2.3, it.cor, 0.5)
      const texto = `${it.label}  ${it.sub}`
      doc.setFontSize(6.5)
      const w = doc.getTextWidth(texto)
      if (lx + 4 + w > M + CW) { lx = M; ly += 4.8 }
      txt(texto, lx+4, ly, { size:6.5, cor:COR.ts })
      lx += 4 + w + 9
    })
    y = ly + 4.5
  }
  // Fileira de barras horizontais com rótulo — usada pro ranking de desvio
  // e pra distribuição do tempo de aprovação (mesmo padrão visual dos dois
  // blocos na tela, só muda a cor de cada barra).
  function barrasHorizontaisSection(dados: Array<{label:string; valor:string; pct:number; cor:[number,number,number]}>) {
    dados.forEach(d => {
      txt(d.label, M, y+2.4, { size:6.5, cor:COR.tp })
      txt(d.valor, M+CW, y+2.4, { size:6.5, bold:true, cor:d.cor, align:'right' })
      y += 3.4
      rect(M, y, CW, 1.8, COR.s2, 0.6)
      rect(M, y, Math.max(0, (d.pct/100)*CW), 1.8, d.cor, 0.6)
      y += 4.4
    })
  }
  // Barras verticais com grade — réplica de "RDOs ao longo do tempo"
  function barsVerticaisSection(pontos: Array<{data:string; total:number}>, agrupamento:'dia'|'semana'|'mes') {
    const max = niceMaxPdf(Math.max(1, ...pontos.map(p => p.total)))
    const chartH = 34, chartX = M+8, chartW = CW-8
    const baseY = y + chartH
    // Evita rótulos repetidos no eixo Y quando o total é muito baixo (ex.:
    // 1 RDO no período) — mesma lógica de ticksPeriodo em
    // app/(app)/relatorios/page.tsx. A linha de grade sempre desenha, só o
    // texto do rótulo some quando repetiria o valor anterior.
    let labelAnterior: number | null = null
    for (let i = 4; i >= 0; i--) {
      const gy = baseY - chartH*i/4
      doc.setDrawColor(...COR.brd)
      doc.setLineWidth(0.15)
      doc.line(chartX, gy, chartX+chartW, gy)
      const v = Math.round(max*i/4)
      if (v !== labelAnterior) txt(String(v), chartX-2, gy+1, { size:5, cor:COR.ts, align:'right' })
      labelAnterior = v
    }
    const n = pontos.length
    const slot = chartW/n
    const barW = Math.max(0.5, slot*0.6)
    const passo = n > 20 ? Math.ceil(n/20) : 1
    pontos.forEach((p, i) => {
      const bh = (p.total/max)*chartH
      const bx = chartX + i*slot + (slot-barW)/2
      rect(bx, baseY-bh, barW, Math.max(0.3, bh), COR.ta, 0.3)
      if (i % passo === 0) {
        txt(fmtLabelBucketPdf(p.data, agrupamento), chartX+i*slot+slot/2, baseY+3.4, { size:4.3, cor:COR.ts, align:'center' })
      }
    })
    y = baseY + 7
  }

  // ════════════════════════════════════════════════════
  // CAPA / HEADER
  // ════════════════════════════════════════════════════
  rect(0, 0, W, HEADER_H, COR.s0)
  rect(0, 0, 3, HEADER_H, COR.ta)
  doc.setDrawColor(...COR.brd)
  doc.setLineWidth(0.3)
  doc.line(0, HEADER_H, W, HEADER_H)

  txt('DIÁRIO DO PROJETO', M+2, 7, { size:6.5, bold:true, cor:COR.ta })
  txt('Relatórios', W/2, 7, { size:8.5, bold:true, cor:COR.ts, align:'center' })
  txt(empresaNome?.trim() || 'Relatório de desempenho', M+2, 14.5, { size:12, bold:true, cor:COR.tp })
  txt(filtros.periodoLabel, W-M, 9.5, { size:11, bold:true, cor:COR.ta, align:'right' })
  if (filtros.filtrosTexto) {
    txt(filtros.filtrosTexto, W-M, 14.5, { size:7, cor:COR.ts, align:'right' })
  }
  txt(`${fmtData(data.dataInicio)} a ${fmtData(data.dataFim)}`, M+2, 19.5, { size:7, cor:COR.ts })

  y = HEADER_H + 4

  // ════════════════════════════════════════════════════
  // INDICADORES
  // ════════════════════════════════════════════════════
  const avancoMedio = data.progressoPorProjeto.length
    ? Math.round(data.progressoPorProjeto.reduce((s, p) => s + p.pctReal, 0) / data.progressoPorProjeto.length)
    : 0

  secHeader('Indicadores')
  kpiGrid([
    { valor:`${avancoMedio}%`, label:'Avanço médio', cor:COR.ta },
    { valor:`${data.kpis.desvioMedio >= 0 ? '+' : ''}${data.kpis.desvioMedio}%`, label:'Desvio médio', cor: data.kpis.desvioMedio >= 0 ? COR.tsu : COR.td },
    { valor:String(data.kpis.totalRdos), label:'RDOs no período' },
    { valor:String(data.kpis.totalHH), label:'H/H registradas' },
    { valor:`${data.kpis.taxaAprovacao}%`, label:'Taxa de aprovação', cor:COR.tsu },
    { valor:String(data.kpis.ocorrenciasAbertas), label:'Ocorrências abertas', cor:COR.tw },
    { valor:String(data.kpis.totalProjetos), label:'Projetos' },
    { valor:String(data.kpis.totalUsuarios), label:'Usuários' },
    { valor:String(data.kpis.totalFotos), label:'Fotos' },
    { valor:String(data.kpis.totalVideos), label:'Vídeos' },
    { valor:String(data.kpis.totalAnexos), label:'Anexos' },
    { valor:fmtBytesPdf(data.kpis.armazenamentoBytes), label:'Armazenamento' },
  ])

  // ════════════════════════════════════════════════════
  // H/H POR CATEGORIA DE MÃO DE OBRA — barra empilhada
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(26)
  secHeader('H/H por categoria de mão de obra')
  if (data.hhPorCategoria.length === 0) {
    vazio('Sem registros de mão de obra no período.')
  } else {
    stackedBarSection(data.hhPorCategoria.map(h => ({
      label: CATEGORIA_L[h.categoria] ?? h.categoria,
      valor: h.totalHH,
      sub: `${h.totalHH} H/H`,
      cor: CATEGORIA_COR_PDF[h.categoria] ?? COR.ts,
    })))
  }

  // ════════════════════════════════════════════════════
  // TOP 5 — PIORES DESVIOS — barras de desvio (igual ao ranking da tela)
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(8 + data.rankingPiorDesvio.length*7.8)
  secHeader('Top 5 — piores desvios')
  if (data.rankingPiorDesvio.length === 0) {
    vazio('Nenhum projeto ativo no filtro selecionado.')
  } else {
    const maxAbsDesvio = Math.max(1, ...data.rankingPiorDesvio.map(p => Math.abs(p.desvio)))
    barrasHorizontaisSection(data.rankingPiorDesvio.map(p => ({
      label: p.nome,
      valor: `${p.pctReal}% / plan ${p.pctPlanejado}%   ${p.desvio >= 0 ? '+' : ''}${p.desvio}%`,
      pct: (Math.abs(p.desvio)/maxAbsDesvio)*100,
      cor: p.desvio < 0 ? COR.td : COR.tsu,
    })))
    y += 1
  }

  // ════════════════════════════════════════════════════
  // STATUS DOS RDOS — donut
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(8 + Math.max(34, data.statusRdos.length*4.8+8))
  secHeader('Status dos RDOs')
  if (data.statusRdos.every(s => s.total === 0)) {
    vazio('Nenhum RDO no período.')
  } else {
    donutSection(data.statusRdos, data.kpis.totalRdos)
  }

  // ════════════════════════════════════════════════════
  // OCORRÊNCIAS POR TIPO — funil
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(10 + data.ocorrenciasPorTipo.length*6.2)
  secHeader('Ocorrências por tipo')
  if (data.ocorrenciasPorTipo.length === 0) {
    vazio('Nenhuma ocorrência no período.')
  } else {
    funnelSection(data.ocorrenciasPorTipo.map(o => ({ label: OC_L_PDF[o.tipo] ?? o.tipo, valor: o.total })), COR.td)
  }

  // ════════════════════════════════════════════════════
  // HORAS IMPACTADAS POR OCORRÊNCIAS — funil
  // ════════════════════════════════════════════════════
  const horasOrdenadas = [...data.ocorrenciasPorTipo].sort((a,b) => b.horas - a.horas).filter(o => o.horas > 0)
  novaPaginaSeNecessario(10 + horasOrdenadas.length*6.2)
  secHeader('Horas impactadas por ocorrências')
  if (horasOrdenadas.length === 0) {
    vazio('Nenhuma ocorrência com duração registrada no período.')
  } else {
    funnelSection(horasOrdenadas.map(o => ({ label: OC_L_PDF[o.tipo] ?? o.tipo, valor: o.horas, sufixo: 'h' })), COR.tw)
  }

  // ════════════════════════════════════════════════════
  // H/H POR FUNÇÃO — funil
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(10 + data.hhPorFuncao.length*6.2)
  secHeader('H/H por função')
  if (data.hhPorFuncao.length === 0) {
    vazio('Sem registros de mão de obra no período.')
  } else {
    funnelSection(data.hhPorFuncao.map(h => ({ label: h.funcao, valor: h.totalHH, sufixo: ' H/H' })), COR.tsu)
  }

  // ════════════════════════════════════════════════════
  // TEMPO MÉDIO DE APROVAÇÃO — barras horizontais
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(10 + data.tempoAprovacao.distribuicao.length*7.8)
  secHeader(
    'Tempo médio de aprovação de RDO',
    data.tempoAprovacao.mediaHoras != null
      ? `Média: ${fmtHorasPdf(data.tempoAprovacao.mediaHoras)} · ${data.tempoAprovacao.amostra} RDO${data.tempoAprovacao.amostra===1?'':'s'}`
      : undefined,
  )
  if (data.tempoAprovacao.amostra === 0) {
    vazio('Nenhum RDO enviado e decidido no período.')
  } else {
    const maxFaixa = Math.max(1, ...data.tempoAprovacao.distribuicao.map(d => d.total))
    barrasHorizontaisSection(data.tempoAprovacao.distribuicao.map(d => ({
      label: d.faixa, valor: String(d.total), pct: (d.total/maxFaixa)*100, cor: COR.ta,
    })))
  }

  // ════════════════════════════════════════════════════
  // RDOS AO LONGO DO TEMPO — barras verticais com grade
  // ════════════════════════════════════════════════════
  novaPaginaSeNecessario(48)
  secHeader('RDOs ao longo do tempo')
  if (data.rdosPorPeriodo.pontos.length === 0) {
    vazio('Nenhum RDO no período.')
  } else {
    barsVerticaisSection(data.rdosPorPeriodo.pontos, data.rdosPorPeriodo.agrupamento)
  }

  // ════════════════════════════════════════════════════
  // RODAPÉ em todas as páginas
  // ════════════════════════════════════════════════════
  const totalPag = doc.getNumberOfPages()
  const geradoTexto = `Gerado em ${new Date().toLocaleString('pt-BR')}`
  for (let p = 1; p <= totalPag; p++) {
    doc.setPage(p)
    rect(0, 290, W, 10, COR.s0)
    doc.setDrawColor(...COR.brd)
    doc.setLineWidth(0.3)
    doc.line(0, 290, W, 290)
    const pagTexto = `Página ${p} / ${totalPag}`
    txt('Diário do Projeto · Relatórios', M, 296, { size:6, cor:COR.ts })
    txt(geradoTexto, W/2, 296, { size:6, cor:COR.ts, align:'center' })
    txt(pagTexto, W-M, 296, { size:6, cor:COR.ts, align:'right' })
  }

  // ── Download ──
  const nomeArq = `Relatorios_${new Date().toISOString().slice(0,10)}.pdf`
  if (opcoes?.retornarBlob) {
    return { blob: doc.output('blob'), nomeArq }
  }
  doc.save(nomeArq)
}
