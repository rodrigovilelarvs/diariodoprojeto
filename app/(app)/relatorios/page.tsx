'use client'
// src/app/relatorios/page.tsx

import { useMemo, useState } from 'react'
import { useRelatorio, useProjetos } from '@/hooks/useEmpresa'
import { Topbar } from '@/components/layout/Topbar'
import { Skeleton, Desvio } from '@/components/ui'
import { toast } from 'sonner'

const OC_L: Record<string, string> = {
  ATRASO_MATERIAL: 'Atraso de material', PROBLEMA_TECNICO: 'Problema técnico',
  CONDICAO_CLIMATICA: 'Condição climática', FALTA_MAO_DE_OBRA: 'Falta de MO',
  ACIDENTE_INCIDENTE: 'Acidente', PARALISACAO: 'Paralisação', OUTRO: 'Outro',
}
const CATEGORIA_L: Record<string, string> = {
  DIRETA: 'Mão de obra direta', INDIRETA: 'Mão de obra indireta', TERCEIRIZADO: 'Terceirizada',
}
const CATEGORIA_COR: Record<string, string> = {
  DIRETA: 'var(--ta)', INDIRETA: 'var(--tpu)', TERCEIRIZADO: 'var(--tsu)',
}
const STATUS_L: Record<string, string> = {
  RASCUNHO: 'Rascunho', PENDENTE_APROVACAO: 'Pendente aprovação', APROVADO: 'Aprovado', REJEITADO: 'Revisar',
}
const STATUS_COR: Record<string, string> = {
  RASCUNHO: 'var(--ts)', PENDENTE_APROVACAO: 'var(--tw)', APROVADO: 'var(--tsu)', REJEITADO: 'var(--td)',
}
// ── Gráfico de rosca — status dos RDOs ──────────────────────
// SVG puro (sem lib de gráficos): cada status é um arco desenhado via
// stroke-dasharray/-dashoffset sobre um único <circle>, com um pequeno "gap"
// no fim de cada arco (separador na cor do fundo, como as demais barras
// empilhadas do app) e o total centralizado por cima.
function DonutStatusRdos({ dados, total }: { dados: Array<{ status: string; total: number }>; total: number }) {
  const R = 40, STROKE = 15, GAP = 3
  const C = 2 * Math.PI * R
  let acumulado = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" width={128} height={128} style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}>
          <circle cx={50} cy={50} r={R} fill="none" stroke="var(--s1)" strokeWidth={STROKE} />
          {total > 0 && dados.filter(d => d.total > 0).map(d => {
            const rawLen = (d.total / total) * C
            const visivel = Math.max(0, rawLen - GAP)
            const dashoffset = -acumulado
            acumulado += rawLen
            return (
              <circle key={d.status} cx={50} cy={50} r={R} fill="none"
                stroke={STATUS_COR[d.status]} strokeWidth={STROKE}
                strokeDasharray={`${visivel} ${C}`} strokeDashoffset={dashoffset}>
                <title>{`${STATUS_L[d.status] ?? d.status}: ${d.total} (${Math.round((d.total / total) * 100)}%)`}</title>
              </circle>
            )
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tp)', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 2 }}>RDO{total === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 150 }}>
        {dados.map(d => {
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0
          return (
            <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COR[d.status], flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--ts)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {STATUS_L[d.status] ?? d.status}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--tp)' }}>{d.total}</span>
              <span style={{ color: 'var(--tm)', fontSize: 10.5, width: 34, textAlign: 'right' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gráfico de funil ─────────────────────────────────────────
// Cada item vira um trapézio (largura topo = seu valor, largura base = valor
// do próximo item), formando o afunilamento contínuo — os dados já chegam
// ordenados do maior pro menor. Rótulo fica ao lado (a fatia mais estreita
// nunca teria espaço pro texto dentro).
function FunnelChart({ dados, cor }: { dados: Array<{ label: string; valor: number; sufixo?: string }>; cor: string }) {
  const max  = Math.max(1, ...dados.map(d => d.valor))
  const n    = dados.length
  const W    = 200
  const rowH = 32
  const gap  = 2 // separador na cor do fundo entre as fatias
  const H    = rowH * n

  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
        {dados.map((d, i) => {
          const topPct = d.valor / max
          const botPct = (i < n - 1 ? dados[i + 1].valor : d.valor) / max
          const topHalf = (topPct * W) / 2
          const botHalf = (botPct * W) / 2
          const y1 = i * rowH
          const y2 = y1 + rowH - gap
          const cx = W / 2
          const opacidade = n > 1 ? 1 - (i / (n - 1)) * 0.55 : 1
          return (
            <polygon key={d.label}
              points={`${cx - topHalf},${y1} ${cx + topHalf},${y1} ${cx + botHalf},${y2} ${cx - botHalf},${y2}`}
              fill={cor} opacity={opacidade}>
              <title>{`${d.label}: ${d.valor}${d.sufixo ?? ''}`}</title>
            </polygon>
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {dados.map(d => (
          <div key={d.label} style={{ height: rowH, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}>
            <span style={{ color: 'var(--ts)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--tp)', flexShrink: 0 }}>{d.valor}{d.sufixo ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Arredonda o topo do eixo Y pra um número "redondo" (1/2/5 × potência de 10)
function niceMax(valor: number): number {
  if (valor <= 0) return 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(valor)))
  const residual = valor / magnitude
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  return niceResidual * magnitude
}

function fmtLabelBucket(iso: string, agrupamento: 'dia' | 'semana' | 'mes') {
  const d = new Date(`${iso}T00:00:00`)
  if (agrupamento === 'mes') return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  if (agrupamento === 'semana') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`
}

function fmtHoras(horas: number): string {
  if (horas < 24) return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`
  return `${(horas / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

// ── Barras horizontais simples — usado pra distribuições com categorias
// fixas (não faz sentido no funil, que pressupõe afunilamento maior→menor) ──
function BarrasHorizontais({ dados, cor }: { dados: Array<{ label: string; valor: number }>; cor: string }) {
  const max = Math.max(1, ...dados.map(d => d.valor))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.map(d => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--ts)' }}>{d.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--tp)' }}>{d.valor}</span>
          </div>
          <div className="hbtr"><div className="hbf" style={{ width: `${(d.valor / max) * 100}%`, background: cor }} /></div>
        </div>
      ))}
    </div>
  )
}

// Versão compacta do KpiCard — usada aqui pra caber 12 indicadores em 2 linhas
// (o KpiCard padrão do resto do app é grande demais pra essa densidade).
function MiniKpi({ icon, valor, label, cor, titulo }: { icon: string; valor: React.ReactNode; label: string; cor?: string; titulo?: string }) {
  return (
    <div title={titulo} style={{ background: 'var(--s2)', border: '.5px solid var(--b)', borderRadius: 10, padding: '9px 10px', position: 'relative', overflow: 'hidden' }}>
      <i className={`ti ${icon}`} style={{ position: 'absolute', right: 7, top: 7, fontSize: 18, opacity: .07 }} />
      <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1, marginBottom: 3, color: cor ?? 'var(--tp)' }}>{valor}</div>
      <div style={{ fontSize: 9.5, color: 'var(--ts)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
    </div>
  )
}

export default function RelatoriosPage() {
  const [grupo, setGrupo]       = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [preset, setPreset]     = useState<'7' | '30' | '90' | 'custom'>('30')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim]       = useState('')

  const { data: projetos } = useProjetos()
  const grupos = useMemo(
    () => Array.from(new Set((projetos ?? []).map(p => p.grupo).filter(Boolean) as string[])).sort(),
    [projetos],
  )
  const projetosFiltrados = useMemo(
    () => (grupo ? (projetos ?? []).filter(p => p.grupo === grupo) : (projetos ?? [])),
    [projetos, grupo],
  )

  const usandoCustom = preset === 'custom' && !!dataInicio && !!dataFim
  const { data, isLoading } = useRelatorio({
    projetoId: projetoId || undefined,
    grupo:     grupo || undefined,
    ...(usandoCustom
      ? { dataInicio, dataFim }
      : { periodo: Number(preset === 'custom' ? 30 : preset) }),
  })

  function onGrupoChange(novoGrupo: string) {
    setGrupo(novoGrupo)
    // Se o projeto selecionado não pertence mais ao grupo escolhido, limpa
    if (novoGrupo && projetoId) {
      const p = (projetos ?? []).find(pr => pr.id === projetoId)
      if (p?.grupo !== novoGrupo) setProjetoId('')
    }
  }

  const maxPeriodo = niceMax(Math.max(1, ...(data?.rdosPorPeriodo.pontos.map(p => p.total) ?? [1])))
  // Evita rótulos repetidos no eixo Y quando o total é muito baixo (ex.: 1 RDO)
  const ticksPeriodo = (() => {
    let anterior: number | null = null
    return [4, 3, 2, 1, 0].map(i => {
      const v = Math.round((maxPeriodo * i) / 4)
      const label = v === anterior ? '' : String(v)
      anterior = v
      return label
    })
  })()
  const totalHHCat = (data?.hhPorCategoria ?? []).reduce((s, h) => s + h.totalHH, 0)
  const horasOcorrenciaOrdenadas = [...(data?.ocorrenciasPorTipo ?? [])].sort((a, b) => b.horas - a.horas)
  const maxDesvioAbs = Math.max(1, ...((data?.rankingPiorDesvio ?? []).map(p => Math.abs(p.desvio))))

  const avancoMedio = data?.progressoPorProjeto.length
    ? Math.round(data.progressoPorProjeto.reduce((s, p) => s + p.pctReal, 0) / data.progressoPorProjeto.length)
    : 0

  // Evita rótulos amontoados quando há muitas barras (agrupamento diário/semanal longo)
  const pontosPeriodo = data?.rdosPorPeriodo.pontos ?? []
  const passoLabel = pontosPeriodo.length > 15 ? Math.ceil(pontosPeriodo.length / 15) : 1

  return (
    <div className="main">
      <Topbar
        titulo="Relatórios"
        subtitulo="Análise de desempenho"
        acoes={
          <button className="btn" onClick={() => toast.info('PDF em breve!')}>
            <i className="ti ti-file-export" /> Exportar PDF
          </button>
        }
      />
      <div className="content">

        <div className="fr-row">
          <select className="fsel" value={grupo} onChange={e => onGrupoChange(e.target.value)}>
            <option value="">Todos os grupos</option>
            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="fsel" value={projetoId} onChange={e => setProjetoId(e.target.value)}>
            <option value="">Todos os projetos</option>
            {projetosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="fsel" value={preset} onChange={e => setPreset(e.target.value as '7' | '30' | '90' | 'custom')}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Último trimestre</option>
            <option value="custom">Período personalizado</option>
          </select>
          {preset === 'custom' && (
            <>
              <input type="date" className="fi" style={{ width: 140 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--tm)' }}>até</span>
              <input type="date" className="fi" style={{ width: 140 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </>
          )}
        </div>

        <div className="kgrid" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
          {isLoading ? Array(12).fill(0).map((_, i) => <div key={i} className="kpi"><Skeleton h={48} /></div>) : <>
            <MiniKpi icon="ti-trending-up" valor={`${avancoMedio}%`} label="Avanço médio" cor="var(--ta)" />
            <MiniKpi icon="ti-arrows-diff" valor={<Desvio valor={data?.kpis.desvioMedio ?? 0} />} label="Desvio médio" />
            <MiniKpi icon="ti-file-text"   valor={data?.kpis.totalRdos ?? 0} label="RDOs no período" />
            <MiniKpi icon="ti-clock"       valor={data?.kpis.totalHH ?? 0}  label="H/H registradas" />
            <MiniKpi icon="ti-circle-check" valor={`${data?.kpis.taxaAprovacao ?? 0}%`} label="Taxa de aprovação" cor="var(--tsu)" />
            <MiniKpi icon="ti-alert-triangle" valor={data?.kpis.ocorrenciasAbertas ?? 0} label="Ocorrências abertas" cor="var(--tw)" />
            <MiniKpi icon="ti-folder"      valor={data?.kpis.totalProjetos ?? 0} label="Projetos" />
            <MiniKpi icon="ti-users"       valor={data?.kpis.totalUsuarios ?? 0} label="Usuários" />
            <MiniKpi icon="ti-photo"       valor={data?.kpis.totalFotos ?? 0} label="Fotos" titulo="Total acumulado — não é afetado pelo filtro de período" />
            <MiniKpi icon="ti-video"       valor={data?.kpis.totalVideos ?? 0} label="Vídeos" titulo="Total acumulado — não é afetado pelo filtro de período" />
            <MiniKpi icon="ti-paperclip"   valor={data?.kpis.totalAnexos ?? 0} label="Anexos" titulo="Total acumulado — não é afetado pelo filtro de período" />
            <MiniKpi icon="ti-database"    valor={fmtBytes(data?.kpis.armazenamentoBytes ?? 0)} label="Armazenamento" titulo="Total acumulado — não é afetado pelo filtro de período" />
          </>}
        </div>

        {isLoading ? <Skeleton h={400} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            {/* H/H por categoria (direta/indireta/terceirizada) */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">H/H por categoria de mão de obra</span></div>
              <div className="sec-body">
                {(data?.hhPorCategoria.length ?? 0) === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Sem registros de mão de obra no período.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
                      {data?.hhPorCategoria.map(h => {
                        const pct = totalHHCat > 0 ? (h.totalHH / totalHHCat) * 100 : 0
                        return (
                          <div key={h.categoria} style={{ width: `${pct}%`, background: CATEGORIA_COR[h.categoria] }}
                            title={`${CATEGORIA_L[h.categoria] ?? h.categoria}: ${h.totalHH} H/H (${Math.round(pct)}%)`} />
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {data?.hhPorCategoria.map(h => (
                        <div key={h.categoria} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: CATEGORIA_COR[h.categoria], flexShrink: 0 }} />
                          <span style={{ color: 'var(--ts)' }}>{CATEGORIA_L[h.categoria] ?? h.categoria}</span>
                          <span style={{ fontWeight: 600, color: 'var(--tp)' }}>{h.totalPessoas}p · {h.totalHH} H/H</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Top 5 — piores desvios */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">Top 5 — piores desvios</span></div>
              <div className="sec-body">
                {(data?.rankingPiorDesvio.length ?? 0) === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Nenhum projeto ativo no filtro selecionado.</div>
                ) : (
                  data?.rankingPiorDesvio.map(p => (
                    <div key={p.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, marginBottom: 4 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.nome}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ color: 'var(--tm)', fontSize: 10.5 }}>{p.pctReal}% / plan {p.pctPlanejado}%</span>
                          <Desvio valor={p.desvio} />
                        </span>
                      </div>
                      <div className="hbtr">
                        <div className="hbf" style={{ width: `${(Math.abs(p.desvio) / maxDesvioAbs) * 100}%`, background: p.desvio < 0 ? 'var(--td)' : 'var(--tsu)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Status dos RDOs */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">Status dos RDOs</span></div>
              <div className="sec-body">
                {data && <DonutStatusRdos dados={data.statusRdos} total={data.kpis.totalRdos} />}
              </div>
            </div>

            {/* Ocorrências por tipo */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">Ocorrências por tipo</span></div>
              <div className="sec-body">
                {(data?.ocorrenciasPorTipo.length ?? 0) === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Nenhuma ocorrência no período.</div>
                ) : (
                  <FunnelChart cor="var(--td)" dados={data!.ocorrenciasPorTipo.map(o => ({ label: OC_L[o.tipo] ?? o.tipo, valor: o.total }))} />
                )}
              </div>
            </div>

            {/* Horas impactadas por ocorrências */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">Horas impactadas por ocorrências</span></div>
              <div className="sec-body">
                {horasOcorrenciaOrdenadas.filter(o => o.horas > 0).length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Nenhuma ocorrência com duração registrada no período.</div>
                ) : (
                  <FunnelChart cor="var(--tw)" dados={horasOcorrenciaOrdenadas.filter(o => o.horas > 0).map(o => ({ label: OC_L[o.tipo] ?? o.tipo, valor: o.horas, sufixo: 'h' }))} />
                )}
              </div>
            </div>

            {/* H/H por função */}
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-h"><span className="sec-title">H/H por função</span></div>
              <div className="sec-body">
                {(data?.hhPorFuncao.length ?? 0) === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Sem registros de mão de obra no período.</div>
                ) : (
                  <FunnelChart cor="var(--tsu)" dados={data!.hhPorFuncao.map(h => ({ label: h.funcao, valor: h.totalHH, sufixo: ' H/H' }))} />
                )}
              </div>
            </div>

            {/* Tempo médio de aprovação de RDO */}
            <div className="sec" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <div className="sec-h">
                <span className="sec-title">Tempo médio de aprovação de RDO</span>
                {data?.tempoAprovacao.mediaHoras != null && (
                  <span style={{ fontSize: 11, color: 'var(--tm)' }}>
                    Média: <strong style={{ color: 'var(--tp)' }}>{fmtHoras(data.tempoAprovacao.mediaHoras)}</strong> · {data.tempoAprovacao.amostra} RDO{data.tempoAprovacao.amostra === 1 ? '' : 's'} decidido{data.tempoAprovacao.amostra === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="sec-body">
                {(data?.tempoAprovacao.amostra ?? 0) === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Nenhum RDO enviado e decidido no período (dado disponível a partir de RDOs enviados após esta funcionalidade).</div>
                ) : (
                  <BarrasHorizontais cor="var(--ta)" dados={data!.tempoAprovacao.distribuicao.map(d => ({ label: d.faixa, valor: d.total }))} />
                )}
              </div>
            </div>

            {/* RDOs ao longo do tempo */}
            <div className="sec" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <div className="sec-h"><span className="sec-title">RDOs ao longo do tempo</span></div>
              <div className="sec-body">
                {pontosPeriodo.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--tm)' }}>Nenhum RDO no período.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {/* Eixo Y — valores redondos, alinhados às linhas de grade */}
                    <div style={{ height: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 9, color: 'var(--tm)', textAlign: 'right', flexShrink: 0 }}>
                      {ticksPeriodo.map((label, i) => <span key={i}>{label}</span>)}
                    </div>
                    <div style={{ flex: 1, overflowX: 'auto', minWidth: 0 }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>
                        {/* Área do gráfico: linhas de grade + barras de largura fixa */}
                        <div style={{ height: 180, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                          {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 25}%`, borderTop: '1px solid var(--b)' }} />
                          ))}
                          {pontosPeriodo.map(p => (
                            <div key={p.data} style={{ width: 30, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', position: 'relative' }}
                              title={`${fmtLabelBucket(p.data, data!.rdosPorPeriodo.agrupamento)} · ${p.total} RDO(s)`}>
                              <div style={{ width: 20, height: `${(p.total / maxPeriodo) * 100}%`, background: 'var(--ta)', borderRadius: '3px 3px 0 0' }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: 'var(--tm)', marginTop: 6 }}>
                          {pontosPeriodo.map((p, i) => (
                            <div key={p.data} style={{ width: 30, flexShrink: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {i % passoLabel === 0 ? fmtLabelBucket(p.data, data!.rdosPorPeriodo.agrupamento) : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
