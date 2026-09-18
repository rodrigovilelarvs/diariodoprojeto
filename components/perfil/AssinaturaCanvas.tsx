'use client'
// src/components/perfil/AssinaturaCanvas.tsx
// Cadastro da assinatura digital pessoal — extraído do RDO (sec. 9) e movido
// para "Meu perfil": é a mesma assinatura usada em qualquer RDO que o usuário
// precise aprovar, então faz mais sentido cadastrá-la uma vez aqui do que
// dentro de cada RDO.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useMinhaAssinatura, useSalvarAssinatura } from '@/hooks/useEmpresa'

export function AssinaturaCanvas() {
  const { data: minhaAssinaturaData, isLoading } = useMinhaAssinatura()
  const salvarAssinatura = useSalvarAssinatura()
  const imagemAtual = minhaAssinaturaData?.assinatura?.imagemUrl

  const [sigOpen, setSigOpen] = useState(false)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sigDraw    = useRef(false)
  const sigHad     = useRef(false)
  const sigFileRef = useRef<HTMLInputElement>(null)

  function carregarImagemNoCanvas(src: string) {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, cv.width, cv.height)
      const escala = Math.min(cv.width / img.width, cv.height / img.height)
      const w = img.width * escala, h = img.height * escala
      const x = (cv.width - w) / 2, y = (cv.height - h) / 2
      ctx.drawImage(img, x, y, w, h)
      sigHad.current = true
    }
    img.onerror = () => toast.error('Não foi possível carregar a imagem.')
    img.src = src
  }

  function onSelecionarArquivoSig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return }
    const reader = new FileReader()
    reader.onload = () => carregarImagemNoCanvas(reader.result as string)
    reader.readAsDataURL(file)
  }

  function onColarSig(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => carregarImagemNoCanvas(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function onColarSigClipboardApi() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const tipo = item.types.find(t => t.startsWith('image/'))
        if (!tipo) continue
        const blob = await item.getType(tipo)
        const reader = new FileReader()
        reader.onload = () => carregarImagemNoCanvas(reader.result as string)
        reader.readAsDataURL(blob)
        return
      }
      toast.error('Nenhuma imagem encontrada na área de transferência.')
    } catch {
      toast.error('Não foi possível colar. Tente Ctrl+V na área da assinatura.')
    }
  }

  function initCanvas() {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const r = cv.getBoundingClientRect()
    cv.width = r.width || 400; cv.height = 120
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1
    ctx.moveTo(20, 95); ctx.lineTo(cv.width - 20, 95); ctx.stroke()
    ctx.strokeStyle = '#1A2535'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    sigDraw.current = false; sigHad.current = false

    const gp = (e: MouseEvent | Touch) => {
      const b = cv.getBoundingClientRect()
      return { x: (e.clientX - b.left) * (cv.width / b.width), y: (e.clientY - b.top) * (cv.height / b.height) }
    }
    cv.onmousedown  = e => { sigDraw.current = true; sigHad.current = true; const p = gp(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    cv.onmousemove  = e => { if (!sigDraw.current) return; const p = gp(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
    cv.onmouseup    = cv.onmouseleave = () => { sigDraw.current = false }
    cv.ontouchstart = e => { e.preventDefault(); sigDraw.current = true; sigHad.current = true; const p = gp(e.touches[0]); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    cv.ontouchmove  = e => { e.preventDefault(); if (!sigDraw.current) return; const p = gp(e.touches[0]); ctx.lineTo(p.x, p.y); ctx.stroke() }
    cv.ontouchend   = () => { sigDraw.current = false }
  }

  useEffect(() => { if (sigOpen) setTimeout(initCanvas, 80) }, [sigOpen])

  async function salvarSig() {
    if (!sigHad.current) { toast.error('Assine antes de salvar.'); return }
    const img = canvasRef.current?.toDataURL('image/png') ?? ''
    try {
      await salvarAssinatura.mutateAsync({ imagemBase64: img })
      setSigOpen(false)
      toast.success('Assinatura salva!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar assinatura. Tente novamente.')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="sig-card" style={{ width: 220, flexShrink: 0 }}>
          <div className="sig-area">
            {imagemAtual
              ? <img src={imagemAtual} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} alt="" />
              : <span className="sig-hint">_ _ _ _ _ _ _</span>}
            <div className="sig-base" />
          </div>
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 200 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ts)', lineHeight: 1.6, marginBottom: 9 }}>
            É essa assinatura que aparece automaticamente sempre que você aprova um RDO — não precisa
            mais cadastrar dentro de cada um.
          </div>
          <button className="btn btn-p btn-sm" onClick={() => setSigOpen(true)} disabled={isLoading}>
            <i className={`ti ${imagemAtual ? 'ti-pencil' : 'ti-writing'}`} />
            {imagemAtual ? 'Atualizar assinatura' : 'Cadastrar assinatura'}
          </button>
        </div>
      </div>

      {sigOpen && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setSigOpen(false)}>
          <div className="modal" style={{ width: 440 }}>
            <div className="mh">
              <div className="mh-t"><i className="ti ti-writing" /> Cadastrar assinatura digital</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tm)', fontSize: 17 }}
                onClick={() => setSigOpen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="mb">
              <label className="fl">Assine abaixo, cole (Ctrl+V) ou envie uma imagem</label>
              <div
                onPaste={onColarSig}
                tabIndex={0}
                style={{ border: '.5px solid var(--bs)', borderRadius: 'var(--r)', background: '#fff', overflow: 'hidden', marginBottom: 8, cursor: 'crosshair' }}
              >
                <canvas ref={canvasRef} style={{ display: 'block', width: '100%', touchAction: 'none' }} />
              </div>
              <input ref={sigFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onSelecionarArquivoSig} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
                <button className="btn btn-sm" onClick={onColarSigClipboardApi}>
                  <i className="ti ti-clipboard" /> Colar imagem
                </button>
                <button className="btn btn-sm" onClick={() => sigFileRef.current?.click()}>
                  <i className="ti ti-upload" /> Enviar do computador
                </button>
                <button className="btn btn-sm" onClick={() => {
                  const cv = canvasRef.current; if (!cv) return
                  const ctx = cv.getContext('2d')!
                  ctx.clearRect(0, 0, cv.width, cv.height)
                  sigHad.current = false
                }}>
                  <i className="ti ti-eraser" /> Limpar
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="ti ti-shield-check" style={{ color: 'var(--ta)' }} />
                Lei nº 14.063/2020 · Reutilizada em todos os RDOs
              </div>
            </div>
            <div className="mf2">
              <button className="btn" onClick={() => setSigOpen(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={salvarSig} disabled={salvarAssinatura.isPending}>
                <i className={`ti ${salvarAssinatura.isPending ? 'ti-loader' : 'ti-check'}`}
                  style={salvarAssinatura.isPending ? { animation: 'spin 1s linear infinite' } : {}} />
                {salvarAssinatura.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
