// src/lib/storage.ts
// Helper para upload/download de arquivos no Supabase Storage

import { createClient } from '@supabase/supabase-js'

// Client público (anon key) — para o browser
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Client server (service role) — apenas no servidor
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── Upload de mídia de RDO ───────────────────────────────────
export async function uploadMidia({
  tenantId,
  rdoId,
  file,
  onProgress,
}: {
  tenantId:    string
  rdoId:       string
  file:        File
  onProgress?: (pct: number) => void
}): Promise<{ url: string; path: string }> {
  // Path: tenantId/rdoId/timestamp-nome.ext
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${tenantId}/${rdoId}/${Date.now()}-${slugify(file.name)}.${ext}`

  const { error } = await supabase.storage
    .from('rdos-midias')
    .upload(path, file, {
      cacheControl: '3600',
      upsert:       false,
    })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  // URL pública com validade de 1 hora
  const { data } = supabase.storage
    .from('rdos-midias')
    .getPublicUrl(path)

  return { url: data.publicUrl, path }
}

// ── Upload de foto de projeto ────────────────────────────────
export async function uploadFotoProjeto({
  tenantId,
  projetoId,
  file,
}: {
  tenantId:  string
  projetoId: string
  file:      File
}): Promise<{ url: string }> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${tenantId}/${projetoId}/foto-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('projetos-fotos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert:       true,
    })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage
    .from('projetos-fotos')
    .getPublicUrl(path)

  return { url: data.publicUrl }
}

// ── Upload de foto de perfil (avatar) ────────────────────────
// Reaproveita o bucket "projetos-fotos" (já público) sob um prefixo próprio,
// em vez de exigir a criação de um bucket novo no Supabase só para isso.
export async function uploadAvatar({
  tenantId,
  usuarioId,
  file,
}: {
  tenantId:  string
  usuarioId: string
  file:      File
}): Promise<{ url: string }> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `_avatares/${tenantId}/${usuarioId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('projetos-fotos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert:       true,
    })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage
    .from('projetos-fotos')
    .getPublicUrl(path)

  return { url: data.publicUrl }
}

// ── Upload de assinatura digital ─────────────────────────────
export async function uploadAssinatura({
  tenantId,
  usuarioId,
  imagemBase64,
}: {
  tenantId:     string
  usuarioId:    string
  imagemBase64: string  // data:image/png;base64,...
}): Promise<{ url: string; hashSha256: string }> {
  // Converte base64 → Blob
  const base64 = imagemBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const blob   = new Blob([buffer], { type: 'image/png' })

  const path = `${tenantId}/${usuarioId}/assinatura.png`

  const { error } = await supabase.storage
    .from('assinaturas')
    .upload(path, blob, {
      contentType:  'image/png',
      cacheControl: '0',   // sem cache — assinatura pode ser atualizada
      upsert:       true,  // substitui se já existir
    })

  if (error) throw new Error(`Upload de assinatura falhou: ${error.message}`)

  const { data } = supabase.storage
    .from('assinaturas')
    .getPublicUrl(path)

  // Hash para integridade (calculado no servidor)
  const hashSha256 = await calcularHash(buffer)

  return { url: data.publicUrl, hashSha256 }
}

// ── Excluir arquivo ──────────────────────────────────────────
export async function excluirMidia(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('rdos-midias')
    .remove([path])

  if (error) console.error('Erro ao excluir mídia:', error)
}

// ── Helpers ──────────────────────────────────────────────────
function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

async function calcularHash(buffer: Buffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as unknown as ArrayBuffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
