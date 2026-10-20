// lib/acesso-convite.ts
// Acesso a projetos escolhido já na criação do usuário (convite ou cadastro direto).
//
// Quem convida marca "só os projetos selecionados" e, para cada um, o nível de acesso.
// No cadastro direto isso vira ProjetoAcesso na hora; no convite fica guardado no próprio
// convite (Convite.projetosAcesso) e é aplicado quando a pessoa aceita — assim ela nunca
// chega a enxergar os projetos que não foram liberados.

import { ProjetoAcessoNivel, UsuarioPerfil } from '@/lib/prisma-enums'
import { prisma } from '@/lib/prisma'

export type AcessoProjetoEscolhido = { projetoId: string; nivel: ProjetoAcessoNivel }

const NIVEIS = Object.values(ProjetoAcessoNivel) as string[]

// Quem é ADMIN ou gerencia projetos já enxerga todos — a restrição não se aplica
export function restricaoNaoSeAplica(perfil: string, permGerenciarProjetos: boolean): boolean {
  return perfil === UsuarioPerfil.ADMIN || permGerenciarProjetos
}

// Lê o JSON guardado no convite (ou vindo do corpo da requisição), descartando o que não for válido
export function lerAcessos(bruto: unknown): AcessoProjetoEscolhido[] {
  if (!Array.isArray(bruto)) return []
  const vistos = new Set<string>()
  const lista: AcessoProjetoEscolhido[] = []
  for (const item of bruto) {
    const projetoId = (item as { projetoId?: unknown })?.projetoId
    const nivel = (item as { nivel?: unknown })?.nivel
    if (typeof projetoId !== 'string' || typeof nivel !== 'string' || !NIVEIS.includes(nivel) || vistos.has(projetoId)) continue
    vistos.add(projetoId)
    lista.push({ projetoId, nivel: nivel as ProjetoAcessoNivel })
  }
  return lista
}

// Mantém só projetos que existem nesta empresa
export async function acessosDaEmpresa(tenantId: string, acessos: AcessoProjetoEscolhido[]): Promise<AcessoProjetoEscolhido[]> {
  if (acessos.length === 0) return []
  const validos: Array<{ id: string }> = await prisma.projeto.findMany({
    where:  { tenantId, id: { in: acessos.map((a) => a.projetoId) } },
    select: { id: true },
  })
  const ids = new Set(validos.map((p) => p.id))
  return acessos.filter((a) => ids.has(a.projetoId))
}

export async function concederAcessos(usuarioId: string, acessos: AcessoProjetoEscolhido[]): Promise<void> {
  for (const a of acessos) {
    await prisma.projetoAcesso.upsert({
      where:  { projetoId_usuarioId: { projetoId: a.projetoId, usuarioId } },
      update: { nivel: a.nivel },
      create: { projetoId: a.projetoId, usuarioId, nivel: a.nivel },
    })
  }
}
