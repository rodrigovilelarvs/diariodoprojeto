'use client'
// src/app/painel/page.tsx

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useProjetos, useCriarRdo, useCriarProjeto, useAtualizarProjeto, useExcluirProjeto, useDuplicarProjeto, useUsuarios } from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import { Topbar }    from '@/components/layout/Topbar'
import { KpiCard, DualBar, Desvio, Badge, Skeleton, AutocompleteSearchInput, Modal, Field, Input, Textarea, Select, Btn } from '@/components/ui'
import { toast }     from 'sonner'
import type { Projeto } from '@/lib/types'
import { mensagemErro } from '@/lib/api'

const STATUS_L: Record<string, string> = { NAO_INICIADO: 'Não iniciado', ATIVO: 'Em andamento', PAUSADO: 'Paralisado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }
const STATUS_V: Record<string, 'ok' | 'warn' | 'gray' | 'danger' | 'blue'> = { NAO_INICIADO: 'gray', ATIVO: 'blue', PAUSADO: 'warn', CONCLUIDO: 'ok', CANCELADO: 'danger' }

const PREFS_KEY = 'painel_prefs'

function lerPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
  } catch {
    return null
  }
}

export default function PainelPage() {
  const router  = useRouter()
  const { session } = useAppAuth()
  const { data: projetos = [], isLoading } = useProjetos()
  const { data: usuariosResp } = useUsuarios()
  const gestoresDisponiveis = (usuariosResp?.usuarios ?? []).filter(u => u.status === 'ATIVO')
  const criarRdo      = useCriarRdo()
  const criarProjeto  = useCriarProjeto()
  const atualizarProjeto = useAtualizarProjeto()
  const excluirProjeto   = useExcluirProjeto()
  const duplicarProjeto  = useDuplicarProjeto()

  const [busca, setBusca]   = useState('')
  const [filtSt, setFiltSt] = useState('')
  const [filtGrupo, setFiltGrupo] = useState('')
  const [view,   setView]   = useState<'table' | 'cards'>('table')
  const [prefsCarregadas, setPrefsCarregadas] = useState(false)

  // Restaura filtros/visualização salvos ao montar (após o mount para evitar
  // divergência entre a renderização no servidor e no cliente)
  useEffect(() => {
    const p = lerPrefs()
    if (p) {
      setBusca(p.busca ?? '')
      setFiltSt(p.filtSt ?? '')
      setFiltGrupo(p.filtGrupo ?? '')
      setView(p.view === 'cards' ? 'cards' : 'table')
    }
    setPrefsCarregadas(true)
  }, [])

  useEffect(() => {
    if (!prefsCarregadas) return
    localStorage.setItem(PREFS_KEY, JSON.stringify({ busca, filtSt, filtGrupo, view }))
  }, [prefsCarregadas, busca, filtSt, filtGrupo, view])

  const [modalProjeto, setModalProjeto] = useState(false)
  const [formProjeto, setFormProjeto]   = useState({ nome: '', descricao: '', pedidoCompraContrato: '', empresaContratada: '', grupo: '', gestorId: '', dataInicioContrato: '', dataFimContrato: '' })
  const [fotoNovo, setFotoNovo] = useState<{ file: File | null; preview: string }>({ file: null, preview: '' })

  const [modalEdit, setModalEdit] = useState<Projeto | null>(null)
  const [editForm, setEditForm]   = useState({ nome: '', descricao: '', pedidoCompraContrato: '', empresaContratada: '', grupo: '', status: 'NAO_INICIADO', gestorId: '', dataInicioContrato: '', dataFimContrato: '' })
  const [fotoEdit, setFotoEdit] = useState<{ file: File | null; preview: string }>({ file: null, preview: '' })

  const [modalDuplicar, setModalDuplicar] = useState<Projeto | null>(null)
  const [comConteudo, setComConteudo]     = useState(false)

  const grupos = Array.from(new Set(projetos.map(p => p.grupo).filter((g): g is string => !!g))).sort()

  const filtrados = projetos.filter(p =>
    (!busca     || p.nome.toLowerCase().includes(busca.toLowerCase())) &&
    (!filtSt    || p.status === filtSt) &&
    (!filtGrupo || p.grupo === filtGrupo),
  )

  // KPIs calculados a partir da lista filtrada — sem filtro, filtrados === projetos (mostra o total)
  const ativos      = filtrados.filter(p => p.status === 'ATIVO').length
  const totalRdos   = filtrados.reduce((s, p) => s + p._count.rdos, 0)
  const pctMedio    = filtrados.length ? Math.round(filtrados.reduce((s, p) => s + p.pctReal, 0) / filtrados.length) : 0
  const desvioMedio = filtrados.length ? Math.round(filtrados.reduce((s, p) => s + p.desvio, 0) / filtrados.length) : 0
  const ocorrenciasAbertas = filtrados.reduce((s, p) => s + p.ocorrenciasAbertas, 0)

  async function handleNovoRdo(projetoId: string) {
    try {
      const rdo = await criarRdo.mutateAsync({
        projetoId,
        data: new Date().toISOString().slice(0, 10),
        copiarAnterior: true,
      })
      router.push(`/rdos/${rdo.id}`)
    } catch {
      toast.error('Erro ao criar RDO.')
    }
  }

  function onSelecionarFoto(file: File, alvo: 'novo' | 'edit') {
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter até 5MB.'); return }
    const preview = URL.createObjectURL(file)
    if (alvo === 'novo') setFotoNovo({ file, preview })
    else setFotoEdit({ file, preview })
  }

  async function handleCriarProjeto(e: React.FormEvent) {
    e.preventDefault()
    if (!formProjeto.nome) { toast.error('Nome do projeto é obrigatório.'); return }
    try {
      const criado = await criarProjeto.mutateAsync({
        nome:               formProjeto.nome,
        descricao:          formProjeto.descricao || undefined,
        pedidoCompraContrato: formProjeto.pedidoCompraContrato || undefined,
        empresaContratada:  formProjeto.empresaContratada || undefined,
        grupo:              formProjeto.grupo || undefined,
        gestorId:           formProjeto.gestorId || undefined,
        dataInicioContrato: formProjeto.dataInicioContrato || undefined,
        dataFimContrato:    formProjeto.dataFimContrato || undefined,
      })
      if (fotoNovo.file && session?.tenantId) {
        try {
          const { uploadFotoProjeto } = await import('@/lib/storage')
          const { url } = await uploadFotoProjeto({ tenantId: session.tenantId, projetoId: criado.id, file: fotoNovo.file })
          await atualizarProjeto.mutateAsync({ id: criado.id, fotoUrl: url })
        } catch {
          toast.error('Projeto criado, mas a foto não pôde ser enviada.')
        }
      }
      toast.success(`Projeto "${formProjeto.nome}" criado!`)
      setModalProjeto(false)
      setFormProjeto({ nome: '', descricao: '', pedidoCompraContrato: '', empresaContratada: '', grupo: '', gestorId: '', dataInicioContrato: '', dataFimContrato: '' })
      setFotoNovo({ file: null, preview: '' })
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao criar projeto.'))
    }
  }

  function abrirEdicao(p: Projeto) {
    setModalEdit(p)
    setEditForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      pedidoCompraContrato: p.pedidoCompraContrato ?? '',
      empresaContratada: p.empresaContratada ?? '',
      grupo: p.grupo ?? '',
      status: p.status,
      gestorId: p.gestor?.id ?? '',
      dataInicioContrato: p.dataInicioContrato ? p.dataInicioContrato.slice(0, 10) : '',
      dataFimContrato: p.dataFimContrato ? p.dataFimContrato.slice(0, 10) : '',
    })
    setFotoEdit({ file: null, preview: p.fotoUrl ?? '' })
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!modalEdit) return
    if (!editForm.nome.trim()) { toast.error('Nome do projeto é obrigatório.'); return }
    try {
      let fotoUrl = modalEdit.fotoUrl
      if (fotoEdit.file && session?.tenantId) {
        const { uploadFotoProjeto } = await import('@/lib/storage')
        const up = await uploadFotoProjeto({ tenantId: session.tenantId, projetoId: modalEdit.id, file: fotoEdit.file })
        fotoUrl = up.url
      }
      await atualizarProjeto.mutateAsync({
        id: modalEdit.id,
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
      toast.success(`"${editForm.nome}" atualizado!`)
      setModalEdit(null)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao atualizar projeto.'))
    }
  }

  async function handleExcluir(p: Projeto) {
    if (!window.confirm(`Excluir o projeto "${p.nome}"? Todos os RDOs, atividades, ocorrências, comentários e mídias desse projeto serão apagados permanentemente. Essa ação não pode ser desfeita.`)) return
    try {
      await excluirProjeto.mutateAsync(p.id)
      toast.success(`Projeto "${p.nome}" excluído.`)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao excluir projeto.'))
    }
  }

  function abrirDuplicar(p: Projeto) {
    setModalDuplicar(p)
    setComConteudo(false)
  }

  async function handleDuplicar(e: React.FormEvent) {
    e.preventDefault()
    if (!modalDuplicar) return
    try {
      const copia = await duplicarProjeto.mutateAsync({ id: modalDuplicar.id, comConteudo })
      toast.success(`Projeto duplicado como "${copia.nome}"!`)
      setModalDuplicar(null)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao duplicar projeto.'))
    }
  }

  return (
    <div className="main">
      <datalist id="grupos-existentes">
        {grupos.map(g => <option key={g} value={g} />)}
      </datalist>
      <Topbar
        titulo="Painel geral"
        subtitulo={`Visão geral de todos os projetos · ${new Date().toLocaleDateString('pt-BR')}`}
        acoes={
          <>
            <button className="btn btn-sm" onClick={() => setModalProjeto(true)}>
              <i className="ti ti-folder-plus" /> Novo projeto
            </button>
            <button className="btn btn-p btn-sm" onClick={() => router.push('/rdos/novo')}>
              <i className="ti ti-plus" /> Novo RDO
            </button>
          </>
        }
      />

      <Modal open={modalProjeto} onClose={() => setModalProjeto(false)} titulo="Novo projeto" icon="ti-folder-plus"
        rodape={
          <>
            <Btn onClick={() => setModalProjeto(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleCriarProjeto} disabled={criarProjeto.isPending}>
              {criarProjeto.isPending ? 'Criando...' : 'Criar projeto'}
            </Btn>
          </>
        }
      >
        <form onSubmit={handleCriarProjeto}>
          <Field label="Foto do projeto">
            <FotoPicker preview={fotoNovo.preview} onSelecionar={file => onSelecionarFoto(file, 'novo')} />
          </Field>
          <Field label="Nome do projeto *">
            <Input value={formProjeto.nome} onChange={e => setFormProjeto(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Reforma Edifício Central" />
          </Field>
          <Field label="Descrição">
            <Textarea value={formProjeto.descricao} onChange={e => setFormProjeto(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes do projeto (opcional)" />
          </Field>
          <Field label="Pedido de compra ou contrato">
            <Input value={formProjeto.pedidoCompraContrato} onChange={e => setFormProjeto(f => ({ ...f, pedidoCompraContrato: e.target.value }))} placeholder="Ex: PC-2026-0142 ou Contrato nº 88/2026" />
          </Field>
          <Field label="Empresa contratada">
            <Input value={formProjeto.empresaContratada} onChange={e => setFormProjeto(f => ({ ...f, empresaContratada: e.target.value }))} placeholder="Ex: Construtora Alfa Ltda" />
          </Field>
          <Field label="Grupo">
            <Input value={formProjeto.grupo} onChange={e => setFormProjeto(f => ({ ...f, grupo: e.target.value }))} placeholder="Ex: CAPEX, Manutenção, Unidade SP..." list="grupos-existentes" />
          </Field>
          <Field label="Gestor">
            <Select value={formProjeto.gestorId} onChange={e => setFormProjeto(f => ({ ...f, gestorId: e.target.value }))}>
              <option value="">Sem gestor</option>
              {gestoresDisponiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Select>
          </Field>
          <Field label="Início do contrato">
            <Input type="date" value={formProjeto.dataInicioContrato} onChange={e => setFormProjeto(f => ({ ...f, dataInicioContrato: e.target.value }))} />
          </Field>
          <Field label="Fim do contrato">
            <Input type="date" value={formProjeto.dataFimContrato} onChange={e => setFormProjeto(f => ({ ...f, dataFimContrato: e.target.value }))} />
          </Field>
        </form>
      </Modal>

      {/* Modal editar projeto */}
      <Modal open={!!modalEdit} onClose={() => setModalEdit(null)} titulo="Editar projeto" icon="ti-pencil"
        rodape={
          <>
            <Btn onClick={() => setModalEdit(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleSalvarEdicao} disabled={atualizarProjeto.isPending}>
              {atualizarProjeto.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Btn>
          </>
        }
      >
        <form onSubmit={handleSalvarEdicao}>
          <Field label="Foto do projeto">
            <FotoPicker preview={fotoEdit.preview} onSelecionar={file => onSelecionarFoto(file, 'edit')} />
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
            <Input value={editForm.grupo} onChange={e => setEditForm(f => ({ ...f, grupo: e.target.value }))} placeholder="Ex: CAPEX, Manutenção, Unidade SP..." list="grupos-existentes" />
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
          <Field label="Início do contrato">
            <Input type="date" value={editForm.dataInicioContrato} onChange={e => setEditForm(f => ({ ...f, dataInicioContrato: e.target.value }))} />
          </Field>
          <Field label="Fim do contrato">
            <Input type="date" value={editForm.dataFimContrato} onChange={e => setEditForm(f => ({ ...f, dataFimContrato: e.target.value }))} />
          </Field>
        </form>
      </Modal>

      <Modal open={!!modalDuplicar} onClose={() => setModalDuplicar(null)} titulo="Duplicar projeto" icon="ti-copy"
        rodape={
          <>
            <Btn onClick={() => setModalDuplicar(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={handleDuplicar} disabled={duplicarProjeto.isPending}>
              {duplicarProjeto.isPending ? 'Duplicando...' : 'Duplicar'}
            </Btn>
          </>
        }
      >
        <form onSubmit={handleDuplicar}>
          <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 12 }}>
            Cria uma cópia de <strong style={{ color: 'var(--tp)' }}>"{modalDuplicar?.nome}"</strong>. RDOs, ocorrências, comentários e mídias nunca são copiados.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', borderRadius: 'var(--r)',
              border: `.5px solid ${!comConteudo ? 'var(--ba)' : 'var(--bs)'}`, background: !comConteudo ? 'var(--bga)' : 'var(--s1)',
              cursor: 'pointer', transition: 'all .15s',
            }}>
              <input type="radio" name="modoDuplicar" checked={!comConteudo} onChange={() => setComConteudo(false)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: !comConteudo ? 'var(--ta)' : 'var(--tp)' }}>Apenas configurações</div>
                <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 2 }}>Nome, grupo, gestor, datas e assinaturas — sem a estrutura de etapas e atividades.</div>
              </div>
            </label>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 13px', borderRadius: 'var(--r)',
              border: `.5px solid ${comConteudo ? 'var(--ba)' : 'var(--bs)'}`, background: comConteudo ? 'var(--bga)' : 'var(--s1)',
              cursor: 'pointer', transition: 'all .15s',
            }}>
              <input type="radio" name="modoDuplicar" checked={comConteudo} onChange={() => setComConteudo(true)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: comConteudo ? 'var(--ta)' : 'var(--tp)' }}>Configurações e conteúdo</div>
                <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 2 }}>Também copia a estrutura de etapas e atividades (EAP), zerando o progresso.</div>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      <div className="content">
        {/* KPIs */}
        <div className="kgrid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          {isLoading ? Array(5).fill(0).map((_, i) => (
            <div key={i} className="kpi"><Skeleton h={60} /></div>
          )) : <>
            <KpiCard icon="ti-folder"        valor={ativos}      label="Projetos ativos"  cor="var(--ta)" />
            <KpiCard icon="ti-file-text"     valor={totalRdos}   label="RDOs emitidos" />
            <KpiCard icon="ti-chart-pie"     valor={`${pctMedio}%`}    label="Progresso médio"  cor="var(--ta)" />
            <KpiCard icon="ti-clock"         valor={`${desvioMedio >= 0 ? '+' : ''}${desvioMedio}%`} label="Desvio médio"     cor={desvioMedio >= 0 ? 'var(--tsu)' : 'var(--td)'} />
            <KpiCard icon="ti-alert-triangle" valor={ocorrenciasAbertas} label="Ocorrências abertas" cor={ocorrenciasAbertas > 0 ? 'var(--td)' : 'var(--tw)'} />
          </>}
        </div>

        {/* Filtros */}
        <div className="fr-row">
          <AutocompleteSearchInput placeholder="Buscar projeto..." value={busca} onChange={setBusca}
            opcoes={projetos.map(p => ({ id: p.id, label: p.nome, sublabel: p.grupo }))} />
          <select className="fsel" value={filtGrupo} onChange={e => setFiltGrupo(e.target.value)}>
            <option value="">Todos os grupos</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="fsel" value={filtSt} onChange={e => setFiltSt(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{ display: 'flex', border: '.5px solid var(--bs)', borderRadius: 'var(--r)', overflow: 'hidden', flexShrink: 0 }}>
            {(['table', 'cards'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={v === 'table' ? 'Ver em lista' : 'Ver em cartões'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
                  border: 'none', background: view === v ? 'var(--ta)' : 'transparent',
                  cursor: 'pointer', color: view === v ? 'var(--oa)' : 'var(--ts)',
                  fontSize: 11.5, fontWeight: view === v ? 600 : 400, fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                <i className={`ti ${v === 'table' ? 'ti-table' : 'ti-layout-grid'}`} style={{ fontSize: 14 }} />
                {v === 'table' ? 'Lista' : 'Cartões'}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        {isLoading ? (
          <div className="tw"><Skeleton h={200} /></div>
        ) : view === 'table' ? (
          <TabelaProjetos projetos={filtrados} onNovoRdo={handleNovoRdo} onEditar={abrirEdicao} onDuplicar={abrirDuplicar} onExcluir={handleExcluir} />
        ) : (
          <CardsProjetos projetos={filtrados} onNovoRdo={handleNovoRdo} onEditar={abrirEdicao} onDuplicar={abrirDuplicar} onExcluir={handleExcluir} />
        )}
      </div>
    </div>
  )
}

// ── Seletor de foto ─────────────────────────────────────────
function FotoPicker({ preview, onSelecionar }: { preview: string; onSelecionar: (file: File) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        background: 'var(--s1)', border: '.5px solid var(--bs)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {preview
          ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <i className="ti ti-photo" style={{ fontSize: 20, color: 'var(--tm)' }} />}
      </div>
      <span className="proj-ab">
        <i className="ti ti-upload" /> {preview ? 'Trocar foto' : 'Adicionar foto'}
      </span>
      <input type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onSelecionar(f) }} />
    </label>
  )
}

