'use client'
// src/app/tarefas/page.tsx — Lista de Tarefas (EAP)

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useEap, useCriarEtapa, useCriarAtividade, useProjetos,
  useAtualizarEtapa, useAtualizarAtividade, useRemoverAtividade, useRemoverEtapa,
} from '@/hooks/useEmpresa'
import { Topbar }  from '@/components/layout/Topbar'
import { useAppAuth } from '@/contexts/AuthContext'
import { KpiCard, Badge, Modal, Field, Input, Select, Skeleton, AutocompleteSearchInput } from '@/components/ui'
import { toast }   from 'sonner'
import type { AtividadeStatus } from '@/lib/types'
import { fmtData } from '@/lib/format'
import { calcStatusEfetivo, calcPctPlanejado, calcProgressoPonderado } from '@/lib/rdo-display'
import { mensagemErro } from '@/lib/api'

// Colunas da tabela de atividades — cabeçalho e linhas usam exatamente o mesmo
// grid, pra ficarem alinhados de verdade (em vez de flex com minWidth aproximado).
const EAP_COLS = '80px 1fr 130px 70px 70px 100px 170px'

const ST_L: Record<AtividadeStatus, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA:    'Concluída',
  EM_ATRASO:    'Em atraso',
}
const ST_V: Record<AtividadeStatus, string> = {
  NAO_INICIADA: 'gray',
  EM_ANDAMENTO: 'blue',
  CONCLUIDA:    'ok',
  EM_ATRASO:    'danger',
}

export default function TarefasPage() {
  return (
    <Suspense fallback={<div className="main"><div className="content"><Skeleton h={300} /></div></div>}>
      <TarefasContent />
    </Suspense>
  )
}

