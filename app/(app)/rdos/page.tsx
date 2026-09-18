'use client'
// src/app/rdos/page.tsx — Lista de RDOs

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRdos } from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import { Topbar }  from '@/components/layout/Topbar'
import { KpiCard, RdoStatusBadge, ClimaEmoji, Skeleton, AutocompleteSearchInput } from '@/components/ui'
import { toast }   from 'sonner'
import { gerarPdfRdo } from '@/lib/pdf'
import { api } from '@/lib/api'
import { numeroRdo, fmtData } from '@/lib/format'
import type { Rdo } from '@/lib/types'

export default function RdosPage() {
  return (
    <Suspense fallback={<div className="main"><div className="content"><Skeleton h={300} /></div></div>}>
      <RdosContent />
    </Suspense>
  )
}

// projetoIdFixo: quando informado, trava o filtro nesse projeto e omite o Topbar —
// usado para embutir a lista dentro do modal "RDOs do projeto" no resumo do projeto.
export function RdosContent({ projetoIdFixo }: { projetoIdFixo?: string } = {}) {
  const router  = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAppAuth()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '')
  const [projetoId] = useState(() => projetoIdFixo ?? searchParams.get('projetoId') ?? '')
  const [pagina, setPagina] = useState(1)
  const [sortBy, setSortBy]   = useState<'numero' | 'projeto' | 'data' | 'gestor' | 'status'>('numero')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function ordenarPor(campo: typeof sortBy) {
    if (sortBy === campo) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(campo)
      setSortDir('asc')
    }
    setPagina(1)
  }

  // Ao navegar pelo menu entre "Lista de RDOs" e "Aprovação" (mesma página,
  // só a query muda), o componente não remonta — sem isso o filtro ficava
  // travado no status da navegação anterior até clicar em outro lugar.
  useEffect(() => {
    setStatus(searchParams.get('status') ?? '')
  }, [searchParams])

  const { data, isLoading } = useRdos({ status: status || undefined, projetoId: projetoId || undefined, pagina, sortBy, sortDir })
  const nomeProjetoFiltrado = data?.rdos.find(r => r.projeto.id === projetoId)?.projeto.nome

  const rdos    = data?.rdos ?? []
  const total   = data?.total ?? 0
  const aprovados = rdos.filter(r => r.status === 'APROVADO').length
  const pendentes = rdos.filter(r => r.status === 'PENDENTE_APROVACAO').length
  const rascunhos = rdos.filter(r => r.status === 'RASCUNHO').length

  const filtrados = rdos.filter(r =>
    !busca || r.projeto.nome.toLowerCase().includes(busca.toLowerCase()) ||
    r.emissor.nome.toLowerCase().includes(busca.toLowerCase()),
  )

  async function handleNovoRdo() {
    // Sem projeto selecionado abre página de criação
    router.push('/rdos/novo')
  }

  const [exportandoId, setExportandoId] = useState<string | null>(null)

  async function handleExportarPdf(id: string) {
    setExportandoId(id)
    try {
      const rdoCompleto = await api.get<Rdo>(`/api/app/rdos/${id}`)
      await gerarPdfRdo(rdoCompleto, session?.tenantNome)
      toast.success('PDF gerado!')
    } catch {
      toast.error('Erro ao gerar PDF.')
    } finally {
      setExportandoId(null)
    }
  }

  const conteudo = (
    <>
        <div className="kgrid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <KpiCard icon="ti-file-text"  valor={total}     label="Total de RDOs" />
          <KpiCard icon="ti-check"      valor={aprovados} label="Aprovados"    cor="var(--tsu)" />
          <KpiCard icon="ti-clock"      valor={pendentes} label="Pendentes"    cor="var(--tw)" />
          <KpiCard icon="ti-pencil"     valor={rascunhos} label="Rascunhos"    cor="var(--tm)" />
        </div>

        <div className="fr-row">
          <AutocompleteSearchInput placeholder="Buscar por projeto, data, responsável..." value={busca} onChange={setBusca}
            opcoes={Array.from(new Map(rdos.map(r => [r.projeto.id, r.projeto.nome])).entries()).map(([id, nome]) => ({ id, label: nome }))} />
          <select className="fsel" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="APROVADO">Aprovado</option>
            <option value="PENDENTE_APROVACAO">Pendente</option>
            <option value="RASCUNHO">Rascunho</option>
          </select>
          <button className="btn btn-p btn-sm" onClick={() => router.push('/rdos/novo')}>
            <i className="ti ti-plus" /> Novo RDO
          </button>
        </div>

        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <ThOrdenavel campo="numero"  label="#"                sortBy={sortBy} sortDir={sortDir} onClick={ordenarPor} />
                <ThOrdenavel campo="projeto" label="Projeto"          sortBy={sortBy} sortDir={sortDir} onClick={ordenarPor} />
                <ThOrdenavel campo="data"    label="Data"             sortBy={sortBy} sortDir={sortDir} onClick={ordenarPor} />
                <ThOrdenavel campo="gestor"  label="Gestor do Projeto" sortBy={sortBy} sortDir={sortDir} onClick={ordenarPor} />
                <ThOrdenavel campo="status"  label="Status"           sortBy={sortBy} sortDir={sortDir} onClick={ordenarPor} />
                <th>Clima</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><Skeleton h={200} /></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--tm)' }}>Nenhum RDO encontrado.</td></tr>
              ) : filtrados.map(r => (
                <tr key={r.id} onClick={() => router.push(
                  r.status === 'APROVADO' || r.status === 'PENDENTE_APROVACAO'
                    ? `/aprovacao/${r.id}`
                    : `/rdos/${r.id}`,
                )}>
                  <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--ta)' }}>#{numeroRdo(r.numero)}</td>
                  <td style={{ fontSize: 12, fontWeight: 500 }}>{r.projeto.nome}</td>
                  <td style={{ fontSize: 11, color: 'var(--ts)' }}>
                    {fmtData(r.data)}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--ts)' }}>{r.emissor.nome}</td>
                  <td><RdoStatusBadge status={r.status} assinaturas={r.assinaturas} /></td>
                  <td><ClimaEmoji condicao={(r as any).climaManha} /></td>
                  <td>
                    <div className="proj-ac" style={{ justifyContent: 'flex-end' }}>
                      <button className="proj-ab" onClick={e => { e.stopPropagation(); router.push(`/rdos/${r.id}`) }} title="Abrir">
                        <i className="ti ti-eye" /> Abrir
                      </button>
                      <button className="proj-ab" disabled={exportandoId === r.id} onClick={e => { e.stopPropagation(); handleExportarPdf(r.id) }} title="Exportar PDF">
                        <i className={`ti ${exportandoId === r.id ? 'ti-loader' : 'ti-file-export'}`} /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > 20 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
              <i className="ti ti-chevron-left" />
            </button>
            <span style={{ fontSize: 11, color: 'var(--ts)', padding: '3px 8px' }}>
              {pagina} / {Math.ceil(total / 20)}
            </span>
            <button className="btn btn-sm" disabled={pagina >= Math.ceil(total / 20)} onClick={() => setPagina(p => p + 1)}>
              <i className="ti ti-chevron-right" />
            </button>
          </div>
        )}
    </>
  )

  if (projetoIdFixo) {
    return <div className="content" style={{ paddingTop: 0 }}>{conteudo}</div>
  }

  return (
    <div className="main">
      <Topbar
        titulo="Lista de RDOs"
        subtitulo={projetoId ? `Filtrado por: ${nomeProjetoFiltrado ?? 'projeto selecionado'}` : 'Todos os registros diários de obra'}
        acoes={
          <>
            {projetoId && (
              <button className="btn btn-sm" onClick={() => router.push('/rdos')}>
                <i className="ti ti-x" /> Limpar filtro de projeto
              </button>
            )}
            <button className="btn btn-p btn-sm" onClick={handleNovoRdo}>
              <i className="ti ti-plus" /> Novo RDO
            </button>
          </>
        }
      />
      <div className="content">{conteudo}</div>
    </div>
  )
}

type CampoOrdenacao = 'numero' | 'projeto' | 'data' | 'gestor' | 'status'

function ThOrdenavel({ campo, label, sortBy, sortDir, onClick }: {
  campo: CampoOrdenacao
  label: string
  sortBy: CampoOrdenacao
  sortDir: 'asc' | 'desc'
  onClick: (campo: CampoOrdenacao) => void
}) {
  const ativo = sortBy === campo
  return (
    <th
      onClick={() => onClick(campo)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title="Clique para ordenar"
    >
      {label}
      <i
        className={`ti ${ativo ? (sortDir === 'asc' ? 'ti-chevron-up' : 'ti-chevron-down') : 'ti-selector'}`}
        style={{ marginLeft: 4, fontSize: 11, opacity: ativo ? 1 : 0.4, verticalAlign: 'middle' }}
      />
    </th>
  )
}
