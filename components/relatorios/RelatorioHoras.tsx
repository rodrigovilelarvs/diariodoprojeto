'use client'
// Relatório "Horas por dia (H/H)" dos projetos por homem-hora: para cada data trabalhada, o dia da
// semana, se é sábado, domingo ou feriado, as horas normais e extras e (quando as funções têm valor da
// hora) o custo. Por padrão só conta RDOs aprovados — a base da medição.

import { Fragment, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui'
import { useRelatorioHoras, type DiaHoras } from '@/hooks/useEmpresa'
import { fmtData } from '@/lib/format'
import { NOME_DIA_SEMANA } from '@/lib/feriados'
import type { Projeto } from '@/lib/types'

const TIPO_DIA: Record<DiaHoras['tipoDia'], { rotulo: string; cor: string; fundo: string }> = {
  UTIL:    { rotulo: 'Dia útil', cor: 'var(--tm)', fundo: 'transparent' },
  SABADO:  { rotulo: 'Sábado',   cor: 'var(--tw)', fundo: 'color-mix(in srgb, var(--tw) 9%, transparent)' },
  DOMINGO: { rotulo: 'Domingo',  cor: 'var(--td)', fundo: 'color-mix(in srgb, var(--td) 9%, transparent)' },
  FERIADO: { rotulo: 'Feriado (extra 100%)', cor: 'var(--tpu)', fundo: 'color-mix(in srgb, var(--tpu) 11%, transparent)' },
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function hojeISO() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
function inicioDoMes() { return hojeISO().slice(0, 8) + '01' }

// Planilha (CSV com ; e vírgula decimal, que o Excel brasileiro abre direto)
function baixarCsv(dias: DiaHoras[]) {
  const celula = (v: string | number | null) => {
    const t = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const linhas = [['Data', 'Dia', 'Tipo do dia', 'Projeto', 'Função', 'Qtd.', 'Tipo da hora', '% extra', 'Horas', 'Valor (R$)']]
  for (const d of dias) {
    for (const l of d.linhas) {
      linhas.push([
        fmtData(d.data), NOME_DIA_SEMANA[d.diaSemana], TIPO_DIA[d.tipoDia].rotulo,
        l.projeto, l.funcao, String(l.quantidade), l.tipoHora === 'EXTRA' ? 'Extra' : 'Normal',
        l.tipoHora === 'EXTRA' ? String(l.percentualExtra ?? 50) : '', String(l.horas), l.valor == null ? '' : String(l.valor),
      ])
    }
  }
  const csv = '\uFEFF' + linhas.map(l => l.map(celula).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'horas-por-dia.csv'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function RelatorioHoras({ projetos }: { projetos: Projeto[] }) {
  const projetosHH = useMemo(() => projetos.filter(p => p.modalidade === 'HOMEM_HORA').sort((a, b) => a.nome.localeCompare(b.nome)), [projetos])
  const [projetoId, setProjetoId] = useState('')
  const [dataInicio, setDataInicio] = useState(inicioDoMes)
  const [dataFim, setDataFim] = useState(hojeISO)
  const [status, setStatus] = useState<'APROVADO' | 'TODOS'>('APROVADO')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  const { data, isLoading } = useRelatorioHoras({ projetoId: projetoId || undefined, dataInicio, dataFim, status }, projetosHH.length > 0)

  if (projetosHH.length === 0) {
    return (
      <div className="sec" data-testid="horas-sem-projetos"><div className="sec-body" style={{ textAlign: 'center', padding: 32, color: 'var(--tm)', fontSize: 12 }}>
        <i className="ti ti-clock-hour-4" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
        Nenhum projeto por homem-hora. Para usar este relatório, edite um projeto e escolha a modalidade <strong>Por homem-hora</strong>.
      </div></div>
    )
  }

  const alternar = (d: string) => setAbertos(a => { const n = new Set(a); if (n.has(d)) n.delete(d); else n.add(d); return n })
  const t = data?.totais

  return (
    <div data-testid="relatorio-horas">
      <div className="fr-row">
        <select className="fsel" aria-label="Projeto" value={projetoId} onChange={e => setProjetoId(e.target.value)}>
          <option value="">Todos os projetos por homem-hora</option>
          {projetosHH.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <input type="date" className="fi" aria-label="Data inicial" style={{ width: 140 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        <span style={{ fontSize: 11, color: 'var(--tm)' }}>até</span>
        <input type="date" className="fi" aria-label="Data final" style={{ width: 140 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
        <select className="fsel" aria-label="Quais RDOs" value={status} onChange={e => setStatus(e.target.value as 'APROVADO' | 'TODOS')}>
          <option value="APROVADO">Só RDOs aprovados (medição)</option>
          <option value="TODOS">Todos os RDOs (inclui pendentes e rascunhos)</option>
        </select>
        <button className="btn btn-sm" disabled={!data || data.dias.length === 0} onClick={() => data && baixarCsv(data.dias)}>
          <i className="ti ti-file-spreadsheet" /> Exportar planilha
        </button>
      </div>

      {isLoading || !data || !t ? <Skeleton h={260} /> : (
        <>
          <div className="kgrid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            <MiniCard rotulo="Total de H/H" valor={fmt(t.total)} />
            <MiniCard rotulo="Normais" valor={fmt(t.normais)} />
            <MiniCard rotulo="Extras" valor={fmt(t.extras)} cor="var(--tw)" />
            <MiniCard rotulo="Sábados" valor={fmt(t.sabados)} cor="var(--tw)" />
            <MiniCard rotulo="Domingos" valor={fmt(t.domingos)} cor="var(--td)" />
            <MiniCard rotulo="Feriados" valor={fmt(t.feriados)} cor="var(--tpu)" />
            {t.valor != null && <MiniCard rotulo="Custo" valor={brl(t.valor)} />}
          </div>

          {data.funcoesSemValor.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--tw)', margin: '8px 0', display: 'flex', gap: 6 }}>
              <i className="ti ti-alert-triangle" />
              <span>
                Funções sem valor da hora cadastrado ficaram fora do custo: <strong>{data.funcoesSemValor.join(', ')}</strong>.
                Informe o valor em um RDO: Adicionar mão de obra, editar a função (R$/h).
              </span>
            </div>
          )}

          <div className="tw" style={{ marginTop: 8 }}>
            <table className="tbl" data-testid="tabela-horas">
              <thead>
                <tr>
                  <th>Data</th><th>Dia</th><th>Tipo do dia</th>
                  <th style={{ textAlign: 'right' }}>Pessoas</th><th style={{ textAlign: 'right' }}>Normais</th>
                  <th style={{ textAlign: 'right' }}>Extras</th><th style={{ textAlign: 'right' }}>Total H/H</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.dias.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                    Nenhuma hora registrada no período{status === 'APROVADO' ? ' em RDOs aprovados' : ''}.
                  </td></tr>
                ) : data.dias.map(d => {
                  const c = TIPO_DIA[d.tipoDia]
                  const aberto = abertos.has(d.data)
                  return (
                    <Fragment key={d.data}>
                      <tr data-tipo-dia={d.tipoDia} onClick={() => alternar(d.data)} style={{ cursor: 'pointer', background: c.fundo }}>
                        <td style={{ fontWeight: 600 }}>
                          <i className={`ti ${aberto ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ marginRight: 4, color: 'var(--tm)' }} />
                          {fmtData(d.data)}
                        </td>
                        <td>{NOME_DIA_SEMANA[d.diaSemana]}</td>
                        <td>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: c.cor }}>{c.rotulo}</span>
                          {(d.tipoDia === 'SABADO' || d.tipoDia === 'DOMINGO') && d.normais > 0 && (
                            <span data-testid="alerta-normal-fim-semana" title="Há horas normais neste dia de fim de semana: confira se não deveriam ser horas extras." style={{ marginLeft: 6, color: 'var(--tw)' }}>
                              <i className="ti ti-alert-triangle" />
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>{d.pessoas}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(d.normais)}</td>
                        <td style={{ textAlign: 'right', color: d.extras > 0 ? 'var(--tw)' : undefined, fontWeight: d.extras > 0 ? 600 : 400 }}>{fmt(d.extras)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(d.total)}</td>
                        <td style={{ textAlign: 'right' }}>{d.valor != null ? brl(d.valor) : '—'}</td>
                      </tr>
                      {aberto && d.linhas.map((l, i) => (
                        <tr key={d.data + i} style={{ background: c.fundo }}>
                          <td />
                          <td colSpan={2} style={{ fontSize: 11, color: 'var(--ts)', paddingLeft: 24 }}>
                            {l.funcao}{projetos.length > 1 && !projetoId ? <span style={{ color: 'var(--tm)' }}> · {l.projeto}</span> : null}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--ts)' }}>{l.quantidade}</td>
                          <td colSpan={2} style={{ textAlign: 'right', fontSize: 11, color: l.tipoHora === 'EXTRA' ? 'var(--tw)' : 'var(--ts)' }}>
                            {l.tipoHora === 'EXTRA' ? `Extra ${l.percentualExtra ?? 50}%` : 'Normal'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 11 }}>{fmt(l.horas)}</td>
                          <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--ts)' }}>{l.valor != null ? brl(l.valor) : '—'}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
              {data.dias.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={3}>Total do período · {t.dias} dia{t.dias !== 1 ? 's' : ''}</td>
                    <td />
                    <td style={{ textAlign: 'right' }}>{fmt(t.normais)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(t.extras)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(t.total)}</td>
                    <td style={{ textAlign: 'right' }}>{t.valor != null ? brl(t.valor) : '—'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 6 }}>
            Clique numa data para ver as funções do dia. Sábados, domingos e feriados aparecem destacados. Não há cadastro de feriados: um dia de semana com hora extra de 100% marcada no H/H é tratado como feriado.
          </div>
        </>
      )}
    </div>
  )
}

function MiniCard({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="kpi">
      <div className="kv" style={{ fontSize: 20, color: cor }}>{valor}</div>
      <div className="kl">{rotulo}</div>
    </div>
  )
}
