'use client'
// app/(app)/aprovacao/[id]/page.tsx
// Tela de aprovação de RDO — a aprovação é feita assinando (puxa a assinatura
// digital já cadastrada em "Meu perfil"), com comentários e tracker de assinaturas

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRdo, useEnviarComentario, useEditarComentario, useExcluirComentario, useAprovarRdo, useReabrirRdo, useExcluirRdo, useMinhaAssinatura, useRdoLog } from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import { Topbar }       from '@/components/layout/Topbar'
import { gerarPdfRdo }  from '@/lib/pdf'
import { RdoStatusBadge, Skeleton, Modal } from '@/components/ui'
import { numeroRdo, fmtData } from '@/lib/format'
import { UploadZona } from '@/components/rdos/UploadZona'
import {
  CLIMA, CLIMA_NOITE, CLIMA_L, CLIMAS,
  CATEGORIA_L, CATEGORIAS, EQUIPAMENTO_TIPO_L, EQUIPAMENTO_TIPOS,
  calcHH, calcOcDur, calcPrazo,
} from '@/lib/rdo-display'
import type { AssinaturaItem } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────
function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('')
}

function dataRel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const COR_PERFIL: Record<string, { bg: string; cor: string }> = {
  ADMIN:         { bg: 'var(--bga)', cor: 'var(--ta)' },
  PERSONALIZADO: { bg: 'var(--s2)',  cor: 'var(--ts)' },
}


