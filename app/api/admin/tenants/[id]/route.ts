// src/api/admin/tenants/[id]/route.ts
// GET    /api/admin/tenants/:id  — detalhe completo da empresa
// PATCH  /api/admin/tenants/:id  — editar dados / status / obs interna
// DELETE /api/admin/tenants/:id  — excluir empresa (irreversível)

import { LogCategoria, LogNivel, TenantStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
import { hashSenha } from '@/lib/auth'
type Params = { params: Promise<{ id: string }> }

// ── GET — detalhe completo ────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const tenant = await prisma.tenant.findUnique({
    where:   { id: (await params).id },
    include: {
      usuarios: {
        select: {
          id:            true,
          nome:          true,
          email:         true,
          perfil:        true,
          status:        true,
          ultimoAcessoEm: true,
        },
        orderBy: { nome: 'asc' },
      },
      projetos: {
        select: {
          id:     true,
          nome:   true,
          status: true,
          _count: { select: { rdos: true } },
        },
      },
      convites: {
        where:  { aceitoEm: null, expiradoEm: { gt: new Date() } },
        select: { id: true, email: true, perfil: true, expiradoEm: true },
      },
      _count: {
        select: { usuarios: true, projetos: true, logs: true },
      },
    },
  })

  if (!tenant) {
    return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }

  // RDOs do mês
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const rdosMes = await prisma.rdo.count({
    where: { projeto: { tenantId: tenant.id }, criadoEm: { gte: inicioMes } },
  })

  // Últimos 10 logs desta empresa
  const logsRecentes = await prisma.logAuditoria.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { criadoEm: 'desc' },
    take:    10,
    select:  {
      id:        true,
      nivel:     true,
      categoria: true,
      mensagem:  true,
      criadoEm:  true,
      resolvido: true,
      usuario:   { select: { nome: true, email: true } },
    },
  })

  // Alertas abertos
  const alertasAbertos = await prisma.logAuditoria.count({
    where: {
      tenantId:  tenant.id,
      nivel:     { in: ['ERRO', 'CRITICO'] },
      resolvido: false,
    },
  })

  return NextResponse.json({
    ...tenant,
    rdosMes,
    logsRecentes,
    alertasAbertos,
    uso: {
      usuarios:  { atual: tenant._count.usuarios, limite: tenant.limiteUsuarios },
      rdosMes:   { atual: rdosMes,                limite: tenant.limiteRdosMes },
      projetos:  { atual: tenant._count.projetos, limite: tenant.limiteProjetos },
    },
  })
}

