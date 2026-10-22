'use client'
// "Novo RDO" como janela (modal) sobre a tela em que a pessoa está — menu, painel, lista de
// RDOs, pasta do projeto ou o próprio RDO. Quem estiver dentro da pasta de um projeto abre
// já com ele selecionado. Cancelar só fecha a janela: a pessoa continua onde estava.
//
// Uso: const { abrirNovoRdo } = useNovoRdo(); abrirNovoRdo({ projetoId })
// O provider fica no layout do app (app/(app)/layout.tsx).

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjetos, useCriarRdo, useRdos } from '@/hooks/useEmpresa'
import { Modal, RdoStatusBadge } from '@/components/ui'
import { numeroRdo, fmtData } from '@/lib/format'
import { toast } from 'sonner'
import { mensagemErro } from '@/lib/api'

type Abertura = { projetoId?: string }
type Ctx = { abrirNovoRdo: (opcoes?: Abertura) => void }

const NovoRdoContext = createContext<Ctx>({ abrirNovoRdo: () => {} })
export const useNovoRdo = () => useContext(NovoRdoContext)

export function NovoRdoProvider({ children }: { children: React.ReactNode }) {
  // `chave` muda a cada abertura: o formulário nasce do zero (data de hoje, projeto escolhido)
  const [aberto, setAberto] = useState<{ chave: number; projetoId: string } | null>(null)

  const abrirNovoRdo = useCallback((opcoes?: Abertura) => {
    setAberto(a => ({ chave: (a?.chave ?? 0) + 1, projetoId: opcoes?.projetoId ?? '' }))
  }, [])
  const valor = useMemo(() => ({ abrirNovoRdo }), [abrirNovoRdo])

  return (
    <NovoRdoContext.Provider value={valor}>
      {children}
      {aberto && <NovoRdoForm key={aberto.chave} projetoInicial={aberto.projetoId} onClose={() => setAberto(null)} />}
    </NovoRdoContext.Provider>
  )
}

const FORM_ID = 'form-novo-rdo'

function NovoRdoForm({ projetoInicial, onClose }: { projetoInicial: string; onClose: () => void }) {
  const router = useRouter()
  const { data: projetos = [] } = useProjetos()
  const criarRdo = useCriarRdo()
  // Vindo de dentro de um projeto já chega pré-selecionado — mas o <select> continua livre pra trocar.
  const [projetoId, setProjetoId] = useState(projetoInicial)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [copiar, setCopiar] = useState(true)

  // Avisa se já existe RDO deste projeto nesta data — não bloqueia,
  // só evita duplicidade sem querer (a mesma obra pode ter mais de um
  // registro no mesmo dia em casos legítimos).
  const { data: rdosNoDia } = useRdos(
    { projetoId, data },
    { enabled: !!projetoId && !!data },
  )
  const conflitos = rdosNoDia?.rdos ?? []

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!projetoId) { toast.error('Selecione um projeto.'); return }
    try {
      const rdo = await criarRdo.mutateAsync({ projetoId, data, copiarAnterior: copiar })
      toast.success(`RDO #${numeroRdo(rdo.numero)} criado!`)
      onClose()
      router.push(`/rdos/${rdo.id}`)
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao criar RDO.'))
    }
  }

  return (
    <Modal
      open onClose={onClose} titulo="Novo RDO" icon="ti-file-plus" width={460}
      rodape={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" form={FORM_ID} className="btn btn-p" disabled={criarRdo.isPending}>
            <i className="ti ti-plus" /> {criarRdo.isPending ? 'Criando...' : 'Criar RDO'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleCriar}>
        <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 12 }}>Registro Diário de Obra</div>
        <div className="fr"><label className="fl" htmlFor="novo-rdo-projeto">Projeto *</label>
          <select key={projetos.length} id="novo-rdo-projeto" className="fi" value={projetoId} onChange={e => setProjetoId(e.target.value)} required>
            <option value="">Selecione o projeto...</option>
            {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="fr"><label className="fl" htmlFor="novo-rdo-data">Data *</label>
          <input id="novo-rdo-data" className="fi" type="date" value={data} onChange={e => setData(e.target.value)} required />
        </div>
        {conflitos.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            marginBottom: 14, padding: '10px 12px',
            background: 'color-mix(in srgb, var(--tw) 12%, transparent)',
            border: '.5px solid var(--tw)', borderRadius: 'var(--r)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--tw)' }}>
              <i className="ti ti-alert-triangle" />
              Já existe RDO neste projeto nesta data
            </div>
            {conflitos.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ts)' }}>
                <span>#{numeroRdo(r.numero)} · {fmtData(r.data)}</span>
                <RdoStatusBadge status={r.status} assinaturas={r.assinaturas} />
              </div>
            ))}
            <span style={{ fontSize: 11, color: 'var(--ts)' }}>
              Você ainda pode criar um novo — só confira se não é duplicidade.
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bga)', borderRadius: 'var(--r)', border: '.5px solid var(--ba)' }}>
          <input type="checkbox" id="copiar" checked={copiar} onChange={e => setCopiar(e.target.checked)} />
          <label htmlFor="copiar" style={{ fontSize: 12, color: 'var(--ta)', cursor: 'pointer' }}>
            Copiar dados do RDO anterior (horários, MO, equipamentos)
          </label>
        </div>
      </form>
    </Modal>
  )
}