// ══════════════════════════════════════════════════════════
export default function AprovacaoPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const { session, pode } = useAppAuth()
  const { data: rdo, isLoading, isError } = useRdo(id)
  const enviarCmt  = useEnviarComentario()
  const editarComentario = useEditarComentario()
  const excluirComentario = useExcluirComentario()
  const aprovarRdo  = useAprovarRdo()
  const reabrirRdo  = useReabrirRdo()
  const excluirRdo  = useExcluirRdo()
  const { data: minhaAssinaturaData } = useMinhaAssinatura()
  const minhaSigCadastrada = !!minhaAssinaturaData?.assinatura?.imagemUrl
  const { data: logData } = useRdoLog(id)

  const cmtRef      = useRef<HTMLTextAreaElement>(null)
  const decisaoRef  = useRef<HTMLTextAreaElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editTexto, setEditTexto]   = useState('')
  const [modalLog, setModalLog]     = useState<'edicoes' | 'visualizacoes' | null>(null)

  // ── Comentário ─────────────────────────────────────────
  async function handleCmt() {
    const txt = cmtRef.current?.value.trim()
    if (!txt) return
    setEnviando(true)
    try {
      await enviarCmt.mutateAsync({ rdoId: id, texto: txt })
      if (cmtRef.current) cmtRef.current.value = ''
      toast.success('Comentário enviado!')
    } catch {
      toast.error('Erro ao enviar comentário.')
    } finally {
      setEnviando(false)
    }
  }

  async function handleExcluirComentario(comentarioId: string) {
    if (!window.confirm('Excluir este comentário?')) return
    try {
      await excluirComentario.mutateAsync({ rdoId: id, comentarioId })
    } catch {
      toast.error('Erro ao excluir comentário.')
    }
  }

  function abrirEdicaoComentario(c: { id: string; texto: string }) {
    setEditandoId(c.id)
    setEditTexto(c.texto)
  }

  async function salvarEdicaoComentario(comentarioId: string) {
    const texto = editTexto.trim()
    if (!texto) { toast.error('O comentário não pode ficar vazio.'); return }
    try {
      await editarComentario.mutateAsync({ rdoId: id, comentarioId, texto })
      setEditandoId(null)
      toast.success('Comentário atualizado!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao editar comentário.')
    }
  }

  // ── Assinatura (aprovação é feita assinando) ────────────
  // A assinatura já é a prova da aprovação — não gera comentário automático
  // na thread; o campo de Comentários fica livre pra observações sobre as
  // atividades do RDO, sem se misturar com o registro de aprovação em si.
  async function handleAssinar() {
    if (!minhaSigCadastrada) {
      toast.error('Cadastre sua assinatura digital em "Meu perfil" antes de assinar.')
      router.push('/perfil')
      return
    }
    try {
      const res = await aprovarRdo.mutateAsync({ rdoId: id, aprovado: true })
      if (res.todosAssinaram) {
        toast.success(`✔ RDO totalmente assinado! Emissor notificado.`)
      } else {
        toast.success(`Assinatura registrada. Aguardando ${res.total - res.assinadas} aprovador(es).`)
      }
    } catch (err: any) {
      if (err?.codigo === 'SEM_ASSINATURA_CADASTRADA') {
        toast.error(err.message)
        router.push('/perfil')
        return
      }
      toast.error(err?.message ?? 'Erro ao assinar RDO.')
    }
  }

  async function handleRevisar() {
    const motivo = decisaoRef.current?.value.trim()
    if (!motivo) {
      toast.error('Escreva o motivo antes de enviar para revisão.')
      decisaoRef.current?.focus()
      return
    }
    try {
      await aprovarRdo.mutateAsync({ rdoId: id, aprovado: false, comentario: motivo })
      toast.warning('Revisão solicitada. Emissor notificado.')
      if (decisaoRef.current) decisaoRef.current.value = ''
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao solicitar revisão.')
    }
  }

  // ── Reabrir para rascunho ────────────────────────────────
  async function handleReabrir() {
    if (!rdo) return
    if (!window.confirm(
      `Reabrir o RDO #${numeroRdo(rdo.numero)} para rascunho? As assinaturas já registradas serão resetadas e ele precisará ser reaprovado.`,
    )) return
    try {
      await reabrirRdo.mutateAsync(id)
      toast.success('RDO reaberto para rascunho.')
      router.push(`/rdos/${id}`)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao reabrir RDO.')
    }
  }

  // ── Excluir ────────────────────────────────────────────
  async function handleExcluir() {
    if (!rdo) return
    if (!window.confirm(`Excluir o RDO #${numeroRdo(rdo.numero)}? Essa ação não pode ser desfeita.`)) return
    try {
      await excluirRdo.mutateAsync(id)
      toast.success('RDO excluído.')
      router.push('/rdos')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao excluir RDO.')
    }
  }

  // ── Guards ─────────────────────────────────────────────
  if (isLoading) return (
    <div className="main">
      <Topbar titulo="Aprovação" subtitulo="Carregando..." />
      <div className="content">
        <Skeleton h={200} />
        <div style={{ marginTop: 12 }}><Skeleton h={300} /></div>
        <div style={{ marginTop: 12 }}><Skeleton h={160} /></div>
      </div>
    </div>
  )

  if (isError || !rdo) return (
    <div className="main">
      <Topbar titulo="Aprovação" subtitulo="RDO não encontrado" />
      <div className="content" style={{ color: 'var(--td)', padding: 32 }}>RDO não encontrado.</div>
    </div>
  )

  const assinaturas: AssinaturaItem[] = rdo.assinaturas ?? []
  const totalAssin  = assinaturas.length
  const assinadas   = assinaturas.filter(a => a.status === 'ASSINADO').length
  const todosAssina = totalAssin > 0 && assinadas === totalAssin
  const minhaAssin  = assinaturas.find(a => a.usuario.id === session?.usuario.id)
  // Já assinei? Então não mostra mais a decisão pra mim, mesmo que rdo.status
  // ainda não tenha virado APROVADO (ex.: outros aprovadores pendentes).
  const podeAprovar = pode('aprovar_rdo') && rdo.status === 'PENDENTE_APROVACAO' && minhaAssin?.status !== 'ASSINADO'

  const registros   = rdo.atividadeRegistros ?? []

  const prazo         = calcPrazo(rdo.projeto.dataInicioContrato, rdo.projeto.dataFimContrato, rdo.data)
  const totalTrabalho = calcHH(rdo.horaInicio ?? '', rdo.horaTermino ?? '', Number(rdo.intervaloHoras ?? 0))
  const maoDeObra      = rdo.maoDeObra ?? []
  const equipamentos   = rdo.equipamentos ?? []
  const ocorrencias    = rdo.ocorrencias ?? []
  const totalHH        = maoDeObra.reduce((s: number, m: any) => s + Number(m.totalHH), 0)
  const hhPorCategoriaMO = CATEGORIAS.map(cat => ({
    categoria: cat,
    totalHH:      maoDeObra.filter((m: any) => (m.categoria ?? 'DIRETA') === cat).reduce((s: number, m: any) => s + Number(m.totalHH), 0),
    totalPessoas: maoDeObra.filter((m: any) => (m.categoria ?? 'DIRETA') === cat).reduce((s: number, m: any) => s + Number(m.quantidade), 0),
  })).filter(c => c.totalPessoas > 0)
  const totalEQ         = equipamentos.reduce((s: number, e: any) => s + Number(e.quantidade), 0)

  return (
    <div className="main">
      <Topbar
        titulo={`Aprovação — RDO #${numeroRdo(rdo.numero)}`}
        subtitulo={`${rdo.projeto.nome} · ${fmtData(rdo.data)}`}
        acoes={
          <>
            <button className="btn btn-sm" onClick={() => router.push(`/projetos/${rdo.projeto.id}`)}>
              <i className="ti ti-folder" /> Voltar à pasta do projeto
            </button>
            <RdoStatusBadge status={rdo.status} assinaturas={rdo.assinaturas} />
            <button className="btn btn-sm" disabled={pdfLoading} onClick={async () => {
              if (!rdo) return
              setPdfLoading(true)
              try { await gerarPdfRdo(rdo, session?.tenantNome); toast.success('PDF exportado!') }
              catch { toast.error('Erro ao gerar PDF.') }
              finally { setPdfLoading(false) }
            }}>
              <i className={`ti ${pdfLoading ? 'ti-loader' : 'ti-file-export'}`}
                style={pdfLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              {pdfLoading ? 'Gerando...' : 'Exportar PDF'}
            </button>
            {rdo.status === 'RASCUNHO' && pode('emitir_rdo') && (
              <button className="btn btn-sm" onClick={() => router.push(`/rdos/${id}`)}>
                <i className="ti ti-pencil" /> Editar
              </button>
            )}
          </>
        }
      />

      <div className="content">
        <div>

            {/* ══ SEC 1 — Identificação ══ */}
            <div className="sec">
              <div className="sec-h"><span className="sec-num">1</span><span className="sec-title">Identificação</span></div>
              <div className="sec-body">
                <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  <div className="fr" style={{ flex:'0 0 84px' }}>
                    <label className="fl">Nº do RDO</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ta)', fontWeight:600, cursor:'default' }}>
                      #{numeroRdo(rdo.numero)}
                    </div>
                  </div>
                  <div className="fr" style={{ flex:'0 0 150px' }}>
                    <label className="fl">Data</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                      {fmtData(rdo.data)} · {fmtData(rdo.data, { weekday: 'long' })}
                    </div>
                  </div>
                  <div className="fr" style={{ flex:'1 1 auto', minWidth:0 }}>
                    <label className="fl">Projeto</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default', whiteSpace:'normal', wordBreak:'break-word', lineHeight:1.35 }}>
                      {rdo.projeto.nome}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  {rdo.projeto.pedidoCompraContrato && (
                    <div className="fr" style={{ flex:'1 1 200px' }}>
                      <label className="fl">Pedido de compra ou contrato</label>
                      <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                        {rdo.projeto.pedidoCompraContrato}
                      </div>
                    </div>
                  )}
                  {rdo.projeto.empresaContratada && (
                    <div className="fr" style={{ flex:'1 1 200px' }}>
                      <label className="fl">Empresa contratada</label>
                      <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                        {rdo.projeto.empresaContratada}
                      </div>
                    </div>
                  )}
                  <div className="fr" style={{ flex:'1 1 200px' }}>
                    <label className="fl">Gestor do Projeto</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                      {rdo.emissor.nome}
                    </div>
                  </div>
                  {prazo && (
                    <div style={{ flex:'2 1 340px', background:'var(--bga)', border:'.5px solid var(--ba)', borderRadius:'var(--r)', padding:'8px 12px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      <div>
                        <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Prazo contratual</div>
                        <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.inicio} a {prazo.fim}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Decorridos</div>
                        <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.decorridos}d ({prazo.pctDecorrido}%)</div>
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Restantes</div>
                        <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.restantes}d</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══ SEC 2 — Condições climáticas ══ */}
            <div className="sec">
              <div className="sec-h"><span className="sec-num">2</span><span className="sec-title">Condições climáticas</span></div>
              <div className="sec-body">
                <div className="g2">
                  {(['Manhã','Tarde'] as const).map((p, pi) => {
                    const valor = pi === 0 ? rdo.climaManha : rdo.climaTarde
                    return (
                      <div key={p}>
                        <label className="fl">{p}</label>
                        <div className="cg4">
                          {CLIMAS.map(c => (
                            <button key={c} disabled className={`cb ${valor === c ? 'on' : ''}`}>
                              <span style={{ fontSize:18 }}>{CLIMA[c]}</span>
                              <span>{CLIMA_L[c]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {rdo.climaNoite && (
                  <div style={{ marginTop:8 }}>
                    <label className="fl">Noite</label>
                    <div className="cg4">
                      {CLIMAS.map(c => (
                        <button key={c} disabled className={`cb ${rdo.climaNoite === c ? 'on' : ''}`}>
                          <span style={{ fontSize:18 }}>{CLIMA_NOITE[c]}</span>
                          <span>{CLIMA_L[c]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="g2" style={{ marginTop:8 }}>
                  <div className="fr">
                    <label className="fl">Precipitação (mm)</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                      {rdo.precipitacaoMm ?? 0}
                    </div>
                  </div>
                  <div className="fr">
                    <label className="fl">Impacto no serviço</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                      {rdo.climaImpacto === 'NENHUM' ? 'Nenhum' : rdo.climaImpacto === 'PARCIAL' ? 'Parcial' : 'Total — paralisado'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ SEC 3 — Atividade, horários e progresso ══ */}
            <div className="sec">
              <div className="sec-h">
                <span className="sec-num">3</span>
                <span className="sec-title">Atividade, horários e progresso</span>
                {registros.length > 0 && (
                  <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                    {registros.length} atividade{registros.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="sec-body">
                <div className="g4">
                  <div className="fr">
                    <label className="fl">Início</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>{rdo.horaInicio ?? '—'}</div>
                  </div>
                  <div className="fr">
                    <label className="fl">Término</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>{rdo.horaTermino ?? '—'}</div>
                  </div>
                  <div className="fr">
                    <label className="fl">Intervalo (h)</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>{rdo.intervaloHoras ?? 0}</div>
                  </div>
                  <div className="fr">
                    <label className="fl">Total trabalhado</label>
                    <div className="fi" style={{ background:'var(--bga)', color:'var(--ta)', fontWeight:600, cursor:'default' }}>
                      {totalTrabalho}
                    </div>
                  </div>
                </div>

                {registros.map((reg: any, ri: number) => {
                  const ativ = reg.atividade
                  const pct  = reg.pctAtual
                  const cor  = pct >= 90 ? 'var(--fsu)' : pct >= 60 ? 'var(--fa)' : pct > 0 ? 'var(--fw)' : 'var(--tm)'
                  const etapaLabel = reg.avulsa
                    ? (reg.avulsaEtapa ?? 'Avulsa')
                    : ativ?.etapa ? `${ativ.etapa.numero} · ${ativ.etapa.nome}` : ''
                  const atividadeLabel = reg.avulsa
                    ? (reg.avulsaNome ?? '')
                    : ativ ? `${ativ.numero} · ${ativ.nome}` : `Atividade ${ri+1}`
                  return (
                    <div key={reg.atividadeId ?? ri} className="acb">
                      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                        <div style={{ width:'50%', display:'flex', flexDirection:'column', gap:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
                            <i className="ti ti-trending-up" style={{ color:'var(--ta)', flexShrink:0, fontSize:11 }} />
                            <span style={{ fontSize:10, color:'var(--tm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{etapaLabel}</span>
                          </div>
                          <span style={{ fontSize:11, color:'var(--ts)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingLeft:16 }}>{atividadeLabel}</span>
                        </div>
                        <div style={{ flex:1, minWidth:120 }}>
                          <div className="pt-bg">
                            <div className="pt-f" style={{ width:`${pct}%`, background: cor }} />
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
                          <div style={{ fontSize:10, color:'var(--tm)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 8px', whiteSpace:'nowrap' }}>
                            Anterior: <strong>{reg.pctAnterior}%</strong>
                          </div>
                          <div className="pct-big" style={{ color: cor }}>{pct}%</div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:10, color:'var(--tm)', marginBottom:2 }}>Avanço hoje</div>
                            <div className={`dp ${reg.deltaHoje > 0 ? 'dp-p' : 'dp-z'}`}>
                              {reg.deltaHoje >= 0 ? '+' : ''}{reg.deltaHoje}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {rdo.observacoes && (
                  <div className="fr">
                    <label className="fl">Observações</label>
                    <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default', minHeight:60, whiteSpace:'pre-wrap' }}>
                      {rdo.observacoes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ══ SEC 4 — Mão de obra ══ */}
            {maoDeObra.length > 0 && (
              <div className="sec">
                <div className="sec-h">
                  <span className="sec-num">4</span>
                  <span className="sec-title">Mão de obra</span>
                  <span style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
                    Total: {totalHH} H/H
                  </span>
                  {hhPorCategoriaMO.map(c => (
                    <span key={c.categoria} style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
                      {CATEGORIA_L[c.categoria]}: {c.totalPessoas}p · {c.totalHH}H/H
                    </span>
                  ))}
                </div>
                <div className="sec-body">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                    {maoDeObra.map((mo: any, i: number) => (
                      <div key={i} style={{ border:'.5px solid var(--b)', borderRadius:'var(--r)', padding:8, background:'var(--s1)' }}>
                        <div style={{ fontSize:12, fontWeight:500, marginBottom:6 }}>{mo.funcaoNome}</div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                          {mo.categoria ? (
                            <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20 }}>
                              {CATEGORIA_L[mo.categoria as keyof typeof CATEGORIA_L]}
                            </span>
                          ) : <span />}
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20 }}>
                            {mo.totalHH} H/H
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--ts)' }}>
                          Qtd. {mo.quantidade} · {mo.horaEntrada} → {mo.horaSaida}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ SEC 5 — Equipamentos ══ */}
            {equipamentos.length > 0 && (
              <div className="sec">
                <div className="sec-h">
                  <span className="sec-num">5</span>
                  <span className="sec-title">Equipamentos</span>
                  <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                    {equipamentos.length} equipamento{equipamentos.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
                    Total: {totalEQ} un.
                  </span>
                </div>
                <div className="sec-body">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                    {equipamentos.map((eq: any, i: number) => (
                      <div key={i} style={{ border:'.5px solid var(--b)', borderRadius:'var(--r)', padding:8, background:'var(--s1)' }}>
                        <div style={{ fontSize:12, fontWeight:500, marginBottom:6 }}>{eq.equipamentoNome}</div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          {eq.equipamentoCadastro?.tipo ? (
                            <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20 }}>
                              {EQUIPAMENTO_TIPO_L[eq.equipamentoCadastro.tipo as keyof typeof EQUIPAMENTO_TIPO_L]}
                            </span>
                          ) : <span />}
                          <span style={{ fontSize:11, color:'var(--ts)' }}>Qtd. {eq.quantidade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ SEC 6 — Ocorrências ══ */}
            {ocorrencias.length > 0 && (
              <div className="sec">
                <div className="sec-h">
                  <span className="sec-num">6</span>
                  <span className="sec-title">Ocorrências</span>
                  <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                    {ocorrencias.length} ocorrência{ocorrencias.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="sec-body">
                  {ocorrencias.map((oc: any, i: number) => {
                    const dur = oc.horaInicio && oc.horaTermino ? calcOcDur(oc.horaInicio, oc.horaTermino) : '—'
                    const durMin = oc.duracaoMin ?? 0
                    const durCor = durMin > 120 ? 'var(--td)' : durMin > 30 ? 'var(--tw)' : 'var(--ta)'
                    return (
                      <div key={i} className="oc-card">
                        <div style={{ display:'flex', alignItems:'flex-end', gap:8, padding:'8px 10px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--ta)', paddingBottom:5 }}>#{i+1}</span>
                          <span style={{ fontSize:12, fontWeight:500, color:'var(--ta)', flex:'1 1 150px', paddingBottom:5 }}>{oc.tipo}</span>
                          <div style={{ flex:'0 0 100px' }}>
                            <label className="fl" style={{ marginBottom:2 }}>Início</label>
                            <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>{oc.horaInicio ?? '—'}</div>
                          </div>
                          <div style={{ flex:'0 0 100px' }}>
                            <label className="fl" style={{ marginBottom:2 }}>Término</label>
                            <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>{oc.horaTermino ?? '—'}</div>
                          </div>
                          <span style={{ fontSize:10, fontWeight:600, color: durCor, background:'var(--s2)', border:`.5px solid ${durCor}40`, borderRadius:20, padding:'4px 8px', whiteSpace:'nowrap', marginBottom:2 }}>
                            {dur}
                          </span>
                        </div>
                        <div style={{ padding:'0 10px 8px' }}>
                          <label className="fl">Descrição</label>
                          <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default', minHeight:40, whiteSpace:'pre-wrap' }}>
                            {oc.descricao}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ══ SEC 7 — Mídias ══ */}
            <div className="sec">
              <div className="sec-h">
                <span className="sec-num">7</span>
                <span className="sec-title">Fotos, vídeos e arquivos</span>
                {(rdo.midias?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ts)', background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 20, padding: '2px 7px' }}>
                    {rdo.midias.length} item{rdo.midias.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="sec-body">
                <UploadZona rdoId={id} midiasIniciais={rdo.midias ?? []} somenteLeitura />
              </div>
            </div>

            {/* ══ SEC 8 — Comentários ══ */}
            <div className="sec">
              <div className="sec-h">
                <span className="sec-num">8</span>
                <span className="sec-title">Comentários</span>
                {(rdo.comentarios?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ts)', background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 20, padding: '2px 7px' }}>
                    {rdo.comentarios.length}
                  </span>
                )}
              </div>
              <div className="sec-body">
                {(rdo.comentarios ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--tm)', fontSize: 11 }}>
                    <i className="ti ti-message-off" style={{ fontSize: 22, display: 'block', marginBottom: 6, opacity: .3 }} />
                    Nenhum comentário ainda.
                  </div>
                ) : (
                  (rdo.comentarios ?? []).map((c: any) => {
                    const estilo = COR_PERFIL[c.autor.perfil] ?? COR_PERFIL.PERSONALIZADO
                    const meu    = c.autor.id === session?.usuario.id
                    const podeEditar = meu || session?.usuario.perfil === 'ADMIN'
                    const editando = editandoId === c.id
                    return (
                      <div key={c.id} className="cmt-item">
                        <div className="av"
                          style={{ width: 28, height: 28, fontSize: 10, background: estilo.bg, color: estilo.cor }}>
                          {iniciais(c.autor.nome)}
                        </div>
                        <div className="cmt-bubble" style={meu ? { borderColor: 'var(--ba)' } : {}}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{c.autor.nome}</span>
                            <span style={{ fontSize: 10, color: 'var(--tm)' }}>·</span>
                            <span style={{ fontSize: 10, color: 'var(--tm)' }}>{dataRel(c.criadoEm)}</span>
                            {c.editadoEm && <span style={{ fontSize: 9, color: 'var(--tm)', fontStyle: 'italic' }}>(editado)</span>}
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {meu && <span style={{ fontSize: 9, color: 'var(--ta)' }}>você</span>}
                              {!editando && podeEditar && (
                                <button title="Editar comentário" onClick={() => abrirEdicaoComentario(c)}
                                  style={{ background: 'var(--s2)', border: '1px solid var(--b)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ts)', fontSize: 10, lineHeight: 1, flexShrink: 0 }}>
                                  <i className="ti ti-pencil" />
                                </button>
                              )}
                              {session?.usuario.perfil === 'ADMIN' && (
                                <button title="Excluir comentário" onClick={() => handleExcluirComentario(c.id)}
                                  style={{ background: 'rgba(224,92,92,.1)', border: '1px solid rgba(224,92,92,.5)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--td)', fontSize: 11, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          {editando ? (
                            <div>
                              <textarea className="cmt-ta" rows={2} value={editTexto}
                                onChange={e => setEditTexto(e.target.value)}
                                onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') salvarEdicaoComentario(c.id) }} />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                                <button className="btn btn-sm" onClick={() => setEditandoId(null)}>Cancelar</button>
                                <button className="btn btn-sm btn-p" disabled={editarComentario.isPending}
                                  onClick={() => salvarEdicaoComentario(c.id)}>
                                  <i className="ti ti-check" /> {editarComentario.isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{c.texto}</div>
                              <div style={{ marginTop: 5, display: 'flex', gap: 10 }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--tm)', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                  onClick={() => {
                                    if (cmtRef.current) {
                                      cmtRef.current.value = `@${c.autor.nome} `
                                      cmtRef.current.focus()
                                    }
                                  }}>
                                  <i className="ti ti-corner-down-right" /> Responder
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}

                {/* Input novo comentário */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                  <div className="av" style={{ width: 28, height: 28, fontSize: 10, background: 'var(--bga)', color: 'var(--ta)', marginTop: 2, flexShrink: 0 }}>
                    {session ? iniciais(session.usuario.nome) : 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea ref={cmtRef} className="cmt-ta" rows={2}
                      placeholder="Escrever comentário... (Ctrl+Enter para enviar)"
                      onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleCmt() }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                      <button className="btn btn-p btn-sm" disabled={enviando} onClick={handleCmt}>
                        <i className="ti ti-send" /> {enviando ? 'Enviando...' : 'Comentar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ SEC 9 — Assinaturas ══ */}
            <div className="sec">
              <div className="sec-h">
                <span className="sec-num">9</span>
                <span className="sec-title">Assinaturas</span>
                <span style={{ fontSize: 10, color: 'var(--ts)', background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 20, padding: '2px 7px' }}>
                  {assinadas}/{totalAssin}
                </span>
              </div>
              <div className="sec-body">
                {/* Tracker visual */}
                <div className="sig-track">
                  {assinaturas.map((a, i) => (
                    <div key={a.id} className="sig-step">
                      <div className={`sig-c ${a.status === 'ASSINADO' ? 'done' : 'pend'}`}>
                        {a.status === 'ASSINADO'
                          ? <i className="ti ti-check" style={{ fontSize: 10 }} />
                          : <i className="ti ti-clock" style={{ fontSize: 10 }} />
                        }
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--ts)', textAlign: 'center', maxWidth: 60 }}>
                        {a.usuario.nome.split(' ')[0]}
                      </div>
                      <div style={{ fontSize: 8, color: 'var(--tm)', textAlign: 'center' }}>
                        {a.cargo?.replace(/_/g, ' ')}
                      </div>
                      {a.assinadoEm && (
                        <div style={{ fontSize: 8, color: 'var(--tsu)', textAlign: 'center' }}>
                          {new Date(a.assinadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {todosAssina && (
                  <div style={{ background: 'rgba(76,175,125,.08)', border: '.5px solid rgba(76,175,125,.3)', borderRadius: 'var(--r)', padding: '8px 10px', textAlign: 'center', marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--tsu)', marginBottom: 2 }}>✔ Totalmente aprovado</div>
                    {assinaturas[assinaturas.length - 1]?.assinadoEm && (
                      <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                        {new Date(assinaturas[assinaturas.length - 1].assinadoEm!).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview de assinaturas — só de quem já assinou de fato;
                    nunca confiar só em ter assinaturaDigital vinculado, pra
                    não mostrar uma assinatura "grudada" de antes de um
                    Reabrir como se já estivesse assinada de novo. */}
                {assinaturas.filter(a => a.status === 'ASSINADO' && a.assinaturaDigital).length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {assinaturas.filter(a => a.status === 'ASSINADO' && a.assinaturaDigital).map(a => (
                      <div key={a.id} style={{ background: '#fff', borderRadius: 'var(--r)', overflow: 'hidden', border: '.5px solid rgba(76,175,125,.3)' }}>
                        <img src={a.assinaturaDigital!.imagemUrl} alt="" style={{ width: '100%', height: 50, objectFit: 'contain', display: 'block' }} />
                        <div style={{ fontSize: 9, color: '#666', padding: '3px 7px', borderTop: '1px solid #eee' }}>
                          {a.usuario.nome}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Decisão — revisar ou assinar (a aprovação é feita assinando) */}
                {podeAprovar && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '.5px solid var(--b)' }}>
                    <textarea ref={decisaoRef} className="cmt-ta" rows={2}
                      placeholder="Motivo da revisão (obrigatório se for enviar para revisão)..." />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                      <button className="btn btn-sm"
                        style={{ color: 'var(--td)', borderColor: 'rgba(224,92,92,.35)' }}
                        disabled={aprovarRdo.isPending}
                        onClick={handleRevisar}>
                        <i className="ti ti-x" /> Revisar
                      </button>
                      {minhaSigCadastrada ? (
                        <button className="btn btn-sm btn-p"
                          style={{ background: 'var(--fsu)', borderColor: 'var(--fsu)' }}
                          disabled={aprovarRdo.isPending}
                          onClick={handleAssinar}>
                          <i className={`ti ${aprovarRdo.isPending ? 'ti-loader' : 'ti-writing'}`}
                            style={aprovarRdo.isPending ? {animation:'spin 1s linear infinite'} : {}} />
                          {aprovarRdo.isPending ? 'Assinando...' : 'Assinar'}
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-p" onClick={() => router.push('/perfil')}>
                          <i className="ti ti-writing" /> Cadastrar assinatura pra assinar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* Rodapé — quem/quando criou e atualizou pela última vez */}
          <div style={{ background: 'var(--s1)', border: '.5px solid var(--b)', borderRadius: 'var(--r)', padding: '10px 14px', marginTop: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                <span style={{ color: 'var(--tp)', fontWeight: 500 }}>Criado por:</span> {rdo.emissor.nome} ( {new Date(rdo.criadoEm).toLocaleString('pt-BR')} )
              </div>
              <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                <span style={{ color: 'var(--tp)', fontWeight: 500 }}>Última modificação:</span> {rdo.emissor.nome} ( {new Date(rdo.atualizadoEm).toLocaleString('pt-BR')} )
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
              <button onClick={() => setModalLog('edicoes')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ta)', fontFamily: 'inherit', padding: 0 }}>
                Log de edições ({logData?.edicoes.length ?? 0})
              </button>
              <button onClick={() => setModalLog('visualizacoes')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ta)', fontFamily: 'inherit', padding: 0 }}>
                Visualizações ({logData?.visualizacoes.length ?? 0})
              </button>
            </div>
          </div>

          {/* Ações secundárias — a decisão de assinar/revisar já está na seção acima */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => router.push('/rdos')}>
              <i className="ti ti-arrow-left" /> Voltar à lista
            </button>
            {pode('aprovar_rdo') && rdo.status !== 'RASCUNHO' && (
              <button className="btn btn-sm"
                disabled={reabrirRdo.isPending} onClick={handleReabrir}>
                <i className={`ti ${reabrirRdo.isPending ? 'ti-loader' : 'ti-lock-open'}`}
                  style={reabrirRdo.isPending ? {animation:'spin 1s linear infinite'} : {}} />
                {reabrirRdo.isPending ? 'Reabrindo...' : 'Reabrir para rascunho'}
              </button>
            )}
            {pode('aprovar_rdo') && (
              <button className="btn btn-sm" style={{ color: 'var(--td)', borderColor: 'rgba(224,92,92,.35)' }}
                disabled={excluirRdo.isPending} onClick={handleExcluir}>
                <i className="ti ti-trash" /> Excluir RDO
              </button>
            )}
          </div>

        </div>
      </div>

      <Modal
        open={!!modalLog} onClose={() => setModalLog(null)}
        titulo={modalLog === 'edicoes' ? 'Log de edições' : 'Visualizações'}
        icon={modalLog === 'edicoes' ? 'ti-history' : 'ti-eye'}
        width={440}
        rodape={<button className="btn" onClick={() => setModalLog(null)}>Fechar</button>}
      >
        {(() => {
          const itens = modalLog === 'edicoes' ? logData?.edicoes : logData?.visualizacoes
          if (!itens || itens.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--tm)', fontSize: 11 }}>
                Nenhum registro ainda.
              </div>
            )
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {itens.map((l, i) => (
                <div key={i} style={{ padding: '8px 10px', border: '.5px solid var(--b)', borderRadius: 'var(--r)', background: 'var(--s1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{l.usuario}</div>
                  <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 2 }}>{l.mensagem}</div>
                  <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>{new Date(l.criadoEm).toLocaleString('pt-BR')}</div>
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
