// lib/busca-rdo.ts
// Busca da Lista de RDOs (feita no servidor, em todas as páginas). O texto digitado
// pode ser: parte do nome do projeto, número do RDO ("3" ou "#0003"), uma data
// ("21/09/2026", "21/09", "09/2026", "2026", "2026-09-21") ou o gestor do projeto.
// Devolve as condições de um OR do Prisma, ou null se não há o que buscar.

import type { Prisma } from '@prisma/client'

// Tipado com o Prisma: se o formato de alguma condição estiver errado, o tsc acusa
type Condicao = Prisma.RdoWhereInput

// Datas "sem hora" são gravadas como meia-noite UTC (ver lib/format.ts)
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))

function dataValida(a: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = utc(a, m, d)
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null
}

function condicoesDeData(txt: string, anoAtual: number): Condicao[] {
  let m: RegExpMatchArray | null

  // dd/mm/aaaa (aceita - e . como separador)
  if ((m = txt.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    const dt = dataValida(+m[3], +m[2], +m[1])
    return dt ? [{ data: dt }] : []
  }
  // aaaa-mm-dd
  if ((m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const dt = dataValida(+m[1], +m[2], +m[3])
    return dt ? [{ data: dt }] : []
  }
  // mm/aaaa → o mês inteiro
  if ((m = txt.match(/^(\d{1,2})[/.-](\d{4})$/))) {
    const mes = +m[1], ano = +m[2]
    if (mes < 1 || mes > 12) return []
    return [{ data: { gte: utc(ano, mes, 1), lt: utc(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1, 1) } }]
  }
  // dd/mm → esse dia nos anos próximos (os RDOs de uma obra cobrem poucos anos)
  if ((m = txt.match(/^(\d{1,2})[/.-](\d{1,2})$/))) {
    const dias: Date[] = []
    for (let ano = anoAtual - 3; ano <= anoAtual + 1; ano++) {
      const dt = dataValida(ano, +m[2], +m[1])
      if (dt) dias.push(dt)
    }
    return dias.length ? [{ data: { in: dias } }] : []
  }
  // aaaa → o ano inteiro
  if ((m = txt.match(/^(19|20)\d{2}$/))) {
    const ano = +txt
    return [{ data: { gte: utc(ano, 1, 1), lt: utc(ano + 1, 1, 1) } }]
  }
  return []
}

export function filtroBuscaRdo(texto: string | null | undefined, anoAtual = new Date().getFullYear()): Condicao[] | null {
  const txt = (texto ?? '').trim()
  if (!txt) return null

  const condicoes: Condicao[] = [
    { projeto: { nome: { contains: txt, mode: 'insensitive' as const } } },
    { projeto: { gestor: { nome: { contains: txt, mode: 'insensitive' as const } } } },
  ]

  // número do RDO: "3", "003" ou "#0003"
  const num = txt.replace(/^#/, '')
  if (/^\d{1,6}$/.test(num)) condicoes.push({ numero: parseInt(num, 10) })

  condicoes.push(...condicoesDeData(txt, anoAtual))
  return condicoes
}