// projetoIdFixo: quando informado, trava a EAP nesse projeto, omite o Topbar e o
// seletor de projeto — usado para embutir dentro do modal "Lista de tarefas" no
// resumo do projeto.
export function TarefasContent({ projetoIdFixo }: { projetoIdFixo?: string } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { pode } = useAppAuth()
  const podeGerenciar = pode('gerenciar_tarefas')
  const { data: projetos = [] } = useProjetos()
  const [projetoId, setProjetoId] = useState(() => projetoIdFixo ?? searchParams.get('projetoId') ?? '')
  const { data, isLoading } = useEap(projetoId)
  const criarEtapa    = useCriarEtapa()
  const criarAtividade = useCriarAtividade()
  const atualizarEtapa = useAtualizarEtapa()
  const atualizarAtividade = useAtualizarAtividade()
  const removerAtividade = useRemoverAtividade()
  const removerEtapa = useRemoverEtapa()

  // Seleciona o primeiro projeto automaticamente quando a lista carrega
  // (só quando não veio um projeto específico pela URL nem travado via prop)
  useEffect(() => {
    if (!projetoIdFixo && !projetoId && projetos.length > 0) setProjetoId(projetos[0].id)
  }, [projetoIdFixo, projetos, projetoId])

  const [busca, setBusca]     = useState('')
  const [filtSt, setFiltSt]   = useState('')
  const [modalEt, setModalEt] = useState(false)
  const [modalAv, setModalAv] = useState(false)

  // Form nova etapa
  const [etNome, setEtNome]   = useState('')
  const [etNum,  setEtNum]    = useState('')

  // Form nova atividade
  const [avEtapa, setAvEtapa] = useState('')
  const [avNome,  setAvNome]  = useState('')
  const [avIni,   setAvIni]   = useState('')
  const [avFim,   setAvFim]   = useState('')
  const [avSt,    setAvSt]    = useState<AtividadeStatus>('NAO_INICIADA')
  const [avPct,   setAvPct]   = useState(0)

  // Edição de etapa
  const [etapaEditando, setEtapaEditando] = useState<{ id: string; numero: string; nome: string } | null>(null)
  const [editEtNome, setEditEtNome] = useState('')
  const [editEtNum,  setEditEtNum]  = useState('')

  // Edição de atividade
  const [atividadeEditando, setAtividadeEditando] = useState<{ id: string } | null>(null)
  const [editAvNome, setEditAvNome] = useState('')
  const [editAvIni,  setEditAvIni]  = useState('')
  const [editAvFim,  setEditAvFim]  = useState('')
  const [editAvSt,   setEditAvSt]   = useState<AtividadeStatus>('NAO_INICIADA')
  const [editAvPct,  setEditAvPct]  = useState(0)

  const etapas    = data?.etapas ?? []
  const kpis      = data?.kpis   ?? { total: 0, nao: 0, andamento: 0, concluida: 0, atraso: 0, pctMedio: 0, pctPlanejado: 0 }

  async function salvarEtapa() {
    if (!etNome.trim()) { toast.error('Informe o nome.'); return }
    try {
      await criarEtapa.mutateAsync({ projetoId, nome: etNome, numero: etNum || undefined })
      toast.success(`"${etNome}" criada!`)
      setModalEt(false); setEtNome(''); setEtNum('')
    } catch { toast.error('Erro ao criar etapa.') }
  }

  async function salvarAtividade() {
    if (!avNome.trim() || !avEtapa) { toast.error('Informe etapa e nome.'); return }
    try {
      await criarAtividade.mutateAsync({
        projetoId, etapaId: avEtapa,
        nome: avNome, dataInicio: avIni || undefined, dataFim: avFim || undefined,
        status: avSt, pctAcumulado: avPct,
      })
      toast.success(`"${avNome}" criada!`)
      setModalAv(false); setAvNome(''); setAvIni(''); setAvFim(''); setAvPct(0)
    } catch { toast.error('Erro ao criar atividade.') }
  }

  function abrirEdicaoEtapa(etapa: { id: string; numero: string; nome: string }) {
    setEtapaEditando(etapa)
    setEditEtNome(etapa.nome)
    setEditEtNum(etapa.numero)
  }

  async function salvarEdicaoEtapa() {
    if (!etapaEditando) return
    if (!editEtNome.trim()) { toast.error('Informe o nome.'); return }
    try {
      await atualizarEtapa.mutateAsync({ id: etapaEditando.id, projetoId, nome: editEtNome, numero: editEtNum })
      toast.success('Etapa atualizada!')
      setEtapaEditando(null)
    } catch (err) { toast.error(mensagemErro(err, 'Erro ao atualizar etapa.')) }
  }

  function abrirEdicaoAtividade(a: {
    id: string; nome: string; dataInicio?: string | null; dataFim?: string | null
    status: AtividadeStatus; pctAcumulado: number
  }) {
    setAtividadeEditando({ id: a.id })
    setEditAvNome(a.nome)
    setEditAvIni(a.dataInicio ? a.dataInicio.slice(0, 10) : '')
    setEditAvFim(a.dataFim ? a.dataFim.slice(0, 10) : '')
    setEditAvSt(a.status)
    setEditAvPct(a.pctAcumulado)
  }

  async function salvarEdicaoAtividade() {
    if (!atividadeEditando) return
    if (!editAvNome.trim()) { toast.error('Informe o nome.'); return }
    try {
      await atualizarAtividade.mutateAsync({
        id: atividadeEditando.id, projetoId,
        nome: editAvNome, dataInicio: editAvIni || undefined, dataFim: editAvFim || undefined,
        status: editAvSt, pctAcumulado: editAvPct,
      })
      toast.success('Atividade atualizada!')
      setAtividadeEditando(null)
    } catch (err) { toast.error(mensagemErro(err, 'Erro ao atualizar atividade.')) }
  }

  async function excluirAtividade(a: { id: string; nome: string }) {
    if (!window.confirm(`Remover a atividade "${a.nome}"? Essa ação não pode ser desfeita.`)) return
    try {
      await removerAtividade.mutateAsync({ id: a.id, projetoId })
      toast.success('Atividade removida.')
    } catch (err) { toast.error(mensagemErro(err, 'Erro ao remover atividade.')) }
  }

  async function excluirEtapa(etapa: { id: string; nome: string }) {
    if (!window.confirm(`Remover a etapa "${etapa.nome}"? Essa ação não pode ser desfeita.`)) return
    try {
      await removerEtapa.mutateAsync({ id: etapa.id, projetoId })
      toast.success('Etapa removida.')
    } catch (err) { toast.error(mensagemErro(err, 'Erro ao remover etapa.')) }
  }

  const corpo = (
        <>
        <div className="fr-row">
          {!projetoIdFixo && (
            <select className="fsel" value={projetoId} onChange={e => setProjetoId(e.target.value)}>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          <AutocompleteSearchInput placeholder="Buscar atividade..." value={busca} onChange={setBusca}
            opcoes={etapas.flatMap(e => e.atividades).map(a => ({ id: a.id, label: a.nome, sublabel: a.numero }))} />
          <select className="fsel" value={filtSt} onChange={e => setFiltSt(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(ST_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {projetoIdFixo && podeGerenciar && (
            <>
              <button className="btn btn-sm" onClick={() => setModalEt(true)}>
                <i className="ti ti-folder-plus" /> Nova etapa
              </button>
              <button className="btn btn-p btn-sm" onClick={() => setModalAv(true)}>
                <i className="ti ti-plus" /> Nova atividade
              </button>
            </>
          )}
        </div>

        <div className="kgrid" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
          <KpiCard icon="ti-list"             valor={kpis.total}     label="Total" />
          <KpiCard icon="ti-circle"           valor={kpis.nao}       label="Não iniciadas"  cor="var(--tm)" />
          <KpiCard icon="ti-trending-up"      valor={kpis.andamento} label="Em andamento"   cor="var(--ta)" />
          <KpiCard icon="ti-circle-check"     valor={kpis.concluida} label="Concluídas"     cor="var(--tsu)" />
          <KpiCard icon="ti-alert-triangle"   valor={kpis.atraso}    label="Em atraso"      cor="var(--td)" />
          <KpiCard icon="ti-chart-pie"        valor={`${kpis.pctMedio}%`} label="% Realizado" cor="var(--ta)" />
          <KpiCard icon="ti-calendar-time"    valor={`${kpis.pctPlanejado}%`} label="% Planejado" cor="var(--tsu)" />
        </div>

        <div className="tw">
          {/* Cabeçalho */}
          <div style={{ display: 'grid', gridTemplateColumns: EAP_COLS, padding: '6px 11px', background: 'var(--s1)', borderBottom: '.5px solid var(--b)', fontSize: 10, fontWeight: 500, color: 'var(--ts)' }}>
            <div>Cód.</div><div>Descrição</div><div>Período</div>
            <div style={{ textAlign: 'center' }}>% Realizada</div>
            <div style={{ textAlign: 'center' }}>% Planejado</div>
            <div style={{ textAlign: 'center' }}>Status</div>
            <div></div>
          </div>

          {isLoading ? <Skeleton h={300} /> : etapas.map(etapa => {
            const ativsFiltradas = etapa.atividades.filter(a =>
              (!busca || a.nome.toLowerCase().includes(busca.toLowerCase())) &&
              (!filtSt || calcStatusEfetivo(a) === filtSt),
            )
            if (busca && ativsFiltradas.length === 0) return null

            const cor = (pct: number) => pct >= 100 ? 'var(--fsu)' : pct >= 50 ? 'var(--fa)' : pct > 0 ? 'var(--fw)' : 'var(--bs)'
            const pctRealEtapa = calcProgressoPonderado(etapa.atividades)
            const pctPlanEtapa = calcPctPlanejado(etapa.atividades)

            return (
              <div key={etapa.id}>
                <div className="eap-etapa">
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ta)', minWidth: 30 }}>{etapa.numero}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{etapa.nome}</span>
                  <span style={{ fontSize: 10, color: 'var(--tm)' }}>{etapa.atividades.length} atividade{etapa.atividades.length !== 1 ? 's' : ''}</span>
                  {etapa.atividades.length > 0 && (
                    <>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ta)' }}>Real. {pctRealEtapa}%</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tsu)' }}>Plan. {pctPlanEtapa}%</span>
                    </>
                  )}
                  {podeGerenciar && (
                    <div className="proj-ac">
                      <button className="proj-ab" onClick={() => abrirEdicaoEtapa(etapa)} title="Editar etapa">
                        <i className="ti ti-pencil" /> Editar
                      </button>
                      <button className="proj-ab" onClick={() => excluirEtapa(etapa)} title="Remover etapa">
                        <i className="ti ti-trash" /> Remover
                      </button>
                    </div>
                  )}
                </div>

                {ativsFiltradas.map(a => {
                  const efetivo = calcStatusEfetivo(a)
                  const pctPlan = calcPctPlanejado([a])
                  return (
                  <div key={a.id} className="eap-ativ" style={{ display: 'grid', gridTemplateColumns: EAP_COLS, gap: 0 }} onClick={() => router.push(`/rdos/novo?atividadeId=${a.id}`)}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ta)' }}>{a.numero}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{a.nome}</span>
                    <span style={{ fontSize: 10, color: 'var(--tm)' }}>
                      {a.dataInicio ? fmtData(a.dataInicio) : '—'} →{' '}
                      {a.dataFim    ? fmtData(a.dataFim)    : '—'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                      <div className="pct-mini">
                        <div className="pct-mini-f" style={{ width: `${a.pctAcumulado}%`, background: cor(a.pctAcumulado) }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: cor(a.pctAcumulado) }}>{a.pctAcumulado}%</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--tsu)' }}>
                      {pctPlan}%
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Badge variant={ST_V[efetivo] as any}>{ST_L[efetivo]}</Badge>
                    </div>
                    {podeGerenciar && (
                      <div className="proj-ac" style={{ justifyContent: 'flex-end' }}>
                        <button className="proj-ab" onClick={e => { e.stopPropagation(); abrirEdicaoAtividade(a) }} title="Editar atividade"><i className="ti ti-pencil" /> Editar</button>
                        <button className="proj-ab" onClick={e => { e.stopPropagation(); excluirAtividade(a) }} title="Remover atividade"><i className="ti ti-trash" /> Remover</button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        </>
  )

  return (
    <>
    {projetoIdFixo ? (
      <div className="content" style={{ paddingTop: 0 }}>
        {corpo}
      </div>
    ) : (
      <div className="main">
        <Topbar
          titulo="Lista de tarefas"
          subtitulo="Estrutura Analítica do Projeto"
          acoes={
            podeGerenciar && (
              <>
                <button className="btn" onClick={() => setModalEt(true)} disabled={!projetoId}>
                  <i className="ti ti-folder-plus" /> Nova etapa
                </button>
                <button className="btn btn-p" onClick={() => setModalAv(true)} disabled={!projetoId}>
                  <i className="ti ti-plus" /> Nova atividade
                </button>
              </>
            )
          }
        />
        <div className="content">
          {projetos.length === 0 ? (
            <div className="tw" style={{ padding: 32, textAlign: 'center', color: 'var(--tm)' }}>
              Nenhum projeto cadastrado. Crie um projeto no Painel antes de montar a lista de tarefas.
            </div>
          ) : corpo}
        </div>
      </div>
    )}

      {/* Modal Nova Etapa */}
      <Modal
        open={modalEt} onClose={() => setModalEt(false)}
        titulo="Nova etapa" icon="ti-folder-plus" width={400}
        rodape={
          <>
            <button className="btn" onClick={() => setModalEt(false)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarEtapa} disabled={criarEtapa.isPending}>
              <i className="ti ti-plus" /> {criarEtapa.isPending ? 'Criando...' : 'Criar'}
            </button>
          </>
        }
      >
        <div className="g2">
          <Field label="Número"><Input value={etNum} onChange={e => setEtNum(e.target.value)} placeholder="Ex: 1.0" /></Field>
          <Field label="Nome da etapa *"><Input value={etNome} onChange={e => setEtNome(e.target.value)} placeholder="Ex: Fundação" /></Field>
        </div>
      </Modal>

      {/* Modal Nova Atividade */}
      <Modal
        open={modalAv} onClose={() => setModalAv(false)}
        titulo="Nova atividade" icon="ti-plus" width={460}
        rodape={
          <>
            <button className="btn" onClick={() => setModalAv(false)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarAtividade} disabled={criarAtividade.isPending}>
              <i className="ti ti-plus" /> {criarAtividade.isPending ? 'Criando...' : 'Criar'}
            </button>
          </>
        }
      >
        <Field label="Etapa *">
          <Select value={avEtapa} onChange={e => setAvEtapa(e.target.value)}>
            <option value="">Selecione...</option>
            {etapas.map(e => <option key={e.id} value={e.id}>{e.numero} · {e.nome}</option>)}
          </Select>
        </Field>
        <Field label="Nome / descrição *">
          <Input value={avNome} onChange={e => setAvNome(e.target.value)} placeholder="Descreva a atividade" />
        </Field>
        <div className="g2">
          <Field label="Início"><Input type="date" value={avIni} onChange={e => setAvIni(e.target.value)} /></Field>
          <Field label="Término"><Input type="date" value={avFim} onChange={e => setAvFim(e.target.value)} /></Field>
        </div>
        <div className="g2">
          <Field label="Status">
            <Select value={avSt} onChange={e => setAvSt(e.target.value as AtividadeStatus)}>
              {Object.entries(ST_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="% inicial">
            <Input type="number" min={0} max={100} value={avPct} onChange={e => setAvPct(Number(e.target.value))} />
          </Field>
        </div>
      </Modal>

      {/* Modal Editar Etapa */}
      <Modal
        open={!!etapaEditando} onClose={() => setEtapaEditando(null)}
        titulo="Editar etapa" icon="ti-pencil" width={400}
        rodape={
          <>
            <button className="btn" onClick={() => setEtapaEditando(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarEdicaoEtapa} disabled={atualizarEtapa.isPending}>
              <i className="ti ti-check" /> {atualizarEtapa.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="g2">
          <Field label="Número"><Input value={editEtNum} onChange={e => setEditEtNum(e.target.value)} placeholder="Ex: 1.0" /></Field>
          <Field label="Nome da etapa *"><Input value={editEtNome} onChange={e => setEditEtNome(e.target.value)} placeholder="Ex: Fundação" /></Field>
        </div>
      </Modal>

      {/* Modal Editar Atividade */}
      <Modal
        open={!!atividadeEditando} onClose={() => setAtividadeEditando(null)}
        titulo="Editar atividade" icon="ti-pencil" width={460}
        rodape={
          <>
            <button className="btn" onClick={() => setAtividadeEditando(null)}>Cancelar</button>
            <button className="btn btn-p" onClick={salvarEdicaoAtividade} disabled={atualizarAtividade.isPending}>
              <i className="ti ti-check" /> {atualizarAtividade.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <Field label="Nome / descrição *">
          <Input value={editAvNome} onChange={e => setEditAvNome(e.target.value)} placeholder="Descreva a atividade" />
        </Field>
        <div className="g2">
          <Field label="Início"><Input type="date" value={editAvIni} onChange={e => setEditAvIni(e.target.value)} /></Field>
          <Field label="Término"><Input type="date" value={editAvFim} onChange={e => setEditAvFim(e.target.value)} /></Field>
        </div>
        <div className="g2">
          <Field label="Status">
            <Select value={editAvSt} onChange={e => setEditAvSt(e.target.value as AtividadeStatus)}>
              {Object.entries(ST_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="% acumulado">
            <Input type="number" min={0} max={100} value={editAvPct} onChange={e => setEditAvPct(Number(e.target.value))} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
