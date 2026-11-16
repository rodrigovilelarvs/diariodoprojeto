// src/api/app/funcoes/route.ts
// GET  /api/app/funcoes — lista funções cadastradas do tenant (semeia funções rotineiras no primeiro acesso)
// POST /api/app/funcoes — cadastrar nova função

import { MaoDeObraCategoria } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, podeGerenciarProjetos, podeVerRelatorios } from '@/lib/auth'
import { numeroOuNull } from '@/lib/homem-hora'

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

  const funcoes: Array<{ id: string; nome: string; categoria: string; valorHora: unknown }> = await prisma.funcaoCadastro.findMany({
    where:   { tenantId },
    select:  { id: true, nome: true, categoria: true, valorHora: true },
    orderBy: { nome: 'asc' },
  })

  // O valor da hora é informação financeira: só vai para quem gerencia projetos ou vê relatórios
  const veValor = podeGerenciarProjetos(auth.ctx) || podeVerRelatorios(auth.ctx)
  return NextResponse.json(funcoes.map(f => ({ id: f.id, nome: f.nome, categoria: f.categoria, ...(veValor ? { valorHora: numeroOuNull(f.valorHora) } : {}) })))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  // Catálogo é preenchido por quem monta o RDO; perfil sem permissão é só leitura
  if (!podeEmitirRdo(auth.ctx)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  const { tenantId } = auth.ctx

  let body: { nome?: string; categoria?: string; valorHora?: number | string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const nome = body.nome?.trim()
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
  const valorHora = podeGerenciarProjetos(auth.ctx) ? numeroOuNull(body.valorHora) : null
  if (valorHora != null && valorHora < 0) {
    return NextResponse.json({ erro: 'O valor da hora não pode ser negativo.' }, { status: 400 })
  }

  const funcao = await prisma.funcaoCadastro.create({
    data: { tenantId, nome, categoria: body.categoria as MaoDeObraCategoria, valorHora },
    select: { id: true, nome: true, categoria: true },
  })

  return NextResponse.json(funcao, { status: 201 })
}
