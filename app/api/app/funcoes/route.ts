// src/api/app/funcoes/route.ts
// GET  /api/app/funcoes — lista funções cadastradas do tenant (semeia funções rotineiras no primeiro acesso)
// POST /api/app/funcoes — cadastrar nova função

import { MaoDeObraCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, podeGerenciarProjetos, podeVerRelatorios } from '@/lib/auth'
import { numeroOuNull, limparCampoCadastro, nomeComposto, mesmaFuncao } from '@/lib/homem-hora'

// Funções rotineiras de execução de obra — semeadas automaticamente no primeiro acesso do tenant
const FUNCOES_PADRAO: Array<{ nome: string; categoria: MaoDeObraCategoria }> = [
  { nome: 'Pedreiro',       categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Servente',       categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Ajudante geral', categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Carpinteiro',    categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Armador',        categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Eletricista',    categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Encanador',      categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Pintor',         categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Azulejista',     categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Gesseiro',       categoria: MaoDeObraCategoria.DIRETA },
  { nome: 'Mestre de obras',                    categoria: MaoDeObraCategoria.INDIRETA },
  { nome: 'Encarregado',                        categoria: MaoDeObraCategoria.INDIRETA },
  { nome: 'Engenheiro civil',                   categoria: MaoDeObraCategoria.INDIRETA },
  { nome: 'Técnico de segurança do trabalho',   categoria: MaoDeObraCategoria.INDIRETA },
  { nome: 'Almoxarife',                         categoria: MaoDeObraCategoria.INDIRETA },
  { nome: 'Apontador',                          categoria: MaoDeObraCategoria.INDIRETA },
]

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  const total = await prisma.funcaoCadastro.count({ where: { tenantId } })
  if (total === 0) {
    await prisma.funcaoCadastro.createMany({
      data: FUNCOES_PADRAO.map(f => ({ tenantId, nome: f.nome, categoria: f.categoria })),
      skipDuplicates: true,
    })
  }

  const funcoes: Array<{ id: string; nome: string; categoria: string; valorHora: unknown; pessoa: string | null; funcao: string | null }> = await prisma.funcaoCadastro.findMany({
    where:   { tenantId },
    select:  { id: true, nome: true, categoria: true, valorHora: true, pessoa: true, funcao: true },
    orderBy: { nome: 'asc' },
  })

  // O valor da hora é informação financeira: só vai para quem gerencia projetos ou vê relatórios
  const veValor = podeGerenciarProjetos(auth.ctx) || podeVerRelatorios(auth.ctx)
  return NextResponse.json(funcoes.map(f => ({ id: f.id, nome: f.nome, categoria: f.categoria, pessoa: f.pessoa ?? null, funcao: f.funcao ?? null, ...(veValor ? { valorHora: numeroOuNull(f.valorHora) } : {}) })))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  // Catálogo é preenchido por quem monta o RDO; perfil sem permissão é só leitura
  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const { tenantId } = auth.ctx

  let body: { nome?: string; pessoa?: string; funcao?: string; categoria?: string; valorHora?: number | string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  // Projetos H/H: Nome + Função em campos separados; os demais: só a função
  const hh = body.pessoa !== undefined || body.funcao !== undefined
  const pessoa = limparCampoCadastro(body.pessoa)
  const funcao = limparCampoCadastro(body.funcao)
  if (hh && (!pessoa || !funcao)) {
    return NextResponse.json({ erro: 'Informe o nome e a função.' }, { status: 400 })
  }
  const nome = hh ? nomeComposto(pessoa, funcao) : body.nome?.trim()
  if (!nome) {
    return NextResponse.json({ erro: 'Nome da função é obrigatório.' }, { status: 400 })
  }
  if (!Object.values(MaoDeObraCategoria).includes(body.categoria as MaoDeObraCategoria)) {
    return NextResponse.json({ erro: 'Categoria inválida.' }, { status: 400 })
  }

  const existente = await prisma.funcaoCadastro.findFirst({ where: { tenantId, nome } })
  if (existente) {
    return NextResponse.json(existente, { status: 200 })
  }

  // valor da hora: só quem gerencia projetos define
  let valorHora = podeGerenciarProjetos(auth.ctx) ? numeroOuNull(body.valorHora) : null
  if (valorHora != null && valorHora < 0) {
    return NextResponse.json({ erro: 'O valor da hora não pode ser negativo.' }, { status: 400 })
  }

  // O valor da hora é da função: quem entra numa função que já tem valor herda esse valor,
  // e informar um valor novo vale para todos os cadastros dessa função
  let mesmos: Array<{ id: string; funcao: string | null; valorHora: unknown }> = []
  if (hh) {
    const todos: typeof mesmos = await prisma.funcaoCadastro.findMany({ where: { tenantId }, select: { id: true, funcao: true, valorHora: true } })
    mesmos = todos.filter(f => mesmaFuncao(f.funcao, funcao))
    if (valorHora == null) valorHora = mesmos.map(f => numeroOuNull(f.valorHora)).find(v => v != null) ?? null
  }

  const criada = await prisma.funcaoCadastro.create({
    data: { tenantId, nome, categoria: body.categoria as MaoDeObraCategoria, valorHora, ...(hh ? { pessoa, funcao } : {}) },
    select: { id: true, nome: true, categoria: true, pessoa: true, funcao: true },
  })
  if (hh && valorHora != null && podeGerenciarProjetos(auth.ctx) && body.valorHora != null) {
    for (const f of mesmos) await prisma.funcaoCadastro.update({ where: { id: f.id }, data: { valorHora } })
  }

  return NextResponse.json(criada, { status: 201 })
}
