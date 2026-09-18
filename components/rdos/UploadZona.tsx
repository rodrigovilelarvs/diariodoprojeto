'use client'
// components/rdos/UploadZona.tsx
// Zona de upload com barra de progresso, preview e remoção

import { useState, useRef, useCallback, useEffect, ChangeEvent } from 'react'
import { toast } from 'sonner'
import { useUploadMidia, useRemoverMidia, useAtualizarMidia } from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import type { MidiaItem } from '@/lib/types'

interface Props {
  rdoId:        string
  midiasIniciais: MidiaItem[]
  somenteLeitura?: boolean
}

interface UploadState {
  id:       string        // temporário antes de salvar
  nome:     string
  tipo:     'FOTO' | 'VIDEO' | 'ARQUIVO'
  url:      string        // blob URL para preview local
  progresso: number       // 0-100
  erro?:    string
  salvo:    boolean       // true = já no banco
  midiaId?: string        // ID no banco após salvar
  desc:     string
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB — mesmo limite já anunciado na zona de vídeo

const TIPO_ICONE: Record<string, string> = {
  FOTO: 'ti-camera', VIDEO: 'ti-video', ARQUIVO: 'ti-paperclip',
}
const TIPO_EMOJI: Record<string, string> = {
  FOTO: '📷', VIDEO: '🎥', ARQUIVO: '📄',
}

export function UploadZona({ rdoId, midiasIniciais, somenteLeitura }: Props) {
  const { session } = useAppAuth()
  const uploadMidia  = useUploadMidia()
  const removerMidia = useRemoverMidia()
  const atualizarMidia = useAtualizarMidia()

  // Estado local: mídias já salvas + uploads em andamento
  const [items, setItems] = useState<UploadState[]>(() =>
    midiasIniciais.map(m => ({
      id:        m.id,
      nome:      m.nomeArq,
      tipo:      m.tipo,
      url:       m.url,
      progresso: 100,
      salvo:     true,
      midiaId:   m.id,
      desc:      m.descricao ?? '',
    })),
  )

  const inputFotoRef = useRef<HTMLInputElement>(null)
  const inputVidRef  = useRef<HTMLInputElement>(null)
  const inputDocRef  = useRef<HTMLInputElement>(null)

  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const preview = previewIndex !== null ? items[previewIndex] : null

  const goPrev = useCallback(() => {
    setPreviewIndex(i => (i === null || items.length === 0) ? i : (i - 1 + items.length) % items.length)
  }, [items.length])
  const goNext = useCallback(() => {
    setPreviewIndex(i => (i === null || items.length === 0) ? i : (i + 1) % items.length)
  }, [items.length])

  useEffect(() => {
    if (previewIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     setPreviewIndex(null)
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewIndex, goPrev, goNext])

  const handleFiles = useCallback(async (files: File[], tipo: 'FOTO' | 'VIDEO' | 'ARQUIVO') => {
    if (!session?.tenantId) { toast.error('Sessão inválida.'); return }

    // Vídeo acima de 50MB nem entra na fila — evita upload longo pra depois
    // travar, e mantém o espaço de armazenamento (custo) sob controle.
    if (tipo === 'VIDEO') {
      const grandes = files.filter(f => f.size > MAX_VIDEO_BYTES)
      if (grandes.length > 0) {
        for (const f of grandes) {
          toast.error(`"${f.name}" tem ${(f.size / 1024 / 1024).toFixed(1)}MB — o limite é 50MB.`)
        }
        files = files.filter(f => f.size <= MAX_VIDEO_BYTES)
      }
      if (files.length === 0) return
    }

    for (const file of files) {
      const uid  = `tmp-${Date.now()}-${Math.random()}`
      const blob = URL.createObjectURL(file)

      // Adiciona item imediatamente para UI otimista
      setItems(prev => [...prev, {
        id: uid, nome: file.name, tipo, url: blob,
        progresso: 0, salvo: false, desc: '',
      }])

      try {
        const midia: any = await uploadMidia.mutateAsync({
          rdoId,
          tenantId: session.tenantId,
          file,
          onProgress: (pct) => {
            setItems(prev => prev.map(i =>
              i.id === uid ? { ...i, progresso: pct } : i,
            ))
          },
        })

        // Substitui item temporário pelo salvo
        setItems(prev => prev.map(i =>
          i.id === uid ? { ...i, id: midia.id, progresso: 100, salvo: true, midiaId: midia.id } : i,
        ))
        toast.success(`"${file.name}" enviado!`)
      } catch (err: any) {
        setItems(prev => prev.map(i =>
          i.id === uid ? { ...i, progresso: 0, erro: err.message ?? 'Erro no upload.' } : i,
        ))
        toast.error(err.message ?? `Erro ao enviar "${file.name}".`)
      }
    }
  }, [session, rdoId, uploadMidia])

  const onInput = (e: ChangeEvent<HTMLInputElement>, tipo: 'FOTO' | 'VIDEO' | 'ARQUIVO') => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) handleFiles(files, tipo)
    e.target.value = ''
  }

