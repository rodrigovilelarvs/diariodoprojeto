// src/api/admin/tenants/route.ts
// GET  /api/admin/tenants  — listar todas as empresas
// POST /api/admin/tenants  — criar nova empresa

import { LogCategoria, PlanoTipo, TenantStatus, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-admin'
import { precosDosPlanos } from '@/lib/planos'
import { hashSenha } from '@/lib/auth'
import { addDays } from 'date-fns'
import type { Tenant } from '@/lib/types'

// `prisma` não carrega os tipos gerados do Prisma Client neste projeto (ver
// lib/prisma.ts) — rdosMes/alertas só existem depois do Promise.all abaixo.
type TenantRow = Omit<Tenant, 'rdosMes' | 'alertas'>

// ── GET — listar empresas ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')  as TenantStatus | null
  const plano   = searchParams.get('plano')   as PlanoTipo    | null
  const busca   = searchParams.get('busca')   ?? undefined
  const pagina  = Number(searchParams.get('pagina') ?? 1)
  const por     = Number(searchParams.get('por')    ?? 50)

  const tenants: TenantRow[] = await prisma.tenant.findMany({
    where: {
      ...(status ? { status }          : {}),
      ...(plano  ? { plano }           : {}),
      ...(busca  ? {
        OR: [
          { nome:  { contains: busca, mode: 'insensitive' } },
          { cnpj:  { contains: busca } },
          { usuarios: { some: { email: { contains: busca, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    include: {
      _count: {
        select: {
          // Só usuários ATIVOS: é a contagem que a trava de novos cadastros usa
          // (app/api/app/usuarios). Inativos e convites pendentes não ocupam vaga.
          usuarios: { where: { status: UsuarioStatus.ATIVO } },
          projetos: true,
          logs:     true,
        },
      },
      usuarios: {
        where:   { perfil: UsuarioPerfil.ADMIN },
        orderBy: { criadoEm: 'asc' },
        take:    1,
        select:  { id: true, nome: true, email: true, telefone: true, status: true },
      },
    },
    orderBy: { criadoEm: 'desc' },
    skip:    (pagina - 1) * por,
    take:    por,
  })

  // Adiciona contagem de RDOs do mês corrente para cada tenant
  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const tenantsComRdos: Tenant[] = await Promise.all(
    tenants.map(async (t) => {
      const rdosMes = await prisma.rdo.count({
        where: {
          projeto:  { tenantId: t.id },
          criadoEm: { gte: inicioMes },
        },
      })

      // Alertas não resolvidos desta empresa
      const alertas = await prisma.logAuditoria.count({
        where: {
          tenantId:  t.id,
          nivel:     { in: ['ERRO', 'CRITICO'] },
          resolvido: false,
        },
      })

      return { ...t, rdosMes, alertas }
    }),
  )

  const total = await prisma.tenant.count({
    where: {
      ...(status ? { status } : {}),
      ...(plano  ? { plano }  : {}),
    },
  })

  // Resumo geral para o dashboard
  const PRECO_PLANO = await precosDosPlanos()
  const resumo = {
    total,
    ativos:     tenants.filter((t) => t.status === 'ATIVO').length,
    aguardando: tenants.filter((t) => t.status === 'AGUARDANDO').length,
    suspensos:  tenants.filter((t) => t.status === 'SUSPENSO').length,
    mrr: tenants.reduce((acc, t) => acc + (PRECO_PLANO[t.plano] ?? 0), 0),
  }

  return NextResponse.json({ tenants: tenantsComRdos, total, pagina, por, resumo })
}

// ── POST — criar empresa ──────────────────────────────────────
import { enviarEmailSeguro, enviarBoasVindasEmpresa } from '@/lib/email'
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { adminId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: {
    nome:        string
    cnpj?:       string
    setor?:      string
    cidade?:     string
    uf?:         string
    admNome:     string
    admEmail:    string
    admTelefone?: string
    senha?:      string
    plano:       PlanoTipo
    obsInterna?: string
    dataVencimentoPlano?: string
    ativarImediatamente?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  const {
    nome, setor, cidade, uf,
    admNome, admEmail,
    admTelefone,
    senha,
    plano = PlanoTipo.STARTER,
    obsInterna,
    dataVencimentoPlano,
    ativarImediatamente = false,
  } = body

  // Campo opcional e único no banco — string vazia precisa virar undefined
  // (senão a 2ª empresa sem CNPJ colide com a 1ª na constraint @unique)
  const cnpj = body.cnpj?.trim() || undefined

  // Validações
  if (!nome)     return NextResponse.json({ erro: 'Nome é obrigatório.'     }, { status: 400 })
  if (!admNome)  return NextResponse.json({ erro: 'Nome do admin é obrigatório.'  }, { status: 400 })
  if (!admEmail) return NextResponse.json({ erro: 'E-mail do admin é obrigatório.' }, { status: 400 })
  if (senha && senha.length < 8) {
    return NextResponse.json({ erro: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
  }

  // E-mail já em uso?
  const emailExiste = await prisma.usuario.findFirst({
    where: { email: admEmail.toLowerCase() },
  })
  if (emailExiste) {
    return NextResponse.json(
      { erro: 'Já existe um usuário com esse e-mail.' },
      { status: 409 },
    )
  }

  // CNPJ duplicado?
  if (cnpj) {
    const cnpjExiste = await prisma.tenant.findUnique({ where: { cnpj } })
    if (cnpjExiste) {
      return NextResponse.json(
        { erro: 'CNPJ já cadastrado.' },
        { status: 409 },
      )
    }
  }

  // Busca limites do plano escolhido
  const planoConfig = await prisma.planoConfig.findUnique({
    where: { tipo: plano },
  })

  const limites = {
    limiteUsuarios: planoConfig?.limiteUsuarios ?? 3,
    limiteRdosMes:  planoConfig?.limiteRdosMes  ?? 30,
    limiteProjetos: planoConfig?.limiteProjetos ?? 2,
  }

  // Se uma senha inicial foi definida, a conta já nasce ativa e pronta pra
  // logar — sem depender do envio de convite por e-mail.
  const senhaHash = senha ? await hashSenha(senha) : undefined

  // Cria tenant + usuário admin + convite (só quando não há senha) numa transação
  const resultado = await prisma.$transaction(async (tx: any) => {
    // 1. Tenant
    const tenant = await tx.tenant.create({
      data: {
        nome,
        cnpj,
        setor:       setor       ?? undefined,
        cidade:      cidade      ?? undefined,
        uf:          uf          ?? undefined,
        plano,
        status:      ativarImediatamente
          ? TenantStatus.ATIVO
          : TenantStatus.AGUARDANDO,
        ativadoEm:   ativarImediatamente ? new Date() : undefined,
        obsInterna:  obsInterna  ?? undefined,
        dataVencimentoPlano: dataVencimentoPlano ? new Date(dataVencimentoPlano) : undefined,
        ...limites,
      },
    })

    // 2. Usuário admin — com senha já definida (ATIVO) ou aguardando convite
    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome:     admNome,
        email:    admEmail.toLowerCase(),
        telefone: admTelefone ?? undefined,
        perfil:   UsuarioPerfil.ADMIN,
        senha:    senhaHash,
        status:   senhaHash ? UsuarioStatus.ATIVO : UsuarioStatus.CONVIDADO,
      },
    })

    // 3. Convite com 7 dias de validade — só faz sentido se ainda não tem senha
    const convite = senhaHash ? null : await tx.convite.create({
      data: {
        tenantId:   tenant.id,
        email:      admEmail.toLowerCase(),
        perfil:     UsuarioPerfil.ADMIN,
        expiradoEm: addDays(new Date(), 7),
      },
    })

    return { tenant, usuario, convite }
  })

  // Envia e-mail de boas-vindas com link de criação de senha — só quando a
  // conta depende do convite (se já veio com senha, o admin já pode logar)
  const convite = resultado.convite
  if (convite) {
    await enviarEmailSeguro(() => enviarBoasVindasEmpresa({
      email:       admEmail,
      nomeAdmin:   admNome,
      nomeEmpresa: nome,
      plano,
      precoMensal: Number(planoConfig?.precoMensal ?? 0),
      token:       convite.token,
    }))
  }

  await registrarLog({
    categoria: LogCategoria.EMPRESA,
    mensagem:  `Empresa "${nome}" criada (plano ${plano})`,
    detalhe:   {
      tenantId:  resultado.tenant.id,
      admEmail,
      plano,
      ativadoImediatamente: ativarImediatamente,
      adminId,
    },
    ipAddress,
    userAgent,
  })

  return NextResponse.json(
    {
      tenant:  resultado.tenant,
      usuario: { id: resultado.usuario.id, email: resultado.usuario.email },
      senhaDefinida: !!senhaHash, // true = já pode logar direto, sem convite
      convite: convite ? {
        token:      convite.token,
        expiradoEm: convite.expiradoEm,
      } : null,
      emailEnviado: !!convite, // e-mail só é enviado quando há convite
    },
    { status: 201 },
  )
}
