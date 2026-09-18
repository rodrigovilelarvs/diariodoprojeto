'use client'
// src/app/projetos/[id]/page.tsx — Resumo geral do projeto

import { Suspense, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  useResumoProjeto, useUsuarios, useAtualizarProjeto,
} from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import {
  KpiCard, Badge, RdoStatusBadge, ClimaEmoji, Skeleton,
  Modal, Field, Input, Textarea, Select, Btn,
} from '@/components/ui'
import { TarefasContent } from '@/app/(app)/tarefas/page'
import { RdosContent } from '@/app/(app)/rdos/page'
import { numeroRdo, fmtData } from '@/lib/format'
import { toast } from 'sonner'
import { ProjetoTabs } from '@/components/projetos/ProjetoTabs'
import { baixarTodosRdosPdf, baixarMidiasProjeto } from '@/lib/download-projeto'

const STATUS_L: Record<string, string> = { NAO_INICIADO: 'Não iniciado', ATIVO: 'Em andamento', PAUSADO: 'Paralisado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const STATUS_V: Record<string, 'ok' | 'warn' | 'gray' | 'danger' | 'blue'> = { NAO_INICIADO: 'gray', ATIVO: 'blue', PAUSADO: 'warn', CONCLUIDO: 'ok', CANCELADO: 'danger' }

const OC_TIPO_L: Record<string, string> = {
  ATRASO_MATERIAL: 'Atraso de material', PROBLEMA_TECNICO: 'Problema técnico',
  CONDICAO_CLIMATICA: 'Condição climática', FALTA_MAO_DE_OBRA: 'Falta de MO',
  ACIDENTE_INCIDENTE: 'Acidente', PARALISACAO: 'Paralisação', OUTRO: 'Outro',
}
type Categoria = 'fotos' | 'videos' | 'atividades' | 'ocorrencias' | 'comentarios' | 'anexos' | 'clima' | 'maoDeObra' | 'equipamentos'

const CATEGORIAS: { key: Categoria; label: string; icon: string }[] = [
  { key: 'fotos',        label: 'Fotos',                 icon: 'ti-photo' },
  { key: 'videos',       label: 'Vídeos',                icon: 'ti-video' },
  { key: 'atividades',   label: 'Atividades',             icon: 'ti-list-check' },
  { key: 'ocorrencias',  label: 'Ocorrências',            icon: 'ti-alert-triangle' },
  { key: 'comentarios',  label: 'Comentários',            icon: 'ti-message' },
  { key: 'anexos',       label: 'Anexos',                 icon: 'ti-paperclip' },
  { key: 'clima',        label: 'Condições climáticas',   icon: 'ti-cloud' },
  { key: 'maoDeObra',    label: 'Mão de obra',            icon: 'ti-users' },
  { key: 'equipamentos', label: 'Equipamentos',           icon: 'ti-truck' },
]

function calcPrazo(ini?: string, fim?: string) {
  if (!ini || !fim) return null
  const I = new Date(ini), F = new Date(fim), H = new Date()
  const total      = Math.round((F.getTime() - I.getTime()) / 86_400_000)
  const decorridos = Math.max(0, Math.min(total, Math.round((H.getTime() - I.getTime()) / 86_400_000)))
  const restantes  = Math.max(0, total - decorridos)
  return { total, decorridos, restantes, pctDecorrido: total > 0 ? Math.round((decorridos / total) * 100) : 0 }
}

export default function ProjetoResumoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAppAuth()
  const { data, isLoading } = useResumoProjeto(id)
  const { data: usuariosResp } = useUsuarios()
  const gestoresDisponiveis = (usuariosResp?.usuarios ?? []).filter(u => u.status === 'ATIVO')
  const atualizarProjeto = useAtualizarProjeto()

  const [categoria, setCategoria] = useState<Categoria>('fotos')

  const [modalEdit, setModalEdit] = useState(false)
  const [modalTarefas, setModalTarefas] = useState(false)
  const [modalRdos, setModalRdos] = useState(false)
  const [modalConteudo, setModalConteudo] = useState(false)
  const [lightbox, setLightbox] = useState<{ itens: MidiaLightboxItem[]; index: number } | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', descricao: '', pedidoCompraContrato: '', empresaContratada: '', grupo: '', status: 'NAO_INICIADO', gestorId: '', dataInicioContrato: '', dataFimContrato: '' })
  const [fotoEdit, setFotoEdit] = useState<{ file: File | null; preview: string }>({ file: null, preview: '' })
  const [baixandoRdos, setBaixandoRdos] = useState<{ feito: number; total: number } | null>(null)
  const [baixandoMidias, setBaixandoMidias] = useState<{ feito: number; total: number } | null>(null)

  function abrirConteudo(cat: Categoria) {
    setCategoria(cat)
    setModalConteudo(true)
  }

  function abrirRdo(r: { id: string; status: string }) {
    router.push(r.status === 'APROVADO' || r.status === 'PENDENTE_APROVACAO' ? `/aprovacao/${r.id}` : `/rdos/${r.id}`)
  }

  function abrirEdicao() {
    if (!data) return
    setEditForm({
      nome: data.projeto.nome,
      descricao: data.projeto.descricao ?? '',
      pedidoCompraContrato: data.projeto.pedidoCompraContrato ?? '',
      empresaContratada: data.projeto.empresaContratada ?? '',
      grupo: data.projeto.grupo ?? '',
      status: data.projeto.status,
      gestorId: data.projeto.gestor?.id ?? '',
      dataInicioContrato: data.projeto.dataInicioContrato ? data.projeto.dataInicioContrato.slice(0, 10) : '',
      dataFimContrato: data.projeto.dataFimContrato ? data.projeto.dataFimContrato.slice(0, 10) : '',
    })
    setFotoEdit({ file: null, preview: data.projeto.fotoUrl ?? '' })
    setModalEdit(true)
  }

  function onSelecionarFoto(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter até 5MB.'); return }
    setFotoEdit({ file, preview: URL.createObjectURL(file) })
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.nome.trim()) { toast.error('Nome do projeto é obrigatório.'); return }
    try {
      let fotoUrl = data?.projeto.fotoUrl
      if (fotoEdit.file && session?.tenantId) {
        const { uploadFotoProjeto } = await import('@/lib/storage')
        const up = await uploadFotoProjeto({ tenantId: session.tenantId, projetoId: id, file: fotoEdit.file })
        fotoUrl = up.url
      }
      await atualizarProjeto.mutateAsync({
        id,
        nome: editForm.nome,
        descricao: editForm.descricao,
        pedidoCompraContrato: editForm.pedidoCompraContrato,
        empresaContratada: editForm.empresaContratada,
        grupo: editForm.grupo,
        status: editForm.status,
        gestorId: editForm.gestorId,
        fotoUrl,
        dataInicioContrato: editForm.dataInicioContrato,
        dataFimContrato: editForm.dataFimContrato,
      })
      toast.success('Projeto atualizado!')
      setModalEdit(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao atualizar projeto.')
    }
  }

  async function handleBaixarRdos() {
    if (!data) return
    setBaixandoRdos({ feito: 0, total: 0 })
    try {
      await baixarTodosRdosPdf(id, data.projeto.nome, session?.tenantNome, (feito, total) => setBaixandoRdos({ feito, total }))
      toast.success('RDOs baixados em .zip!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao gerar os PDFs dos RDOs.')
    } finally {
      setBaixandoRdos(null)
    }
  }

  async function handleBaixarMidias() {
    if (!data) return
    setBaixandoMidias({ feito: 0, total: 0 })
    try {
      await baixarMidiasProjeto(
        { fotos: data.fotos, videos: data.videos, anexos: data.anexos },
        data.projeto.nome,
        (feito, total) => setBaixandoMidias({ feito, total }),
      )
      toast.success('Fotos, vídeos e arquivos baixados em .zip!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao baixar as mídias.')
    } finally {
      setBaixandoMidias(null)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="main">
        <Topbar titulo="Carregando..." />
        <div className="content"><Skeleton h={400} /></div>
      </div>
    )
  }

  const { projeto, kpis, rdosRecentes } = data
  const fotosRecentes = data.fotos.slice(0, 8)
  const prazo = calcPrazo(projeto.dataInicioContrato, projeto.dataFimContrato)
  const contagens: Record<Categoria, number> = {
    fotos: data.fotos.length, videos: data.videos.length, atividades: data.atividades.length,
    ocorrencias: data.ocorrencias.length, comentarios: data.comentarios.length, anexos: data.anexos.length,
    clima: data.clima.length, maoDeObra: data.maoDeObra.length, equipamentos: data.equipamentos.length,
  }

  return (
    <div className="main">
      <Topbar
        titulo={projeto.nome}
        subtitulo={`${projeto.grupo ? projeto.grupo + ' · ' : ''}${STATUS_L[projeto.status] ?? projeto.status}`}
        acoes={
          <>
            {projeto.status === 'CONCLUIDO' && (
              <>
                <button className="btn btn-sm" onClick={handleBaixarRdos} disabled={!!baixandoRdos}>
                  <i className="ti ti-file-download" />
                  {baixandoRdos ? `Gerando RDOs... ${baixandoRdos.feito}/${baixandoRdos.total || '?'}` : 'Baixar RDOs (PDF)'}
                </button>
                <button className="btn btn-sm" onClick={handleBaixarMidias} disabled={!!baixandoMidias}>
                  <i className="ti ti-download" />
                  {baixandoMidias ? `Baixando... ${baixandoMidias.feito}/${baixandoMidias.total || '?'}` : 'Baixar fotos, vídeos e arquivos'}
                </button>
              </>
            )}
            <button className="btn btn-sm" onClick={() => setModalTarefas(true)}>
              <i className="ti ti-list-check" /> Lista de tarefas
            </button>
            <button className="btn btn-sm" onClick={() => router.push('/painel')}>
              <i className="ti ti-arrow-left" /> Voltar ao Painel
            </button>
          </>
        }
      />

      <div className="content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projeto.podeGerenciar && <ProjetoTabs projetoId={id} ativo="geral" />}

        {/* KPIs — cada um abre a categoria correspondente */}
        <div className="kgrid" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: 0 }}>
          <KpiCard icon="ti-file-text"      valor={kpis.totalRdos}            label="RDOs"        onClick={() => setModalRdos(true)} />
          <KpiCard icon="ti-list-check"     valor={data.atividades.length}    label="Atividades"  onClick={() => setModalTarefas(true)} />
          <KpiCard icon="ti-alert-triangle" valor={data.ocorrencias.length}   label="Ocorrências" cor={kpis.ocorrenciasAbertas > 0 ? 'var(--td)' : undefined} onClick={() => abrirConteudo('ocorrencias')} />
          <KpiCard icon="ti-message"        valor={data.comentarios.length}   label="Comentários" onClick={() => abrirConteudo('comentarios')} />
          <KpiCard icon="ti-photo"          valor={data.fotos.length}         label="Fotos"       cor="var(--tsu)" onClick={() => abrirConteudo('fotos')} />
          <KpiCard icon="ti-video"          valor={data.videos.length}        label="Vídeos"      onClick={() => abrirConteudo('videos')} />
        </div>

        {/* RDOs recentes + Fotos recentes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>
          <div className="sec" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="sec-h">
              <span className="sec-title">RDOs recentes</span>
              <button className="proj-ab" onClick={() => setModalRdos(true)}>Ver tudo</button>
            </div>
            <div className="sec-body" style={{ padding: 0, height: 264, overflowY: 'auto' }}>
              {rdosRecentes.length === 0 ? (
                <Vazio texto="Nenhum RDO emitido ainda." altura={264} />
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Data</th><th>Nº</th><th>Status</th><th style={{ textAlign: 'center' }}>Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rdosRecentes.slice(0, 6).map(r => (
                      <tr key={r.id} onClick={() => abrirRdo(r)}>
                        <td style={{ fontSize: 11, color: 'var(--ts)' }}>{fmtData(r.data)}</td>
                        <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--ta)' }}>#{numeroRdo(r.numero)}</td>
                        <td><RdoStatusBadge status={r.status} assinaturas={r.assinaturas} /></td>
                        <td style={{ textAlign: 'center', fontSize: 10, color: 'var(--tm)' }}>
                          {r.totalFotos > 0 ? <><i className="ti ti-photo" /> {r.totalFotos}</> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="sec" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="sec-h">
              <span className="sec-title">Fotos recentes</span>
              <button className="proj-ab" onClick={() => abrirConteudo('fotos')}>Ver tudo</button>
            </div>
            <div className="sec-body" style={{ height: 264, overflowY: 'auto' }}>
              {fotosRecentes.length === 0 ? (
                <Vazio texto="Nenhuma foto enviada ainda." altura={264} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
                  {fotosRecentes.map((f, i) => (
                    <button key={f.id} onClick={() => setLightbox({ itens: fotosRecentes, index: i })}
                      style={{ display: 'block', aspectRatio: '1', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--s1)', border: '.5px solid var(--b)', padding: 0, cursor: 'pointer' }}>
                      <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informações do projeto */}
        <div className="sec" style={{ marginBottom: 0 }}>
          <div className="sec-h">
            <span className="sec-title">Informações do projeto</span>
            <button className="proj-ab" onClick={abrirEdicao}><i className="ti ti-pencil" /> Editar</button>
          </div>
          <div className="sec-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {projeto.fotoUrl ? (
              <img src={projeto.fotoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 12, background: projeto.cor, flexShrink: 0 }} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, flex: 1 }}>
              <InfoItem label="Status"><Badge variant={STATUS_V[projeto.status] ?? 'gray'}>{STATUS_L[projeto.status] ?? projeto.status}</Badge></InfoItem>
              <InfoItem label="Planejado"><span style={{ color: 'var(--tsu)', fontWeight: 600 }}>{kpis.pctPlanejado}%</span></InfoItem>
              <InfoItem label="Progresso"><span style={{ color: 'var(--ta)', fontWeight: 600 }}>{kpis.pctReal}%</span></InfoItem>
              <InfoItem label="Desvio"><span style={{ color: kpis.desvio >= 0 ? 'var(--tsu)' : 'var(--td)', fontWeight: 600 }}>{kpis.desvio >= 0 ? '+' : ''}{kpis.desvio}%</span></InfoItem>
              <InfoItem label="Grupo">{projeto.grupo ?? '—'}</InfoItem>
              <InfoItem label="Gestor">{projeto.gestor?.nome ?? 'Sem gestor'}</InfoItem>
              <InfoItem label="H/H total">{kpis.totalHH}</InfoItem>
              <InfoItem label="Início do contrato">{projeto.dataInicioContrato ? fmtData(projeto.dataInicioContrato) : '—'}</InfoItem>
              <InfoItem label="Fim do contrato">{projeto.dataFimContrato ? fmtData(projeto.dataFimContrato) : '—'}</InfoItem>
              <InfoItem label="Duração total">{prazo ? `${prazo.total} dias` : '—'}</InfoItem>
              <InfoItem label="Duração decorrida">{prazo ? `${prazo.decorridos} dias` : '—'}</InfoItem>
              <InfoItem label="Duração restante">{prazo ? `${prazo.restantes} dias` : '—'}</InfoItem>
              {prazo && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <InfoItem label={`Avanço do prazo — ${prazo.pctDecorrido}%`}>
                    <div className="hbtr">
                      <div className="hbf" style={{ width: `${prazo.pctDecorrido}%`, background: prazo.pctDecorrido >= 100 ? 'var(--td)' : 'var(--fa)' }} />
                    </div>
                  </InfoItem>
                </div>
              )}
              {(projeto.pedidoCompraContrato || projeto.empresaContratada || projeto.descricao) && (
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
                  {projeto.pedidoCompraContrato && (
                    <InfoItem label="Pedido de compra ou contrato">{projeto.pedidoCompraContrato}</InfoItem>
                  )}
                  {projeto.empresaContratada && (
                    <InfoItem label="Empresa contratada">{projeto.empresaContratada}</InfoItem>
                  )}
                  {projeto.descricao && (
                    <InfoItem label="Descrição">{projeto.descricao}</InfoItem>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Lista de tarefas */}
      <Modal open={modalTarefas} onClose={() => setModalTarefas(false)} titulo="Lista de tarefas" icon="ti-list-check" width={860}>
        <Suspense fallback={<Skeleton h={300} />}>
          {modalTarefas && <TarefasContent projetoIdFixo={id} />}
        </Suspense>
      </Modal>

      {/* Modal RDOs do projeto */}
      <Modal open={modalRdos} onClose={() => setModalRdos(false)} titulo="RDOs do projeto" icon="ti-file-text" width={860}>
        <Suspense fallback={<Skeleton h={300} />}>
          {modalRdos && <RdosContent projetoIdFixo={id} />}
        </Suspense>
      </Modal>

      {/* Modal conteúdo do projeto (fotos, vídeos, ocorrências, comentários, etc.) */}
      <Modal open={modalConteudo} onClose={() => setModalConteudo(false)} titulo="Conteúdo do projeto" icon="ti-folder" width={760}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {CATEGORIAS.map(c => (
            <button
              key={c.key}
              onClick={() => setCategoria(c.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
                borderRadius: 'var(--r)', border: '.5px solid var(--bs)',
                background: categoria === c.key ? 'var(--ta)' : 'var(--s1)',
                color: categoria === c.key ? 'var(--oa)' : 'var(--ts)',
                fontSize: 11, fontWeight: categoria === c.key ? 600 : 400,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
              }}
            >
              <i className={`ti ${c.icon}`} style={{ fontSize: 12 }} /> {c.label} ({contagens[c.key]})
            </button>
          ))}
        </div>
        <ConteudoCategoria categoria={categoria} data={data} onAbrirMidia={(itens, index) => setLightbox({ itens, index })} />
      </Modal>

      {/* Modal editar projeto */}
      <Modal open={modalEdit} onClose={() => setModalEdit(false)} titulo="Editar projeto" icon="ti-pencil"
        rodape={
          <>
            <Btn onClick={() => setModalEdit(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleSalvarEdicao} disabled={atualizarProjeto.isPending}>
              {atualizarProjeto.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Btn>
          </>
        }
      >
        <form onSubmit={handleSalvarEdicao}>
          <Field label="Foto do projeto">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                background: 'var(--s1)', border: '.5px solid var(--bs)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {fotoEdit.preview
                  ? <img src={fotoEdit.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="ti ti-photo" style={{ fontSize: 20, color: 'var(--tm)' }} />}
              </div>
              <span className="proj-ab">
                <i className="ti ti-upload" /> {fotoEdit.preview ? 'Trocar foto' : 'Adicionar foto'}
              </span>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) onSelecionarFoto(f) }} />
            </label>
          </Field>
          <Field label="Nome do projeto *">
            <Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
          </Field>
          <Field label="Descrição">
            <Textarea value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
          </Field>
          <Field label="Pedido de compra ou contrato">
            <Input value={editForm.pedidoCompraContrato} onChange={e => setEditForm(f => ({ ...f, pedidoCompraContrato: e.target.value }))} placeholder="Ex: PC-2026-0142 ou Contrato nº 88/2026" />
          </Field>
          <Field label="Empresa contratada">
            <Input value={editForm.empresaContratada} onChange={e => setEditForm(f => ({ ...f, empresaContratada: e.target.value }))} placeholder="Ex: Construtora Alfa Ltda" />
          </Field>
          <Field label="Grupo">
            <Input value={editForm.grupo} onChange={e => setEditForm(f => ({ ...f, grupo: e.target.value }))} placeholder="Ex: CAPEX, Manutenção, Unidade SP..." />
          </Field>
          <Field label="Status">
            <Select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {Object.entries(STATUS_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Gestor">
            <Select value={editForm.gestorId} onChange={e => setEditForm(f => ({ ...f, gestorId: e.target.value }))}>
              <option value="">Sem gestor</option>
              {gestoresDisponiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>
          <div className="g2">
            <Field label="Início do contrato">
              <Input type="date" value={editForm.dataInicioContrato} onChange={e => setEditForm(f => ({ ...f, dataInicioContrato: e.target.value }))} />
            </Field>
            <Field label="Fim do contrato">
              <Input type="date" value={editForm.dataFimContrato} onChange={e => setEditForm(f => ({ ...f, dataFimContrato: e.target.value }))} />
            </Field>
          </div>
        </form>
      </Modal>

      {lightbox && (
        <Lightbox
          fotos={lightbox.itens}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavegar={i => setLightbox(l => l && { ...l, index: i })}
        />
      )}
    </div>
  )
}

type MidiaLightboxItem = { id: string; url: string; nomeArq?: string; descricao?: string; tipo?: 'FOTO' | 'VIDEO' | 'ARQUIVO' }

function Lightbox({ fotos, index, onClose, onNavegar }: {
  fotos: MidiaLightboxItem[]; index: number; onClose: () => void; onNavegar: (i: number) => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onNavegar((index + 1) % fotos.length)
      else if (e.key === 'ArrowLeft') onNavegar((index - 1 + fotos.length) % fotos.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, fotos.length, onClose, onNavegar])

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0,
    borderRadius: '50%', border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)',
    color: '#fff', cursor: 'pointer', fontSize: 20,
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.9)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20,
      }}
    >
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 10 }}>
        <a href={fotos[index].url} download={fotos[index].nomeArq || `midia-${index + 1}`} title="Baixar"
          onClick={e => e.stopPropagation()} style={{ ...btnStyle, textDecoration: 'none' }}>
          <i className="ti ti-download" />
        </a>
        <button onClick={onClose} title="Fechar" style={btnStyle}>
          <i className="ti ti-x" />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: '100%' }}>
        {fotos.length > 1 && (
          <button onClick={() => onNavegar((index - 1 + fotos.length) % fotos.length)} title="Anterior" style={btnStyle}>
            <i className="ti ti-chevron-left" />
          </button>
        )}
        {fotos[index].tipo === 'VIDEO' ? (
          <video src={fotos[index].url} controls autoPlay onClick={e => e.stopPropagation()}
            style={{ maxWidth: '80vw', maxHeight: '72vh', borderRadius: 8 }} />
        ) : fotos[index].tipo === 'ARQUIVO' ? (
          <div onClick={e => e.stopPropagation()} style={{
            width: 260, padding: '36px 20px', borderRadius: 8,
            background: 'linear-gradient(135deg,#1a3a5c,#0d2035)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <i className="ti ti-file-description" style={{ fontSize: 40, color: 'var(--ta)' }} />
            <span style={{ fontSize: 12, color: '#fff', textAlign: 'center', wordBreak: 'break-word' }}>
              {fotos[index].nomeArq || 'Arquivo'}
            </span>
          </div>
        ) : (
          <img src={fotos[index].url} alt="" style={{ maxWidth: '80vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }} />
        )}
        {fotos.length > 1 && (
          <button onClick={() => onNavegar((index + 1) % fotos.length)} title="Próxima" style={btnStyle}>
            <i className="ti ti-chevron-right" />
          </button>
        )}
      </div>
      {fotos[index].descricao && (
        <div style={{ color: '#fff', fontSize: 13, textAlign: 'center', maxWidth: '70vw' }}>{fotos[index].descricao}</div>
      )}
      {fotos.length > 1 && (
        <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>{index + 1} / {fotos.length}</div>
      )}
    </div>
  )
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--tm)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--tp)' }}>{children}</div>
    </div>
  )
}