// ── PATCH — editar empresa ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { adminId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  const tenant = await prisma.tenant.findUnique({ where: { id: (await params).id } })
  if (!tenant) {
    return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const {
    nome, cnpj, setor, cidade, uf,
    status, obsInterna,
    dataVencimentoPlano,
    admNome, admEmail, admTelefone, admSenha,
    // Limites manuais (override do plano)
    limiteUsuarios, limiteRdosMes, limiteProjetos,
  } = body as any

  if (admSenha && String(admSenha).length < 8) {
    return NextResponse.json({ erro: 'A senha do responsável deve ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  // Se está ativando uma empresa AGUARDANDO
  const ativando =
    tenant.status === TenantStatus.AGUARDANDO &&
    status === TenantStatus.ATIVO

  // Se está suspendendo
  const suspendendo =
    tenant.status === TenantStatus.ATIVO &&
    status === TenantStatus.SUSPENSO

  const atualizado = await prisma.tenant.update({
    where: { id: (await params).id },
    data:  {
      ...(nome           != null && { nome:           String(nome) }),
      // CNPJ é @unique no banco — string vazia precisa virar null, senão a
      // 2ª empresa sem CNPJ colide com a 1ª na constraint de unicidade.
      ...(cnpj           != null && { cnpj:           String(cnpj).trim() || null }),
      ...(setor          != null && { setor:          String(setor) }),
      ...(cidade         != null && { cidade:         String(cidade) }),
      ...(uf             != null && { uf:             String(uf) }),
      ...(status         != null && { status:         status as TenantStatus }),
      ...(obsInterna     != null && { obsInterna:     String(obsInterna) }),
      ...(dataVencimentoPlano !== undefined && {
        dataVencimentoPlano: dataVencimentoPlano ? new Date(dataVencimentoPlano as string) : null,
      }),
      ...(limiteUsuarios != null && { limiteUsuarios: Number(limiteUsuarios) }),
      ...(limiteRdosMes  != null && { limiteRdosMes:  Number(limiteRdosMes) }),
      ...(limiteProjetos != null && { limiteProjetos: Number(limiteProjetos) }),
      // Registra data de ativação
      ...(ativando && { ativadoEm: new Date() }),
    },
  })

  // Atualiza os dados do responsável (primeiro ADMIN da empresa),
  // se algum desses campos foi enviado — inclusive redefinir a senha direto,
  // sem depender do fluxo de convite/recuperação.
  if (admNome != null || admEmail != null || admTelefone != null || admSenha) {
    const adminUsuario = await prisma.usuario.findFirst({
      where:   { tenantId: (await params).id, perfil: 'ADMIN' as any },
      orderBy: { criadoEm: 'asc' },
    })
    if (adminUsuario) {
      const novaSenhaHash = admSenha ? await hashSenha(String(admSenha)) : undefined
      await prisma.usuario.update({
        where: { id: adminUsuario.id },
        data: {
          ...(admNome     != null && { nome:     String(admNome) }),
          ...(admEmail    != null && { email:    String(admEmail).toLowerCase().trim() }),
          ...(admTelefone != null && { telefone: String(admTelefone).trim() || null }),
          ...(novaSenhaHash && { senha: novaSenhaHash, status: 'ATIVO' as any }),
        },
      })
    }
  }

  // Mensagem do log conforme ação
  let mensagem = `Empresa "${tenant.nome}" atualizada`
  let nivel    = LogNivel.INFO

  if (ativando) {
    mensagem = `Empresa "${tenant.nome}" ativada`
    // Envia e-mail de ativação
    if (ativando) {
      const admin = await prisma.usuario.findFirst({
        where: { tenantId: (await params).id, perfil: 'ADMIN' as any },
        select: { email: true, nome: true },
      })
      if (admin) {
        await enviarEmailSeguro(() => enviarEmpresaAtivada({
          email: admin.email, nomeAdmin: admin.nome, nomeEmpresa: tenant.nome,
        }))
      }
    }
  }

  if (suspendendo) {
    mensagem = `Empresa "${tenant.nome}" SUSPENSA`
    nivel    = LogNivel.AVISO
    if (suspendendo) {
      const admin = await prisma.usuario.findFirst({
        where: { tenantId: (await params).id, perfil: 'ADMIN' as any },
        select: { email: true, nome: true },
      })
      if (admin) {
        await enviarEmailSeguro(() => enviarEmpresaSuspensa({
          email: admin.email, nomeAdmin: admin.nome, nomeEmpresa: tenant.nome,
        }))
      }
    }
  }

  await registrarLog({
    tenantId:  (await params).id,
    nivel,
    categoria: LogCategoria.EMPRESA,
    mensagem,
    detalhe:   { alteracoes: body, adminId },
    ipAddress,
    userAgent,
  })

  return NextResponse.json(atualizado)
}

// ── DELETE — excluir empresa ──────────────────────────────────
import { enviarEmailSeguro, enviarEmpresaAtivada, enviarEmpresaSuspensa } from '@/lib/email'
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { adminId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  const tenant = await prisma.tenant.findUnique({
    where:  { id: (await params).id },
    select: { nome: true, status: true, _count: { select: { usuarios: true } } },
  })

  if (!tenant) {
    return NextResponse.json({ erro: 'Empresa não encontrada.' }, { status: 404 })
  }

  // Confirmação obrigatória no body
  let body: { confirmar?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (body.confirmar !== tenant.nome) {
    return NextResponse.json(
      {
        erro: `Para confirmar, envie { "confirmar": "${tenant.nome}" } no body.`,
        nomeDaEmpresa: tenant.nome,
      },
      { status: 400 },
    )
  }

  await registrarLog({
    nivel:     LogNivel.CRITICO,
    categoria: LogCategoria.EMPRESA,
    mensagem:  `Empresa "${tenant.nome}" EXCLUÍDA pelo super-admin`,
    detalhe:   { tenantId: (await params).id, adminId, usuariosAfetados: tenant._count.usuarios },
    ipAddress,
    userAgent,
  })

  // Cascade definido no schema — apaga tudo do tenant
  await prisma.tenant.delete({ where: { id: (await params).id } })

  return NextResponse.json({ ok: true, mensagem: `Empresa "${tenant.nome}" excluída.` })
}