  async function handleSalvarDesc(item: UploadState, desc: string) {
    if (!item.salvo || !item.midiaId) return
    try {
      await atualizarMidia.mutateAsync({ midiaId: item.midiaId, rdoId, descricao: desc })
    } catch {
      toast.error('Erro ao salvar a legenda.')
    }
  }

  async function handleRemover(item: UploadState) {
    if (item.salvo && item.midiaId) {
      try {
        await removerMidia.mutateAsync({ midiaId: item.midiaId, rdoId })
        setItems(prev => prev.filter(i => i.id !== item.id))
        toast.success(`"${item.nome}" removida.`)
      } catch {
        toast.error('Erro ao remover arquivo.')
      }
    } else {
      // Upload com erro ou ainda em andamento — só remove do estado local
      URL.revokeObjectURL(item.url)
      setItems(prev => prev.filter(i => i.id !== item.id))
    }
  }

  const total      = items.length
  const enviando   = items.filter(i => !i.salvo && !i.erro && i.progresso > 0).length
  const comErro    = items.filter(i => !!i.erro).length

  return (
    <div>
      {/* ── Zonas de drop ── */}
      {!somenteLeitura && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { tipo: 'FOTO'    as const, ref: inputFotoRef, accept: 'image/*',     desc: 'JPG, PNG, HEIC'    },
            { tipo: 'VIDEO'   as const, ref: inputVidRef,  accept: 'video/*',     desc: 'MP4 · Máx. 50MB'  },
            { tipo: 'ARQUIVO' as const, ref: inputDocRef,  accept: '.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.csv,.zip', desc: 'PDF, DWG, DOCX...' },
          ].map(z => (
            <label key={z.tipo}
              className="up-zone"
              style={{ flex: 1, cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--ta)' }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '' }}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.style.borderColor = ''
                const files = Array.from(e.dataTransfer.files).filter(f => {
                  if (z.tipo === 'FOTO')    return f.type.startsWith('image/')
                  if (z.tipo === 'VIDEO')   return f.type.startsWith('video/')
                  return true
                })
                if (files.length) handleFiles(files, z.tipo)
              }}
            >
              <i className={`ti ${TIPO_ICONE[z.tipo]}`}
                style={{ fontSize: 20, color: 'var(--tm)', display: 'block', marginBottom: 3 }} />
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ts)' }}>
                {z.tipo === 'FOTO' ? 'Fotos' : z.tipo === 'VIDEO' ? 'Vídeos' : 'Arquivos'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 2 }}>{z.desc}</div>
              <input ref={z.ref} type="file" accept={z.accept} multiple style={{ display: 'none' }}
                onChange={e => onInput(e, z.tipo)} />
            </label>
          ))}
        </div>
      )}

      {/* ── Status bar ── */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--ts)' }}>
          <span>{total} item{total !== 1 ? 's' : ''}</span>
          {enviando > 0 && (
            <span style={{ color: 'var(--ta)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', fontSize: 12 }} />
              Enviando {enviando}...
            </span>
          )}
          {comErro > 0 && (
            <span style={{ color: 'var(--td)' }}>
              <i className="ti ti-alert-triangle" /> {comErro} com erro
            </span>
          )}
        </div>
      )}

      {/* ── Grid de itens ── */}
      {items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 22, color: 'var(--tm)', fontSize: 11,
          border: '1.5px dashed var(--b)', borderRadius: 'var(--r)', background: 'var(--s1)',
        }}>
          <i className="ti ti-photo" style={{ fontSize: 22, display: 'block', marginBottom: 6, opacity: .3 }} />
          {somenteLeitura ? 'Nenhum arquivo registrado.' : 'Arraste arquivos ou clique nas zonas acima.'}
        </div>
      ) : (
        <div className="midia-grid">
          {items.map((item, idx) => (
            <div key={item.id} className="midia-item" style={{ opacity: item.erro ? .7 : 1 }}>

              {/* Thumbnail */}
              <div className="midia-thumb"
                onClick={() => setPreviewIndex(idx)}
                style={{
                  background: item.tipo === 'ARQUIVO' ? 'linear-gradient(135deg,#1a3a5c,#0d2035)' : undefined,
                }}>
                {item.tipo === 'FOTO' && item.salvo && (
                  <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {item.tipo === 'FOTO' && !item.salvo && (
                  <div style={{ width: '100%', height: '100%', background: `url(${item.url}) center/cover` }} />
                )}
                {item.tipo === 'VIDEO' && (
                  <video src={item.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                {item.tipo === 'ARQUIVO' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <i className="ti ti-file-description" style={{ fontSize: 28, color: 'var(--ta)', opacity: .7 }} />
                    <span style={{ fontSize: 9, color: 'var(--ts)' }}>
                      {item.nome.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Badge tipo */}
                <span className="m-type">{TIPO_EMOJI[item.tipo]}</span>

                {/* Barra de progresso durante upload */}
                {!item.salvo && !item.erro && item.progresso > 0 && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: 3, background: 'rgba(0,0,0,.3)',
                  }}>
                    <div style={{
                      height: 3, background: 'var(--fa)',
                      width: `${item.progresso}%`,
                      transition: 'width .2s',
                    }} />
                  </div>
                )}

                {/* Overlay de erro */}
                {item.erro && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(224,92,92,.7)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 4, padding: 6,
                  }}>
                    <i className="ti ti-alert-circle" style={{ fontSize: 18, color: '#fff' }} />
                    <span style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>
                      {item.erro}
                    </span>
                  </div>
                )}

                {/* % progresso overlay */}
                {!item.salvo && !item.erro && item.progresso > 0 && item.progresso < 100 && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{item.progresso}%</span>
                  </div>
                )}

                {/* Botão remover */}
                {!somenteLeitura && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRemover(item) }}
                    disabled={removerMidia.isPending}
                    title="Remover"
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(224,92,92,.9)', border: '1px solid #fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Descrição */}
              <input
                style={{
                  width: '100%', padding: '4px 6px', border: 'none',
                  borderTop: '.5px solid var(--b)', background: 'var(--s1)',
                  color: 'var(--ts)', fontSize: 10, fontFamily: 'inherit',
                }}
                placeholder={item.salvo ? 'Descrição...' : item.erro ? 'Erro' : 'Enviando...'}
                value={item.desc}
                disabled={somenteLeitura || !item.salvo}
                onChange={e => setItems(prev => prev.map(i =>
                  i.id === item.id ? { ...i, desc: e.target.value } : i,
                ))}
                onBlur={e => handleSalvarDesc(item, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de visualização ── */}
      {preview && (
        <div
          onClick={() => setPreviewIndex(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.82)', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'zoom-out',
          }}
        >
          <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: 10 }}>
            <a
              href={preview.url} download={preview.nome} onClick={e => e.stopPropagation()}
              title="Baixar"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, textDecoration: 'none',
              }}
            >
              <i className="ti ti-download" />
            </a>
            <button
              onClick={e => { e.stopPropagation(); setPreviewIndex(null) }}
              title="Fechar"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {items.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); goPrev() }}
                title="Anterior"
                style={{
                  position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1,
                }}
              >
                ‹
              </button>
              <button
                onClick={e => { e.stopPropagation(); goNext() }}
                title="Próxima"
                style={{
                  position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1,
                }}
              >
                ›
              </button>
              <span style={{
                position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
                fontSize: 12, color: 'rgba(255,255,255,.75)',
              }}>
                {(previewIndex ?? 0) + 1} / {items.length}
              </span>
            </>
          )}

          <div key={preview.id} onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'default' }}>
            {preview.tipo === 'FOTO' && (
              <img src={preview.url} alt={preview.nome}
                style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 'var(--r)' }} />
            )}
            {preview.tipo === 'VIDEO' && (
              <video src={preview.url} controls autoPlay
                style={{ maxWidth: '90vw', maxHeight: '78vh', borderRadius: 'var(--r)' }} />
            )}
            {preview.tipo === 'ARQUIVO' && (
              <div style={{
                width: 260, padding: '36px 20px', borderRadius: 'var(--r)',
                background: 'linear-gradient(135deg,#1a3a5c,#0d2035)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <i className="ti ti-file-description" style={{ fontSize: 40, color: 'var(--ta)' }} />
                <span style={{ fontSize: 12, color: '#fff', textAlign: 'center', wordBreak: 'break-word' }}>{preview.nome}</span>
                <a href={preview.url} target="_blank" rel="noopener noreferrer"
                  style={{
                    marginTop: 4, fontSize: 11, fontWeight: 600, color: '#fff',
                    background: 'var(--fa)', padding: '7px 14px', borderRadius: 'var(--r)',
                    textDecoration: 'none',
                  }}
                >
                  Abrir arquivo
                </a>
              </div>
            )}
            {preview.desc && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', textAlign: 'center' }}>
                {preview.desc}
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