function Vazio({ texto, altura }: { texto: string; altura?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: altura, minHeight: altura ? undefined : 'auto',
      textAlign: 'center', padding: 28, color: 'var(--tm)', fontSize: 11,
    }}>
      {texto}
    </div>
  )
}

function ConteudoCategoria({ categoria, data, onAbrirMidia }: {
  categoria: Categoria; data: NonNullable<ReturnType<typeof useResumoProjeto>['data']>
  onAbrirMidia: (itens: MidiaLightboxItem[], index: number) => void
}) {
  if (categoria === 'fotos' || categoria === 'videos' || categoria === 'anexos') {
    const itens = data[categoria]
    if (itens.length === 0) return <Vazio texto="Nenhum registro nesta categoria." />
    const tipo = categoria === 'fotos' ? 'FOTO' : categoria === 'videos' ? 'VIDEO' : 'ARQUIVO'
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {itens.map((m, i) => {
          const conteudoThumb = (
            <div style={{ aspectRatio: '1', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--s1)', border: '.5px solid var(--b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {categoria === 'fotos' ? (
                <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : categoria === 'videos' ? (
                <video src={m.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <i className="ti ti-file-description" style={{ fontSize: 26, color: 'var(--ta)', opacity: .7 }} />
              )}
            </div>
          )
          const legenda = (
            <div style={{ fontSize: 9.5, color: 'var(--tm)', marginTop: 3, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              RDO #{numeroRdo(m.rdoNumero)} · {fmtData(m.rdoData)}
            </div>
          )
          return (
            <button key={m.id}
              onClick={() => onAbrirMidia(itens.map(x => ({ id: x.id, url: x.url, nomeArq: x.nomeArq, descricao: x.descricao, tipo })), i)}
              style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
              {conteudoThumb}
              {legenda}
            </button>
          )
        })}
      </div>
    )
  }

  if (categoria === 'atividades') {
    if (data.atividades.length === 0) return <Vazio texto="Nenhum registro de atividade." />
    return (
      <div>
        {data.atividades.map(a => (
          <div key={a.id} className="hbr">
            <div className="hbt">
              <span>{a.nome}</span>
              <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(a.rdoNumero)} · {fmtData(a.rdoData)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ts)' }}>
              {a.pctAnterior}% → <strong>{a.pctAtual}%</strong>{' '}
              <span style={{ color: a.deltaHoje >= 0 ? 'var(--tsu)' : 'var(--td)' }}>
                ({a.deltaHoje >= 0 ? '+' : ''}{a.deltaHoje}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (categoria === 'ocorrencias') {
    if (data.ocorrencias.length === 0) return <Vazio texto="Nenhuma ocorrência registrada." />
    return (
      <div>
        {data.ocorrencias.map(o => (
          <div key={o.id} className="hbr">
            <div className="hbt">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge variant="gray">{OC_TIPO_L[o.tipo] ?? o.tipo}</Badge>
                {!o.resolvida && <Badge variant="danger">Aberta</Badge>}
              </span>
              <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(o.rdoNumero)} · {fmtData(o.rdoData)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ts)' }}>{o.descricao}</div>
          </div>
        ))}
      </div>
    )
  }

  if (categoria === 'comentarios') {
    if (data.comentarios.length === 0) return <Vazio texto="Nenhum comentário registrado." />
    return (
      <div>
        {data.comentarios.map(c => (
          <div key={c.id} className="hbr">
            <div className="hbt">
              <span style={{ fontWeight: 500 }}>{c.autorNome}</span>
              <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(c.rdoNumero)} · {fmtData(c.rdoData)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ts)' }}>{c.texto}</div>
            {c.totalRespostas > 0 && (
              <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>
                <i className="ti ti-corner-down-right" /> {c.totalRespostas} resposta{c.totalRespostas !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (categoria === 'clima') {
    if (data.clima.length === 0) return <Vazio texto="Nenhum registro climático." />
    return (
      <div>
        {data.clima.map(c => (
          <div key={c.rdoId} className="hbr">
            <div className="hbt">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClimaEmoji condicao={c.climaManha} /> <ClimaEmoji condicao={c.climaTarde} /> {c.climaNoite && <ClimaEmoji condicao={c.climaNoite} noite />}
                {c.precipitacaoMm != null && <span style={{ fontSize: 11, color: 'var(--ts)' }}>{c.precipitacaoMm}mm</span>}
              </span>
              <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(c.rdoNumero)} · {fmtData(c.rdoData)}</span>
            </div>
            {c.climaImpacto && c.climaImpacto !== 'NENHUM' && (
              <div style={{ fontSize: 11, color: 'var(--tw)' }}>Impacto: {c.climaImpacto === 'PARCIAL' ? 'Parcial' : 'Total'}</div>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (categoria === 'maoDeObra') {
    if (data.maoDeObra.length === 0) return <Vazio texto="Nenhum registro de mão de obra." />
    return (
      <div>
        {data.maoDeObra.map((m, i) => (
          <div key={i} className="hbr">
            <div className="hbt">
              <span>{m.funcaoNome} · {m.quantidade} pessoa{m.quantidade !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(m.rdoNumero)} · {fmtData(m.rdoData)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ts)' }}>{m.horaEntrada}–{m.horaSaida} · {m.totalHH} H/H</div>
          </div>
        ))}
      </div>
    )
  }

  // equipamentos
  if (data.equipamentos.length === 0) return <Vazio texto="Nenhum registro de equipamento." />
  return (
    <div>
      {data.equipamentos.map((e, i) => (
        <div key={i} className="hbr">
          <div className="hbt">
            <span>{e.equipamentoNome} · {e.quantidade}</span>
            <span style={{ fontSize: 10, color: 'var(--tm)' }}>RDO #{numeroRdo(e.rdoNumero)} · {fmtData(e.rdoData)}</span>
          </div>
          {e.observacao && <div style={{ fontSize: 11, color: 'var(--ts)' }}>{e.observacao}</div>}
        </div>
      ))}
    </div>
  )
}