// ── Tabela ───────────────────────────────────────────────────
function TabelaProjetos({ projetos, onNovoRdo, onEditar, onDuplicar, onExcluir }: {
  projetos: Projeto[]; onNovoRdo: (id: string) => void; onEditar: (p: Projeto) => void
  onDuplicar: (p: Projeto) => void; onExcluir: (p: Projeto) => void
}) {
  const router = useRouter()
  return (
    <div className="tw">
      <table className="tbl">
        <thead>
          <tr>
            <th>Projeto</th>
            <th>Grupo</th>
            <th>Gestor</th>
            <th style={{ width: 110 }}>Plan. × Real</th>
            <th style={{ width: 70, textAlign: 'center' }}>Desvio</th>
            <th style={{ width: 100 }}>Status</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {projetos.map(p => (
            <tr key={p.id} onClick={() => router.push(`/projetos/${p.id}`)}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${p.cor}1a` }}>
                      <i className="ti ti-building-skyscraper" style={{ fontSize: 22, color: p.cor }} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{p.nome}</div>
                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 9, fontSize: 10.5, color: 'var(--tm)', marginTop: 2 }}>
                      <span title="RDOs emitidos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-file-text" /> {p._count.rdos}</span>
                      <span title="Atividades" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-list-check" /> {p.totalAtividades ?? 0}</span>
                      <span title="Ocorrências" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-alert-triangle" /> {p.totalOcorrencias ?? 0}</span>
                      <span title="Comentários" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-message" /> {p.totalComentarios ?? 0}</span>
                      <span title="Fotos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-photo" /> {p.totalFotos ?? 0}</span>
                      <span title="Vídeos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-video" /> {p.totalVideos ?? 0}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ fontSize: 11, color: 'var(--ts)' }}>{p.grupo ?? '—'}</td>
              <td style={{ fontSize: 11, color: 'var(--ts)' }}>{p.gestor?.nome ?? '—'}</td>
              <td><DualBar plan={p.pctPlanejado} real={p.pctReal} /></td>
              <td style={{ textAlign: 'center' }}><Desvio valor={p.desvio} /></td>
              <td><Badge variant={STATUS_V[p.status] ?? 'gray'}>{STATUS_L[p.status] ?? p.status}</Badge></td>
              <td style={{ textAlign: 'right' }}>
                <CardMenu
                  onEditar={() => onEditar(p)}
                  onNovoRdo={() => onNovoRdo(p.id)}
                  onRelatorio={() => router.push('/relatorios')}
                  onDuplicar={() => onDuplicar(p)}
                  onExcluir={() => onExcluir(p)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Cards ────────────────────────────────────────────────────
function CardsProjetos({ projetos, onNovoRdo, onEditar, onDuplicar, onExcluir }: {
  projetos: Projeto[]; onNovoRdo: (id: string) => void; onEditar: (p: Projeto) => void
  onDuplicar: (p: Projeto) => void; onExcluir: (p: Projeto) => void
}) {
  const router = useRouter()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(420px,100%),1fr))', gap: 10, marginBottom: 12 }}>
      {projetos.map(p => (
        <div
          key={p.id}
          style={{ background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 14, padding: 15, cursor: 'pointer', transition: 'border-color .15s' }}
          onClick={() => router.push(`/projetos/${p.id}`)}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: '0 0 42%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--s1)' }}>
              {p.fotoUrl ? (
                <img src={p.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${p.cor}1a` }}>
                  <i className="ti ti-building-skyscraper" style={{ fontSize: 32, color: p.cor }} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                <Badge variant={STATUS_V[p.status] ?? 'gray'}>{STATUS_L[p.status] ?? p.status}</Badge>
                <CardMenu
                  onEditar={() => onEditar(p)}
                  onNovoRdo={() => onNovoRdo(p.id)}
                  onRelatorio={() => router.push('/relatorios')}
                  onDuplicar={() => onDuplicar(p)}
                  onExcluir={() => onExcluir(p)}
                />
              </div>
              <DualBar plan={p.pctPlanejado} real={p.pctReal} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5 }}>
                <span style={{ color: 'var(--tm)' }}>Desvio:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: p.desvio >= 0 ? 'var(--tsu)' : 'var(--td)', fontWeight: 600 }}>
                  <i className={`ti ti-trending-${p.desvio >= 0 ? 'up' : 'down'}`} /> {p.desvio >= 0 ? '+' : ''}{p.desvio}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 10px', fontSize: 13, color: 'var(--tm)' }}>
                <span title="RDOs emitidos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-file-text" /> {p._count.rdos}</span>
                <span title="Atividades" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-list-check" /> {p.totalAtividades ?? 0}</span>
                <span title="Ocorrências" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-alert-triangle" /> {p.totalOcorrencias ?? 0}</span>
                <span title="Comentários" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-message" /> {p.totalComentarios ?? 0}</span>
                <span title="Fotos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-photo" /> {p.totalFotos ?? 0}</span>
                <span title="Vídeos" style={{ display: 'flex', alignItems: 'center', gap: 3 }}><i className="ti ti-video" /> {p.totalVideos ?? 0}</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '.5px solid var(--b)', marginTop: 12, paddingTop: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{p.nome}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ts)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.grupo ? `${p.grupo} · ` : ''}{p.gestor?.nome ?? 'Sem gestor'}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Menu de ações do cartão de projeto (3 pontinhos) ──────────
