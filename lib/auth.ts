// src/lib/auth.ts
// Utilitários de autenticação — JWT, senha, tenant guard

import { TenantStatus, UsuarioPerfil, UsuarioStatus, ProjetoAcessoNivel } from '@/lib/prisma-enums'

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

// ── Payload do JWT ──────────────────────────────────────────
export interface JwtPayload {
  usuarioId: string
  tenantId:  string
  perfil:    UsuarioPerfil
  iat?:      number
  exp?:      number
}

// ── Geração / verificação ───────────────────────────────────
export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

// ── Token de recuperação de senha (stateless, curta duração) ─
export interface ResetSenhaPayload {
  usuarioId: string
  tipo:      'reset_senha'
  iat?:      number
  exp?:      number
}

export function signResetToken(usuarioId: string): string {
  return jwt.sign({ usuarioId, tipo: 'reset_senha' }, JWT_SECRET, { expiresIn: '1h' })
}

export function verifyResetToken(token: string): ResetSenhaPayload {
  const payload = jwt.verify(token, JWT_SECRET) as ResetSenhaPayload
  if (payload.tipo !== 'reset_senha') throw new Error('Token inválido para esta operação.')
  return payload
}

// ── Hash de senha ───────────────────────────────────────────
export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}
export async function verificarSenha(
  senha: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

// ── Extrair token do header ─────────────────────────────────
export function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}

// ── Guard principal — usado em todos os endpoints /api/app/* ─
export interface Permissoes {
  emitirRdo:         boolean
  aprovarRdo:        boolean
  gerenciarProjetos: boolean
  gerenciarEquipe:   boolean
  verRelatorios:     boolean
  gerenciarTarefas:  boolean
}

export interface AuthContext {
  usuarioId:  string
  tenantId:   string
  perfil:     UsuarioPerfil
  permissoes: Permissoes
}

export async function requireAuth(
  req: NextRequest,
): Promise<{ ctx: AuthContext } | { error: NextResponse }> {
  const token = extractToken(req)

  if (!token) {
    return {
      error: NextResponse.json(
        { erro: 'Token não informado.' },
        { status: 401 },
      ),
    }
  }

  let payload: JwtPayload
  try {
    payload = verifyToken(token)
  } catch {
    return {
      error: NextResponse.json(
        { erro: 'Token inválido ou expirado.' },
        { status: 401 },
      ),
    }
  }

  // Verifica se o tenant ainda está ativo
  const tenant = await prisma.tenant.findUnique({
    where:  { id: payload.tenantId },
    select: { status: true, limiteRdosMes: true },
  })

  if (!tenant) {
    return {
      error: NextResponse.json(
        { erro: 'Empresa não encontrada.' },
        { status: 403 },
      ),
    }
  }

  if (tenant.status === TenantStatus.SUSPENSO) {
    return {
      error: NextResponse.json(
        { erro: 'Acesso suspenso. Entre em contato com o suporte.' },
        { status: 403 },
      ),
    }
  }

  if (tenant.status === TenantStatus.AGUARDANDO) {
    return {
      error: NextResponse.json(
        { erro: 'Empresa aguardando ativação pelo administrador.' },
        { status: 403 },
      ),
    }
  }

  // Verifica se o usuário ainda está ativo — e busca perfil/permissões
  // SEMPRE frescos do banco (não confia no snapshot do JWT), assim uma
  // troca de perfil/permissão feita por um admin já vale na próxima
  // requisição, sem esperar o token expirar.
  const usuario = await prisma.usuario.findUnique({
    where:  { id: payload.usuarioId },
    select: {
      status: true, perfil: true,
      permEmitirRdo: true, permAprovarRdo: true,
      permGerenciarProjetos: true, permGerenciarEquipe: true, permVerRelatorios: true,
      permGerenciarTarefas: true,
    },
  })

  if (!usuario || usuario.status !== UsuarioStatus.ATIVO) {
    return {
      error: NextResponse.json(
        { erro: 'Usuário inativo.' },
        { status: 403 },
      ),
    }
  }

  return {
    ctx: {
      usuarioId: payload.usuarioId,
      tenantId:  payload.tenantId,
      perfil:    usuario.perfil,
      permissoes: {
        emitirRdo:         usuario.permEmitirRdo,
        aprovarRdo:        usuario.permAprovarRdo,
        gerenciarProjetos: usuario.permGerenciarProjetos,
        gerenciarEquipe:   usuario.permGerenciarEquipe,
        verRelatorios:     usuario.permVerRelatorios,
        gerenciarTarefas:  usuario.permGerenciarTarefas,
      },
    },
  }
}

// ── Verificação de permissão ──────────────────────────────────
// ADMIN sempre tem tudo liberado; PERSONALIZADO depende das flags marcadas
// pelo administrador da empresa em /usuarios.
type CtxPerm = Pick<AuthContext, 'perfil' | 'permissoes'>

export function podeEmitirRdo(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.emitirRdo
}

export function podeAprovarRdo(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.aprovarRdo
}

export function podeGerenciarProjetos(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.gerenciarProjetos
}

export function podeGerenciarEquipe(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.gerenciarEquipe
}

export function podeVerRelatorios(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.verRelatorios
}

export function podeGerenciarTarefas(ctx: CtxPerm): boolean {
  return ctx.perfil === UsuarioPerfil.ADMIN || ctx.permissoes.gerenciarTarefas
}

// ── Acesso por projeto (pasta do projeto) ────────────────────
// null = sem restrição configurada para o projeto (comportamento padrão,
// visível/editável por todo o tenant) ou usuário que já gerencia todos os
// projetos (ADMIN, ou PERSONALIZADO com permGerenciarProjetos — sempre bypassa).
export type AcessoProjetoResultado = ProjetoAcessoNivel | 'SEM_ACESSO' | null

export async function resolverAcessoProjeto(
  projetoId: string,
  ctx: Pick<AuthContext, 'usuarioId' | 'perfil' | 'permissoes'>,
): Promise<AcessoProjetoResultado> {
  if (podeGerenciarProjetos(ctx)) return null // gerencia todos os projetos — bypassa

  const acessos = await prisma.projetoAcesso.findMany({
    where:  { projetoId },
    select: { usuarioId: true, nivel: true },
  })

  if (acessos.length === 0) return null // projeto sem restrição configurada

  const meu = acessos.find((a: any) => a.usuarioId === ctx.usuarioId)
  return meu ? (meu.nivel as ProjetoAcessoNivel) : 'SEM_ACESSO'
}

export function podeVerProjeto(acesso: AcessoProjetoResultado): boolean {
  return acesso !== 'SEM_ACESSO'
}

export function podeEditarProjetoConteudo(acesso: AcessoProjetoResultado): boolean {
  return acesso === null || acesso === ProjetoAcessoNivel.EDITAR || acesso === ProjetoAcessoNivel.GERENCIAMENTO
}

export function podeGerenciarProjeto(acesso: AcessoProjetoResultado): boolean {
  return acesso === null || acesso === ProjetoAcessoNivel.GERENCIAMENTO
}
