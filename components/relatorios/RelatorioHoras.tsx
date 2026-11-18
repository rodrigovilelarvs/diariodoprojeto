'use client'
// Relatório "Horas por dia (H/H)" dos projetos por homem-hora: para cada data trabalhada, o dia da
// semana, se é sábado, domingo ou feriado, as horas normais e extras e (quando as funções têm valor da
// hora) o custo. Por padrão só conta RDOs aprovados — a base da medição.

import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '@/components/ui'
import { useRelatorioHoras, type DiaHoras } from '@/hooks/useEmpresa'
import { fmtData } from '@/lib/format'
import { NOME_DIA_SEMANA } from '@/lib/feriados'
import { ADICIONAL_NOTURNO_PERCENTUAL } from '@/lib/homem-hora'
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
  const linhas = [['Data', 'Dia', 'Tipo do dia', 'Projeto', 'Função', 'Qtd.', 'Entrada', 'Saída', 'Tipo da hora', '% extra', 'Horas', `Horas noturnas (adicional ${ADICIONAL_NOTURNO_PERCENTUAL}%)`, 'Valor (R$)']]
  for (const d of dias) {
    for (const l of d.linhas) {
      linhas.push([
        fmtData(d.data), NOME_DIA_SEMANA[d.diaSemana], TIPO_DIA[d.tipoDia].rotulo,
        l.projeto, l.funcao, String(l.quantidade), l.horaEntrada, l.horaSaida, l.tipoHora === 'EXTRA' ? 'Extra' : 'Normal',
        l.tipoHora === 'EXTRA' ? String(l.percentualExtra ?? 50) : '', String(l.horas), String(l.noturnas), l.valor == null ? '' : String(l.valor),
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
  const todosAbertos = !!data && data.dias.length > 0 && data.dias.every(d => abertos.has(d.data))
  const alternarTodos = () => setAbertos(todosAbertos ? new Set() : new Set((data?.dias ?? []).map(d => d.data)))
  const pctExtras = t && t.total > 0 ? Math.round((t.extras / t.total) * 1000) / 10 : 0
  // zero vira "—": a tabela fica mais limpa e os números que existem se destacam
  const num = (n: number) => (n > 0 ? fmt(n) : '—')
  // a coluna Valor só existe quando alguma função tem valor da hora cadastrado
  const temValor = !!t && t.valor != null
  const colunas = temValor ? 7 : 6
  // detalhe do dia: colunas próprias e alinhadas (pessoa, função, horário, tipo, qtd., horas, noturnas, valor)
  const gradeDetalhe = `minmax(130px, 1.3fr) minmax(90px, 1fr) 108px 96px 44px 66px 72px${temValor ? ' 98px' : ''}`
  const celulaDir: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const cabecalho: CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--s1)' }

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
          {/* cartões em faixas: horas | dias especiais | custo */}
          <div data-testid="resumo-horas" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 4 }}>
            <GrupoCartoes titulo="Horas" colunas={4}>
              <MiniCard rotulo="Total de H/H" valor={fmt(t.total)} sub={`${t.dias} dia${t.dias !== 1 ? 's' : ''} com horas`} />
              <MiniCard rotulo="Normais" valor={fmt(t.normais)} />
              <MiniCard rotulo="Extras" valor={fmt(t.extras)} cor="var(--tw)" sub={`${fmt(pctExtras)}% do total`} />
              <MiniCard rotulo={`Noturno (${ADICIONAL_NOTURNO_PERCENTUAL}%)`} valor={fmt(t.noturnas)} cor="var(--tpu)" sub="já dentro do total" />
            </GrupoCartoes>
            <GrupoCartoes titulo="Dias especiais" colunas={3}>
              <MiniCard rotulo="Sábados" valor={fmt(t.sabados)} cor="var(--tw)" />
              <MiniCard rotulo="Domingos" valor={fmt(t.domingos)} cor="var(--td)" />
              <MiniCard rotulo="Feriados" valor={fmt(t.feriados)} cor="var(--tpu)" />
            </GrupoCartoes>
            {t.valor != null && (
              <GrupoCartoes titulo="Custo" colunas={1}>
                <MiniCard rotulo="Custo do período" valor={brl(t.valor)} destaque />
              </GrupoCartoes>
            )}
          </div>

          {data.funcoesSemValor.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--tw)', margin: '10px 0 0', display: 'flex', gap: 6 }}>
              <i className="ti ti-alert-triangle" />
              <span>
                Funções sem valor da hora cadastrado ficaram fora do custo: <strong>{data.funcoesSemValor.join(', ')}</strong>.
                Informe o valor em um RDO: Adicionar mão de obra, editar a função (R$/h).
              </span>
            </div>
          )}

          {data.dias.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, maxWidth: 1120 }}>
              <button className="btn btn-sm" data-testid="alternar-todos" onClick={alternarTodos}>
                <i className={`ti ${todosAbertos ? 'ti-chevrons-up' : 'ti-chevrons-down'}`} /> {todosAbertos ? 'Recolher tudo' : 'Expandir tudo'}
              </button>
            </div>
          )}

          {/* o quadro rola por dentro: cabeçalho e total ficam fixos quando o período é longo */}
          <div className="tw" style={{ marginTop: 6, maxWidth: 1120, maxHeight: '68vh', overflow: 'auto' }}>
            <table className="tbl" data-testid="tabela-horas" style={{ tableLayout: 'fixed', width: '100%', minWidth: 640 }}>
              <colgroup>
                <col />
                <col style={{ width: 76 }} /><col style={{ width: 86 }} /><col style={{ width: 86 }} /><col style={{ width: 96 }} /><col style={{ width: 90 }} />
                {temValor && <col style={{ width: 118 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th style={cabecalho}>Data</th>
                  <th style={{ ...cabecalho, ...celulaDir }} title="Pessoas diferentes no dia: quem tem hora normal e hora extra conta uma vez só.">Pessoas</th>
                  <th style={{ ...cabecalho, ...celulaDir }}>Normais</th>
                  <th style={{ ...cabecalho, ...celulaDir }}>Extras</th>
                  <th style={{ ...cabecalho, ...celulaDir }} title="Horas entre 22h e 05h (já contam no total)"><i className="ti ti-moon" style={{ marginRight: 3 }} />Noturnas</th>
                  <th style={{ ...cabecalho, ...celulaDir }}>Total H/H</th>
                  {temValor && <th style={{ ...cabecalho, ...celulaDir }}>Valor</th>}
                </tr>
              </thead>
              <tbody>
                {data.dias.length === 0 ? (
                  <tr><td colSpan={colunas} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                    Nenhuma hora registrada no período{status === 'APROVADO' ? ' em RDOs aprovados' : ''}.
                  </td></tr>
                ) : data.dias.map(d => {
                  const c = TIPO_DIA[d.tipoDia]
                  const aberto = abertos.has(d.data)
                  return (
                    <Fragment key={d.data}>
                      <tr data-tipo-dia={d.tipoDia} onClick={() => alternar(d.data)} style={{ cursor: 'pointer', background: c.fundo }}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <i className={`ti ${aberto ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ marginRight: 4, color: 'var(--tm)' }} />
                          <span style={{ display: 'inline-block', width: 34, color: 'var(--tm)', fontSize: 11 }}>{NOME_DIA_SEMANA[d.diaSemana].slice(0, 3).toLowerCase()}</span>
                          <span style={{ fontWeight: 600 }}>{fmtData(d.data)}</span>
                          {d.tipoDia !== 'UTIL' && (
                            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: c.cor }}>{c.rotulo}</span>
                          )}
                          {(d.tipoDia === 'SABADO' || d.tipoDia === 'DOMINGO') && d.normais > 0 && (
                            <span data-testid="alerta-normal-fim-semana" title="Há horas normais neste dia de fim de semana: confira se não deveriam ser horas extras." style={{ marginLeft: 6, color: 'var(--tw)' }}>
                              <i className="ti ti-alert-triangle" />
                            </span>
                          )}
                        </td>
                        <td style={celulaDir}>{d.pessoas}</td>
                        <td style={{ ...celulaDir, color: d.normais > 0 ? undefined : 'var(--tm)' }}>{num(d.normais)}</td>
                        <td style={{ ...celulaDir, color: d.extras > 0 ? 'var(--tw)' : 'var(--tm)', fontWeight: d.extras > 0 ? 600 : 400 }}>{num(d.extras)}</td>
                        <td data-testid="noturnas-dia" style={{ ...celulaDir, color: d.noturnas > 0 ? 'var(--tpu)' : 'var(--tm)', fontWeight: d.noturnas > 0 ? 600 : 400 }}>{num(d.noturnas)}</td>
                        <td style={{ ...celulaDir, fontWeight: 700 }}>{fmt(d.total)}</td>
                        {temValor && <td style={celulaDir}>{d.valor != null ? brl(d.valor) : '—'}</td>}
                      </tr>
                      {aberto && (
                        <tr style={{ background: c.fundo }}>
                          <td colSpan={colunas} style={{ padding: '2px 10px 10px 30px' }}>
                            <div role="table" style={{ display: 'grid', gridTemplateColumns: gradeDetalhe, columnGap: 10, rowGap: 4, fontSize: 11, alignItems: 'center' }}>
                              {['Pessoa', 'Função', 'Horário', 'Tipo da hora', 'Qtd.', 'Horas', 'Noturnas', ...(temValor ? ['Valor'] : [])].map((h, i) => (
                                <div key={h} style={{ fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.04em', paddingBottom: 3, borderBottom: '.5px solid var(--b)', ...(i >= 4 ? celulaDir : {}) }}>{h}</div>
                              ))}
                              {d.linhas.map((l, i) => {
                                const extra = l.tipoHora === 'EXTRA'
                                const { pessoa, funcao } = partesDoNome(l.funcao)
                                return (
                                  <Fragment key={d.data + i}>
                                    <div style={{ fontWeight: 600, color: 'var(--tp)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.funcao}>
                                      {pessoa}{projetos.length > 1 && !projetoId ? <span style={{ fontWeight: 400, color: 'var(--tm)' }}> · {l.projeto}</span> : null}
                                    </div>
                                    <div style={{ color: 'var(--ts)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{funcao || '—'}</div>
                                    <div style={{ color: 'var(--ts)', fontVariantNumeric: 'tabular-nums' }}>{l.horaEntrada}–{l.horaSaida}</div>
                                    <div>
                                      {extra ? (
                                        <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, color: 'var(--tw)', background: 'color-mix(in srgb, var(--tw) 14%, transparent)' }}>
                                          Extra {l.percentualExtra ?? 50}%
                                        </span>
                                      ) : <span style={{ color: 'var(--tm)' }}>Normal</span>}
                                    </div>
                                    <div style={{ ...celulaDir, color: 'var(--ts)' }}>{l.quantidade}</div>
                                    <div style={{ ...celulaDir, fontWeight: 600 }}>{fmt(l.horas)}</div>
                                    <div style={{ ...celulaDir, color: l.noturnas > 0 ? 'var(--tpu)' : 'var(--tm)' }}>{l.noturnas > 0 ? fmt(l.noturnas) : '—'}</div>
                                    {temValor && <div style={{ ...celulaDir, color: 'var(--ts)' }}>{l.valor != null ? brl(l.valor) : '—'}</div>}
                                  </Fragment>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {data.dias.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ position: 'sticky', bottom: 0, background: 'var(--s1)' }}>Total do período · {t.dias} dia{t.dias !== 1 ? 's' : ''}</td>
                    <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }} />
                    <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }}>{fmt(t.normais)}</td>
                    <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }}>{fmt(t.extras)}</td>
                    <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }}>{fmt(t.noturnas)}</td>
                    <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }}>{fmt(t.total)}</td>
                    {temValor && <td style={{ ...celulaDir, position: 'sticky', bottom: 0, background: 'var(--s1)' }}>{t.valor != null ? brl(t.valor) : '—'}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 6, maxWidth: 1120 }}>
            Clique numa data para ver as funções do dia. Pessoas: quem tem hora normal e hora extra no mesmo dia conta uma só vez. As horas noturnas (22h às 05h, adicional de {ADICIONAL_NOTURNO_PERCENTUAL}%) já estão dentro do total. Sábados, domingos e feriados aparecem destacados. Não há cadastro de feriados: um dia de semana com hora extra de 100% marcada no H/H é tratado como feriado.
          </div>
        </>
      )}
    </div>
  )
}

// "PESSOA - FUNÇÃO" → { pessoa, funcao }; nomes sem o hífen ficam inteiros como "pessoa"
function partesDoNome(nome: string): { pessoa: string; funcao: string } {
  const i = nome.indexOf(' - ')
  return i < 0 ? { pessoa: nome, funcao: '' } : { pessoa: nome.slice(0, i), funcao: nome.slice(i + 3) }
}

// Faixa de cartões com título (Horas, Dias especiais, Custo)
function GrupoCartoes({ titulo, colunas, children }: { titulo: string; colunas: number; children: ReactNode }) {
  return (
    <div style={{ flex: colunas > 1 ? `${colunas} 1 ${colunas * 120}px` : '1 1 170px', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{titulo}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gap: 8 }}>{children}</div>
    </div>
  )
}

function MiniCard({ rotulo, valor, cor, sub, destaque }: { rotulo: string; valor: string; cor?: string; sub?: string; destaque?: boolean }) {
  return (
    <div className="kpi" style={destaque ? { borderColor: 'var(--tsu)' } : undefined}>
      <div className="kv" style={{ fontSize: 20, color: cor ?? (destaque ? 'var(--tsu)' : undefined) }}>{valor}</div>
      <div className="kl">{rotulo}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