function CardMenu({ onEditar, onNovoRdo, onRelatorio, onDuplicar, onExcluir }: {
  onEditar: () => void; onNovoRdo: () => void; onRelatorio: () => void; onDuplicar: () => void; onExcluir: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (ref.current && !ref.current.contains(alvo) && btnRef.current && !btnRef.current.contains(alvo)) setAberto(false)
    }
    function onScrollOuFecha() { setAberto(false) }
    document.addEventListener('mousedown', onClickFora)
    window.addEventListener('scroll', onScrollOuFecha, true)
    window.addEventListener('resize', onScrollOuFecha)
    return () => {
      document.removeEventListener('mousedown', onClickFora)
      window.removeEventListener('scroll', onScrollOuFecha, true)
      window.removeEventListener('resize', onScrollOuFecha)
    }
  }, [aberto])

  function acao(fn: () => void) {
    return (e: React.MouseEvent) => { e.stopPropagation(); setAberto(false); fn() }
  }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!aberto && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setAberto(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Mais ações"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0,
          borderRadius: 7, border: '.5px solid var(--bs)', background: aberto ? 'var(--bga)' : 'var(--s1)',
          color: aberto ? 'var(--ta)' : 'var(--tp)', cursor: 'pointer', lineHeight: 1,
        }}
      >
        <i className="ti ti-dots-vertical" style={{ fontSize: 19, lineHeight: 1 }} />
      </button>
      {aberto && (
        <div ref={ref} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 200, minWidth: 150,
          background: 'var(--s1)', border: '.5px solid var(--b)', borderRadius: 'var(--r)',
          boxShadow: '0 8px 24px rgba(0,0,0,.35)', overflow: 'hidden',
        }}>
          <button className="cm-opt" onClick={acao(onEditar)}><i className="ti ti-pencil" /> Editar</button>
          <button className="cm-opt" onClick={acao(onNovoRdo)}><i className="ti ti-plus" /> Novo RDO</button>
          <button className="cm-opt" onClick={acao(onRelatorio)}><i className="ti ti-chart-bar" /> Relatório</button>
          <button className="cm-opt" onClick={acao(onDuplicar)}><i className="ti ti-copy" /> Duplicar</button>
          <div style={{ borderTop: '.5px solid var(--b)' }} />
          <button className="cm-opt cm-opt-danger" onClick={acao(onExcluir)}><i className="ti ti-trash" /> Excluir</button>
        </div>
      )}
    </>
  )
}
