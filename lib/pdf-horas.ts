// lib/pdf-horas.ts
// PDF do relatório "Horas por dia (H/H)": cartões de resumo, tabela por dia (com o detalhe de cada pessoa e o
// subtotal de cada semana) e o resumo por pessoa. Mesma paleta do PDF do RDO e dos Relatórios.

import type { RelatorioHoras } from '@/hooks/useEmpresa'
import { fmtData } from '@/lib/format'
import { NOME_DIA_SEMANA } from '@/lib/feriados'
import { agruparPorSemana } from '@/lib/horas-relatorio'
import { ADICIONAL_NOTURNO_PERCENTUAL } from '@/lib/homem-hora'
import { COR } from '@/lib/pdf'

type RGB = [number, number, number]
const BRANCO: RGB = [255, 255, 255]

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => (n > 0 ? fmt(n) : '-')

function partesDoNome(nome: string): { pessoa: string; funcao: string } {
  const i = nome.indexOf(' - ')
  return i < 0 ? { pessoa: nome, funcao: '' } : { pessoa: nome.slice(0, i), funcao: nome.slice(i + 3) }
}

const ROTULO_DIA: Record<string, string> = { SABADO: 'Sábado', DOMINGO: 'Domingo', FERIADO: 'Feriado' }

export async function gerarPdfHoras(
  dados: RelatorioHoras,
  filtros: { empresaNome?: string; projetoNome?: string },
  opcoes?: { retornarBlob?: boolean },
): Promise<{ blob: Blob; nomeArq: string } | void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const W = 297, H = 210, M = 10, CW = W - M * 2, HEADER_H = 22
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const t = dados.totais
  const temValor = t.valor != null

  function rect(x: number, y: number, w: number, h: number, fill: RGB, r = 0) {
    doc.setFillColor(...fill)
    if (r > 0) doc.roundedRect(x, y, w, h, r, r, 'F')
    else doc.rect(x, y, w, h, 'F')
  }
  function txt(texto: string, x: number, y: number, { size = 9, bold = false, cor = COR.txt, align = 'left' as 'left' | 'center' | 'right' } = {}) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...cor)
    doc.text(texto, x, y, { align })
  }

  // ── Cabeçalho ──
  rect(0, 0, W, HEADER_H, COR.s0)
  rect(0, 0, 3, HEADER_H, COR.ta)
  doc.setDrawColor(...COR.brd); doc.setLineWidth(0.3); doc.line(0, HEADER_H, W, HEADER_H)
  txt('DIÁRIO DO PROJETO', M + 2, 7, { size: 6.5, bold: true, cor: COR.ta })
  txt('Horas por dia (H/H)', W / 2, 7, { size: 8.5, bold: true, cor: COR.ts, align: 'center' })
  txt(filtros.empresaNome?.trim() || 'Relatório de horas', M + 2, 14.5, { size: 12, bold: true, cor: COR.tp })
  txt(`${fmtData(dados.periodo.dataInicio)} a ${fmtData(dados.periodo.dataFim)}`, W - M, 9.5, { size: 11, bold: true, cor: COR.ta, align: 'right' })
  const filtrosTexto = [
    filtros.projetoNome ? `Projeto: ${filtros.projetoNome}` : 'Todos os projetos por homem-hora',
    dados.status === 'APROVADO' ? 'Só RDOs aprovados' : 'Todos os RDOs (inclui pendentes e rascunhos)',
  ].join(' · ')
  txt(filtrosTexto, W - M, 14.5, { size: 7, cor: COR.ts, align: 'right' })
  txt(`${t.dias} dia${t.dias !== 1 ? 's' : ''} com horas`, M + 2, 19.5, { size: 7, cor: COR.ts })

  // ── Cartões de resumo ──
  const cartoes: Array<{ rotulo: string; valor: string; cor?: RGB }> = [
    { rotulo: 'Total de H/H', valor: fmt(t.total) },
    { rotulo: 'Normais', valor: fmt(t.normais) },
    { rotulo: 'Extras', valor: fmt(t.extras), cor: COR.tw },
    { rotulo: `Noturno (${ADICIONAL_NOTURNO_PERCENTUAL}%)`, valor: fmt(t.noturnas), cor: COR.tpu },
    { rotulo: 'Sábados', valor: fmt(t.sabados), cor: COR.tw },
    { rotulo: 'Domingos', valor: fmt(t.domingos), cor: COR.td },
    { rotulo: 'Feriados', valor: fmt(t.feriados), cor: COR.tpu },
    ...(temValor ? [{ rotulo: 'Custo do período', valor: brl(t.valor as number), cor: COR.tsu }] : []),
  ]
  const gap = 2.5
  const cardW = (CW - gap * (cartoes.length - 1)) / cartoes.length
  let y = HEADER_H + 5
  cartoes.forEach((c, i) => {
    const x = M + i * (cardW + gap)
    rect(x, y, cardW, 14, COR.s1, 1.5)
    txt(c.valor, x + 3, y + 7, { size: 11, bold: true, cor: c.cor ?? COR.tp })
    txt(c.rotulo, x + 3, y + 11.4, { size: 6, cor: COR.ts })
  })
  y += 14 + 5

  if (dados.funcoesSemValor.length > 0) {
    txt(`Funções sem valor da hora cadastrado ficaram fora do custo: ${dados.funcoesSemValor.join(', ')}.`, M, y + 2, { size: 7, cor: COR.tw })
    y += 6
  }

  // ── Tabela por dia (detalhe de cada pessoa + subtotal da semana) ──
  type Celula = { content: string; styles?: Record<string, unknown> }
  const alinhaDir = { halign: 'right' as const }
  const linha = (cel: string[], estilo: Record<string, unknown>, tipoCor?: RGB): Celula[] =>
    cel.map((content, i) => ({
      content,
      styles: { ...estilo, ...(i >= 4 ? alinhaDir : {}), ...(i === 3 && tipoCor ? { textColor: tipoCor } : {}) },
    }))
  const corDoDia: Record<string, RGB> = { SABADO: COR.tw, DOMINGO: COR.td, FERIADO: COR.tpu }

  const corpo: Celula[][] = []
  for (const semana of agruparPorSemana(dados.dias)) {
    for (const d of semana.dias) {
      const rotuloDia = ROTULO_DIA[d.tipoDia] ?? ''
      corpo.push(linha([
        `${NOME_DIA_SEMANA[d.diaSemana].slice(0, 3).toLowerCase()} ${fmtData(d.data)}`, '', '', rotuloDia,
        String(d.pessoas), num(d.normais), num(d.extras), num(d.noturnas), fmt(d.total), ...(temValor ? [d.valor != null ? brl(d.valor) : '-'] : []),
      ], { fillColor: COR.s2, fontStyle: 'bold', textColor: COR.tp }, corDoDia[d.tipoDia]))
      for (const l of d.linhas) {
        const { pessoa, funcao } = partesDoNome(l.funcao)
        const extra = l.tipoHora === 'EXTRA'
        corpo.push(linha([
          '', funcao ? `${pessoa} - ${funcao}` : pessoa, `${l.horaEntrada}-${l.horaSaida}`, extra ? `Extra ${l.percentualExtra ?? 50}%` : 'Normal',
          String(l.quantidade), extra ? '-' : fmt(l.horas), extra ? fmt(l.horas) : '-', num(l.noturnas), fmt(l.horas),
          ...(temValor ? [l.valor != null ? brl(l.valor) : '-'] : []),
        ], { fillColor: BRANCO, textColor: COR.ts, fontSize: 6.5 }))
      }
    }
    corpo.push(linha([
      `Semana ${fmtData(semana.inicio).slice(0, 5)} a ${fmtData(semana.fim).slice(0, 5)}`, '', '', '', '',
      fmt(semana.normais), fmt(semana.extras), fmt(semana.noturnas), fmt(semana.total), ...(temValor ? [semana.valor != null ? brl(semana.valor) : '-'] : []),
    ], { fillColor: COR.s1, fontStyle: 'bold', textColor: COR.ta }))
  }

  const cabecalhoDia = ['Data', 'Pessoa - função', 'Horário', 'Tipo', 'Pessoas', 'Normais', 'Extras', 'Noturnas', 'Total H/H', ...(temValor ? ['Valor'] : [])]
  const largurasDia: Record<number, { cellWidth: number }> = temValor
    ? { 0: { cellWidth: 38 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 16 }, 5: { cellWidth: 19 }, 6: { cellWidth: 19 }, 7: { cellWidth: 19 }, 8: { cellWidth: 20 }, 9: { cellWidth: 28 } }
    : { 0: { cellWidth: 38 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 16 }, 5: { cellWidth: 19 }, 6: { cellWidth: 19 }, 7: { cellWidth: 19 }, 8: { cellWidth: 20 } }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 12, bottom: 14 },
    head: [cabecalhoDia.map((h, i) => ({ content: h, styles: i >= 4 ? alinhaDir : {} }))],
    body: corpo,
    foot: [linha([
      `Total do período · ${t.dias} dia${t.dias !== 1 ? 's' : ''}`, '', '', '', '', fmt(t.normais), fmt(t.extras), fmt(t.noturnas), fmt(t.total),
      ...(temValor ? [brl(t.valor as number)] : []),
    ], { fillColor: COR.s1, textColor: COR.tp, fontStyle: 'bold' })],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    styles: { fontSize: 7, cellPadding: 1.1, lineColor: COR.brd, lineWidth: 0.15, textColor: COR.tp },
    headStyles: { fillColor: COR.s1, textColor: COR.ta, fontStyle: 'bold' },
    columnStyles: largurasDia,
  })

  // ── Resumo por pessoa ──
  if (dados.pessoas.length > 0) {
    doc.addPage()
    let yy = 16
    rect(M, yy - 5, CW, 7, COR.s1, 1.2)
    rect(M, yy - 5, 1.4, 7, COR.ta)
    txt('Resumo por pessoa no período', M + 3.5, yy, { size: 9, bold: true, cor: COR.tp })
    yy += 5
    const corpoPessoas: Celula[][] = dados.pessoas.map((p) => {
      const { pessoa, funcao } = partesDoNome(p.funcao)
      return [
        { content: funcao ? `${pessoa} - ${funcao}` : pessoa },
        { content: String(p.dias), styles: alinhaDir },
        { content: num(p.normais), styles: alinhaDir },
        { content: p.extras > 0 ? `${fmt(p.extras)}  (${p.extrasPorPercentual.map((e) => `${e.percentual}%: ${fmt(e.horas)}`).join(' | ')})` : '-', styles: alinhaDir },
        { content: num(p.noturnas), styles: alinhaDir },
        { content: fmt(p.total), styles: { ...alinhaDir, fontStyle: 'bold' } },
        ...(temValor ? [{ content: p.valor != null ? brl(p.valor) : '-', styles: alinhaDir }] : []),
      ]
    })
    autoTable(doc, {
      startY: yy,
      margin: { left: M, right: M, top: 12, bottom: 14 },
      head: [['Pessoa - função', 'Dias', 'Normais', 'Extras (por percentual)', 'Noturnas', 'Total H/H', ...(temValor ? ['Valor'] : [])].map((h, i) => ({ content: h, styles: i >= 1 ? alinhaDir : {} }))],
      body: corpoPessoas,
      foot: [[
        { content: `Total · ${dados.pessoas.length} pessoa${dados.pessoas.length !== 1 ? 's' : ''}` },
        { content: '' },
        { content: fmt(t.normais), styles: alinhaDir },
        { content: fmt(t.extras), styles: alinhaDir },
        { content: fmt(t.noturnas), styles: alinhaDir },
        { content: fmt(t.total), styles: alinhaDir },
        ...(temValor ? [{ content: brl(t.valor as number), styles: alinhaDir }] : []),
      ]],
      showFoot: 'lastPage',
      styles: { fontSize: 7.5, cellPadding: 1.3, lineColor: COR.brd, lineWidth: 0.15, textColor: COR.tp },
      headStyles: { fillColor: COR.s1, textColor: COR.ta, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: COR.s1 },
      footStyles: { fillColor: COR.s2, textColor: COR.tp, fontStyle: 'bold' },
      columnStyles: temValor
        ? { 1: { cellWidth: 16 }, 2: { cellWidth: 22 }, 3: { cellWidth: 70 }, 4: { cellWidth: 22 }, 5: { cellWidth: 24 }, 6: { cellWidth: 32 } }
        : { 1: { cellWidth: 16 }, 2: { cellWidth: 22 }, 3: { cellWidth: 70 }, 4: { cellWidth: 22 }, 5: { cellWidth: 24 } },
    })
  }

  // ── Rodapé em todas as páginas ──
  const totalPag = doc.getNumberOfPages()
  const geradoTexto = `Gerado em ${new Date().toLocaleString('pt-BR')}`
  for (let p = 1; p <= totalPag; p++) {
    doc.setPage(p)
    rect(0, H - 9, W, 9, COR.s0)
    doc.setDrawColor(...COR.brd); doc.setLineWidth(0.3); doc.line(0, H - 9, W, H - 9)
    txt('Diário do Projeto · Horas por dia (H/H)', M, H - 3.5, { size: 6, cor: COR.ts })
    txt(geradoTexto, W / 2, H - 3.5, { size: 6, cor: COR.ts, align: 'center' })
    txt(`Página ${p} / ${totalPag}`, W - M, H - 3.5, { size: 6, cor: COR.ts, align: 'right' })
  }

  const nomeArq = `Horas-por-dia_${dados.periodo.dataInicio}_${dados.periodo.dataFim}.pdf`
  if (opcoes?.retornarBlob) return { blob: doc.output('blob'), nomeArq }
  doc.save(nomeArq)
}
