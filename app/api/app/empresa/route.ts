// src/api/app/empresa/route.ts
// GET   /api/app/empresa — dados da empresa (tenant) para exibição, aberto a
//                          qualquer usuário logado da empresa
// PATCH /api/app/empresa — editar nome/cnpj/contato/localização (restrito ao
//                          Administrador); plano/limites/status/vencimento
//                          são somente leitura aqui

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { LogCategoria, UsuarioPerfil } from '@/lib/prisma-enums'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId } = auth.ctx

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: {
      id: true, nome: true, cnpj: true, setor: true, cidade: true, uf: true,
      contatoNome: true, contatoEmail: true, contatoTelefone: true,
      plano: true, status: true, dataVencimentoPlano: true,
      ativadoEm: true, criadoEm: true,
      limiteUsuarios: true, limiteRdosMes: true, limiteProjetos: true,
    },
  })
  if (!tenant) {
    return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const [usuariosAtivos, rdosMes, totalProjetos, planoConfig] = await Promise.all([
    prisma.usuario.count({ where: { tenantId, status: 'ATIVO' } }),
    prisma.rdo.count({ where: { projeto: { tenantId }, criadoEm: { gte: inicioMes } } }),
    prisma.projeto.count({ where: { tenantId } }),
    prisma.planoConfig.findUnique({ where: { tenantId } }).then((cfg: any) =>
      cfg ?? prisma.planoConfig.findUnique({ where: { tipo: tenant.plano } }),
    ),
  ])

  return NextResponse.json({
    ...tenant,
    limites: {
      usuarios: tenant.limiteUsuarios,
      rdosMes:  tenant.limiteRdosMes,
      projetos: tenant.limiteProjetos,
    },
    uso: {
      usuarios: usuariosAtivos,
      rdosMes,
      projetos: totalProjetos,
    },
    planoConfig: planoConfig ? {
      precoMensal:        Number(planoConfig.precoMensal),
      temRelatorios:      planoConfig.temRelatorios,
      temExportPdf:       planoConfig.temExportPdf,
      temApi:             planoConfig.temApi,
      temSuporteDedicado: planoConfig.temSuporteDedicado,
      descricao:          planoConfig.descricao,
    } : undefined,
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId, perfil } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  if (perfil !== UsuarioPerfil.ADMIN) {
    return NextResponse.json({ erro: 'Sem permissão para editar os dados da empresa.' }, { status: 403 })
  }

  let body: {
    nome?: string; cnpj?: string; setor?: string; cidade?: string; uf?: string
    contatoNome?: string; contatoEmail?: string; contatoTelefone?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const { nome, cnpj, setor, cidade, uf, contatoNome, contatoEmail, contatoTelefone } = body

  if (nome != null && !nome.trim()) {
    return NextResponse.json({ erro: 'Nome da empresa não pode ficar vazio.' }, { status: 400 })
  }
  if (contatoEmail != null && contatoEmail && !/^\S+@\S+\.\S+$/.test(contatoEmail)) {
    return NextResponse.json({ erro: 'E-mail de contato inválido.' }, { status: 400 })
  }

  const atualizado = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(nome != null && { nome: nome.trim() }),
      ...(cnpj !== undefined && { cnpj: cnpj?.trim() || null }),
      ...(setor !== undefined && { setor: setor?.trim() || null }),
      ...(cidade !== undefined && { cidade: cidade?.trim() || null }),
      ...(uf !== undefined && { uf: uf?.trim() || null }),
      ...(contatoNome !== undefined && { contatoNome: contatoNome?.trim() || null }),
      ...(contatoEmail !== undefined && { contatoEmail: contatoEmail?.trim() || null }),
      ...(contatoTelefone !== undefined && { contatoTelefone: contatoTelefone?.trim() || null }),
    },
    select: {
      id: true, nome: true, cnpj: true, setor: true, cidade: true, uf: true,
      contatoNome: true, contatoEmail: true, contatoTelefone: true,
    },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.EMPRESA,
    mensagem:  'Dados da empresa atualizados',
    detalhe:   body,
    ipAddress, userAgent,
  })

  return NextResponse.json(atualizado)
}
