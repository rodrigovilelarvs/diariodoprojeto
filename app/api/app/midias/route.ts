// app/api/app/midias/route.ts
// POST /api/app/midias  — registra mídia no banco após upload no Storage
// PATCH /api/app/midias?id= — atualiza a descrição/legenda
// DELETE /api/app/midias?id= — remove do banco e do Storage

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog } from '@/lib/prisma'
import { requireAuth, podeEmitirRdo, resolverAcessoProjeto, podeEditarProjetoConteudo, type AuthContext } from '@/lib/auth'
import { LogCategoria, MidiaTipo, RdoStatus } from '@/lib/prisma-enums'
import { supabaseAdmin } from '@/lib/storage'

// Mídia é conteúdo do RDO: adicionar, legendar e remover seguem exatamente a
// mesma regra de editar o RDO (ver PATCH em rdos/[id]/route.ts) — quem emite,
// com permissão de edição no projeto, e nunca num RDO já aprovado (registro
// assinado, que não pode mais mudar nem perder evidência).
async function bloquearEdicaoDeMidia(
  ctx: AuthContext,
  rdo: { projetoId: string; status: string },
): Promise<NextResponse | null> {
  const acesso = await resolverAcessoProjeto(rdo.projetoId, ctx)
  if (!podeEditarProjetoConteudo(acesso)) {
    return NextResponse.json({ erro: 'Você não tem permissão de edição neste projeto.' }, { status: 403 })
  }
  if (rdo.status === RdoStatus.APROVADO) {
    return NextResponse.json({ erro: 'RDO aprovado não pode ser editado.' }, { status: 400 })
  }
  return null
}

// O upload vai direto do navegador pro Storage (lib/storage.ts) no caminho
// `<tenantId>/<rdoId>/<arquivo>` e depois registra a URL aqui. O servidor não
// pode confiar nessa URL: na exclusão ela vira um caminho apagado com a chave
// de serviço, então uma URL apontando pra pasta de OUTRA empresa faria o
// servidor destruir arquivo alheio. Por isso só aceita https e a pasta do
// próprio tenant/RDO, e a exclusão só toca em arquivo dentro da pasta do tenant.
function caminhoNoBucket(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    const [, depois] = u.pathname.split('/rdos-midias/')
    return depois ? decodeURIComponent(depois) : null
  } catch {
    return null
  }
}

const SEM_PERMISSAO = () => NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId, usuarioId } = auth.ctx
  if (!podeEmitirRdo(auth.ctx)) return SEM_PERMISSAO()

  let body: {
    rdoId: string; tipo: string; nomeArq: string; url: string
    tamanhoBytes?: number; descricao?: string; ordem?: number
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }) }

  const rdo = await prisma.rdo.findFirst({
    where: { id: body.rdoId, projeto: { tenantId } }, select: { id: true, projetoId: true, status: true },
  })
  if (!rdo) return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  const bloqueio = await bloquearEdicaoDeMidia(auth.ctx, rdo)
  if (bloqueio) return bloqueio

  if (!Object.values(MidiaTipo).includes(body.tipo as MidiaTipo) || typeof body.nomeArq !== 'string' || !body.nomeArq.trim()) {
    return NextResponse.json({ erro: 'Tipo ou nome do arquivo inválido.' }, { status: 400 })
  }
  const caminho = caminhoNoBucket(body.url)
  if (!caminho || !caminho.startsWith(`${tenantId}/${body.rdoId}/`)) {
    return NextResponse.json({ erro: 'URL da mídia inválida.' }, { status: 400 })
  }

  const midia = await prisma.midia.create({
    data: {
      rdoId: body.rdoId, tipo: body.tipo, nomeArq: body.nomeArq,
      url: body.url, tamanhoBytes: body.tamanhoBytes,
      descricao: body.descricao, ordem: body.ordem ?? 0,
    },
  })

  await registrarLog({
    tenantId, usuarioId, categoria: LogCategoria.RDO,
    mensagem: `Mídia "${body.nomeArq}" adicionada ao RDO`,
    detalhe: { midiaId: midia.id, rdoId: body.rdoId, tipo: body.tipo },
  })

  return NextResponse.json(midia, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId } = auth.ctx
  if (!podeEmitirRdo(auth.ctx)) return SEM_PERMISSAO()
  const midiaId = new URL(req.url).searchParams.get('id')
  if (!midiaId) return NextResponse.json({ erro: 'id obrigatório.' }, { status: 400 })

  let body: { descricao?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }) }

  const midia = await prisma.midia.findFirst({
    where: { id: midiaId, rdo: { projeto: { tenantId } } },
    include: { rdo: { select: { projetoId: true, status: true } } },
  })
  if (!midia) return NextResponse.json({ erro: 'Mídia não encontrada.' }, { status: 404 })
  const bloqueio = await bloquearEdicaoDeMidia(auth.ctx, midia.rdo)
  if (bloqueio) return bloqueio

  const atualizada = await prisma.midia.update({
    where: { id: midiaId },
    data:  { descricao: body.descricao ?? '' },
  })

  return NextResponse.json(atualizada)
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { tenantId, usuarioId } = auth.ctx
  if (!podeEmitirRdo(auth.ctx)) return SEM_PERMISSAO()
  const midiaId = new URL(req.url).searchParams.get('id')
  if (!midiaId) return NextResponse.json({ erro: 'id obrigatório.' }, { status: 400 })

  const midia = await prisma.midia.findFirst({
    where: { id: midiaId, rdo: { projeto: { tenantId } } },
    include: { rdo: { select: { projetoId: true, status: true } } },
  })
  if (!midia) return NextResponse.json({ erro: 'Mídia não encontrada.' }, { status: 404 })
  const bloqueio = await bloquearEdicaoDeMidia(auth.ctx, midia.rdo)
  if (bloqueio) return bloqueio

  try {
    const path = caminhoNoBucket(midia.url)
    if (path && path.startsWith(`${tenantId}/`)) {
      await supabaseAdmin().storage.from('rdos-midias').remove([path])
    }
  } catch { /* ignora erro storage */ }

  await prisma.midia.delete({ where: { id: midiaId } })
  await registrarLog({
    tenantId, usuarioId, categoria: LogCategoria.RDO,
    mensagem: `Mídia "${midia.nomeArq}" removida`,
    detalhe: { midiaId, rdoId: midia.rdoId },
  })

  return NextResponse.json({ ok: true })
}
