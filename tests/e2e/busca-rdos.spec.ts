import { test, expect } from '@playwright/test'
import { apiComo } from './helpers'
import { filtroBuscaRdo } from '../../lib/busca-rdo'

// A busca da Lista de RDOs é feita no servidor (vale para todas as páginas, não só a
// que está na tela) e entende projeto, número, data e gestor. A montagem do filtro é
// uma função pura (lib/busca-rdo.ts), testada aqui direto; o banco falso ignora o
// "where", então o filtro em si é conferido pelo formato e pelo tipo do Prisma.

const ANO = 2026
const U = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))
const temData = (c: unknown[] | null, esperado: unknown) =>
  !!c && c.some(x => JSON.stringify((x as { data?: unknown }).data) === JSON.stringify(esperado))
const temNumero = (c: unknown[] | null, n: number) => !!c && c.some(x => (x as { numero?: number }).numero === n)

test('texto vazio não filtra nada', () => {
  expect(filtroBuscaRdo('', ANO)).toBeNull()
  expect(filtroBuscaRdo('   ', ANO)).toBeNull()
  expect(filtroBuscaRdo(undefined, ANO)).toBeNull()
})

test('sempre busca por nome do projeto e do gestor, sem diferenciar maiúsculas', () => {
  const c = filtroBuscaRdo('  Leitos ', ANO)!
  expect(c[0]).toEqual({ projeto: { nome: { contains: 'Leitos', mode: 'insensitive' } } })
  expect(c[1]).toEqual({ projeto: { gestor: { nome: { contains: 'Leitos', mode: 'insensitive' } } } })
  expect(temNumero(c, NaN)).toBe(false)
})

test('número do RDO: "3", "0003" e "#0003" viram o número 3', () => {
  for (const t of ['3', '0003', '#0003', '#3']) expect(temNumero(filtroBuscaRdo(t, ANO), 3), t).toBe(true)
  expect(temNumero(filtroBuscaRdo('abc', ANO), 3)).toBe(false)
})

test('data completa em vários formatos', () => {
  for (const t of ['21/09/2026', '21-09-2026', '21.09.2026', '2026-09-21', '1/9/2026'.replace('1/9', '21/9')]) {
    expect(temData(filtroBuscaRdo(t, ANO), U(2026, 9, 21)), t).toBe(true)
  }
  // data impossível não gera filtro de data
  expect(temData(filtroBuscaRdo('31/02/2026', ANO), U(2026, 3, 3))).toBe(false)
  expect(filtroBuscaRdo('31/02/2026', ANO)!.length).toBe(2)
})

test('dia/mês sem ano procura esse dia nos anos próximos', () => {
  const c = filtroBuscaRdo('21/09', ANO)!
  const dia = c.find(x => (x as { data?: { in?: Date[] } }).data?.in) as { data: { in: Date[] } }
  expect(dia.data.in.map(d => d.toISOString().slice(0, 10))).toEqual(
    ['2023-09-21', '2024-09-21', '2025-09-21', '2026-09-21', '2027-09-21'],
  )
  // 29/02 só existe em ano bissexto
  const bis = filtroBuscaRdo('29/02', ANO)!.find(x => (x as { data?: unknown }).data) as { data: { in: Date[] } }
  expect(bis.data.in.map(d => d.getUTCFullYear())).toEqual([2024])
})

test('mês/ano e só o ano viram intervalos', () => {
  expect(temData(filtroBuscaRdo('09/2026', ANO), { gte: U(2026, 9, 1), lt: U(2026, 10, 1) })).toBe(true)
  expect(temData(filtroBuscaRdo('12/2026', ANO), { gte: U(2026, 12, 1), lt: U(2027, 1, 1) })).toBe(true)
  expect(temData(filtroBuscaRdo('2026', ANO), { gte: U(2026, 1, 1), lt: U(2027, 1, 1) })).toBe(true)
  expect(temData(filtroBuscaRdo('13/2026', ANO), { gte: U(2026, 1, 1), lt: U(2027, 1, 1) })).toBe(false)
})

test('a API aceita o parâmetro busca (pagina e filtra no servidor)', async ({ playwright }) => {
  const api = await apiComo(playwright)
  for (const busca of ['leitos', '3', '21/09/2026', '%27%20OR%201%3D1']) {
    const res = await api.get(`/api/app/rdos?busca=${encodeURIComponent(busca)}`)
    expect(res.status(), busca).toBe(200)
    expect(Array.isArray((await res.json()).rdos)).toBe(true)
  }
  await api.dispose()
})
