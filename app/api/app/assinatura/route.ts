// src/api/app/assinatura/route.ts
// GET  /api/app/assinatura — buscar minha assinatura digital cadastrada (se houver)
// POST /api/app/assinatura — cadastrar/atualizar minha assinatura digital

import { NextRequest, NextResponse } from 'next/server'
import { prisma, registrarLog, getRequestMeta } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { uploadAssinatura } from '@/lib/storage'
import { LogCategoria } from '@/lib/prisma-enums'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { usuarioId } = auth.ctx

  const assinatura = await prisma.assinaturaDigital.findUnique({
    where:  { usuarioId },
    select: { imagemUrl: true, atualizadoEm: true },
  })

  return NextResponse.json({ assinatura })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { tenantId, usuarioId } = auth.ctx
  const { ipAddress, userAgent } = getRequestMeta(req)

  let body: { imagemBase64?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 })
  }

  if (!body.imagemBase64) {
    return NextResponse.json({ erro: 'imagemBase64 é obrigatório.' }, { status: 400 })
  }

  let url: string, hashSha256: string
  try {
    ;({ url, hashSha256 } = await uploadAssinatura({
      tenantId, usuarioId, imagemBase64: body.imagemBase64,
    }))
  } catch (err: any) {
    console.error('[ASSINATURA] Falha no upload:', err)
    return NextResponse.json(
      { erro: err?.message ?? 'Falha ao enviar a assinatura para o armazenamento.' },
      { status: 500 },
    )
  }

  const assinatura = await prisma.assinaturaDigital.upsert({
    where:  { usuarioId },
    update: { imagemUrl: url, hashSha256 },
    create: { usuarioId, imagemUrl: url, hashSha256 },
  })

  await registrarLog({
    tenantId, usuarioId,
    categoria: LogCategoria.USUARIO,
    mensagem:  'Assinatura digital cadastrada/atualizada',
    ipAddress, userAgent,
  })

  return NextResponse.json({ assinatura: { imagemUrl: assinatura.imagemUrl, atualizadoEm: assinatura.atualizadoEm } })
}
