// app/api/app/rdos/[id]/reabrir/route.ts
// POST /api/app/rdos/:id/reabrir — volta um RDO enviado/aprovado/a revisar para rascunho, para
// permitir correções (ex: legenda de foto esquecida). Reseta as assinaturas — precisa ser
// reaprovado do zero após as correções.
// Quem pode: quem aprova RDOs (qualquer status) ou quem emitiu o RDO (enquanto não aprovado).

import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth, podeAprovarRdo, podeEmitirRdo } from '@/lib/auth'
import { RdoStatus, AssinaturaStatus, LogCategoria, LogNivel } from '@/lib/prisma-enums'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)
  const rdoId = (await params).id

  const rdo = await prisma.rdo.findFirst({
    where: { id: rdoId, projeto: { tenantId } },
  })

  if (!rdo) {
    return NextResponse.json({ erro: 'RDO não encontrado.' }, { status: 404 })
  }

  const ehEmissor = podeEmitirRdo(auth.ctx) && rdo.emissorId === usuarioId
  const podeVoltar = podeAprovarRdo(auth.ctx) || (ehEmissor && rdo.status !== RdoStatus.APROVADO)
  if (!podeVoltar) {
    return NextResponse.json(
      {
        erro: ehEmissor
          ? 'Um RDO aprovado só pode ser voltado para rascunho por quem aprova RDOs.'
          : 'Sem permissão para voltar este RDO para rascunho.',
      },
      { status: 403 },
    )
  }

  if (rdo.status === RdoStatus.RASCUNHO) {
    return NextResponse.json({ erro: 'Este RDO já está em rascunho.' }, { status: 400 })
  }

  const statusAnterior = rdo.status

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.rdo.update({
      where: { id: rdoId },
      data:  { status: RdoStatus.RASCUNHO, enviadoEm: null },
    })

    // Reseta as assinaturas — o RDO precisa ser reaprovado do zero após as
    // correções. Precisa limpar assinaturaDigitalId também — sem isso, a
    // assinatura antiga ficava "grudada" no registro mesmo com status
    // voltando pra PENDENTE, e a pré-visualização continuava mostrando a
    // assinatura como se já estivesse assinada de novo.
    await tx.assinatura.updateMany({
      where: { rdoId },
      data: {
        status:              AssinaturaStatus.PENDENTE,
        assinadoEm:          null,
        assinaturaDigitalId: null,
        ipAddress:           null,
        userAgent:           null,
      },
    })
  })

  await registrarLog({
    tenantId,
    usuarioId,
    nivel:     LogNivel.ERRO,
    categoria: LogCategoria.RDO,
    mensagem:  `RDO #${rdo.numero} voltou para rascunho (estava ${statusAnterior}) — assinaturas resetadas`,
    detalhe:   { rdoId, statusAnterior },
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ ok: true, status: RdoStatus.RASCUNHO })
}
