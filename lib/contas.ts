// src/lib/contas.ts
// Regras compartilhadas de "o mesmo e-mail em mais de uma empresa".
//
// Cada empresa tem a sua conta (Usuario) do e-mail, com perfil e permissões
// próprios; a SENHA é uma só por e-mail. Isso é mantido assim:
//   - a senha é gravada igual (mesmo hash) em todas as contas do e-mail;
//   - trocar a senha atualiza as contas que compartilham a credencial;
//   - "Esqueci a senha" (link enviado ao e-mail, que prova a posse dele)
//     atualiza todas as contas do e-mail;
//   - aceitar um convite pra um e-mail que já tem senha exige a senha atual
//     e reaproveita a mesma credencial (não cria uma nova).
//
// Contas do mesmo e-mail com credenciais DIFERENTES (ex.: cadastradas direto
// por um administrador com senha própria) não se misturam: só passa de uma
// pra outra quem digita a senha da conta de destino. Sem essa regra, quem
// controlasse uma conta cadastrada com o e-mail de outra pessoa pularia pra
// conta dela em outra empresa.

import { LogCategoria, LogNivel, TenantStatus, UsuarioPerfil, UsuarioStatus } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export const MAX_TENTATIVAS = 5   // falhas de senha por IP antes do bloqueio temporário
export const BLOQUEIO_MINUTOS = 30

// Falhas de login/senha recentes deste IP (as rotas que conferem senha
// registram um log AVISO/LOGIN a cada erro — é essa contagem que bloqueia).
export async function falhasRecentesDoIp(ipAddress: string): Promise<number> {
  return prisma.logAuditoria.count({
    where: {
      ipAddress,
      categoria: LogCategoria.LOGIN,
      nivel:     LogNivel.AVISO,
      criadoEm:  { gte: new Date(Date.now() - BLOQUEIO_MINUTOS * 60 * 1000) },
    },
  })
}

export type ContaSessao = {
  id: string; tenantId: string; nome: string; email: string; funcao: string | null
  perfil: UsuarioPerfil; avatarUrl: string | null
  permEmitirRdo: boolean; permAprovarRdo: boolean
  permGerenciarProjetos: boolean; permGerenciarEquipe: boolean; permVerRelatorios: boolean
  permGerenciarTarefas: boolean
}

// Resposta de quem acabou de entrar numa empresa (login, convite aceito, troca de empresa)
export function respostaDeSessao(conta: ContaSessao, tenant: { id: string; nome: string }) {
  const token = signToken({ usuarioId: conta.id, tenantId: conta.tenantId, perfil: conta.perfil })
  return {
    token,
    usuario: {
      id:       conta.id,
      nome:     conta.nome,
      email:    conta.email,
      funcao:   conta.funcao,
      perfil:   conta.perfil,
      permEmitirRdo: conta.permEmitirRdo, permAprovarRdo: conta.permAprovarRdo,
      permGerenciarProjetos: conta.permGerenciarProjetos,
      permGerenciarEquipe: conta.permGerenciarEquipe, permVerRelatorios: conta.permVerRelatorios,
      permGerenciarTarefas: conta.permGerenciarTarefas,
      avatarUrl: conta.avatarUrl,
    },
    tenant: { id: tenant.id, nome: tenant.nome },
  }
}

// Por que uma conta (já com a senha confirmada) não pode entrar agora; null = pode.
export function motivoDeBloqueio(conta: {
  status: UsuarioStatus
  tenant: { status: TenantStatus }
}): { erro: string; status: number } | null {
  if (conta.tenant.status === TenantStatus.SUSPENSO) {
    return { erro: 'Acesso suspenso. Entre em contato com o suporte.', status: 403 }
  }
  if (conta.tenant.status === TenantStatus.AGUARDANDO) {
    return { erro: 'Empresa aguardando ativação. Em breve você receberá um e-mail.', status: 403 }
  }
  if (conta.status !== UsuarioStatus.ATIVO) {
    return { erro: 'Usuário inativo. Contate o administrador da sua empresa.', status: 403 }
  }
  return null
}
