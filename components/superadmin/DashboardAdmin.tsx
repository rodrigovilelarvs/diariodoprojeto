'use client'
// src/components/superadmin/DashboardAdmin.tsx
// Dashboard do super-admin conectado ao backend

import { toast } from 'sonner'
import { useAdminDashboard } from '@/hooks/useAdmin'
import { useAtivarTenant, useSuspenderTenant } from '@/hooks/useAdmin'
import type { LogEntry, PlanoTipo } from '@/lib/types'

const PLANO_LABEL: Record<PlanoTipo, string> = {
  STARTER:    'Starter',
  PRO:        'Pro',
  ENTERPRISE: 'Enterprise',
}

const NIVEL_COR: Record<string, string> = {
  CRITICO: '#E05C5C',
  ERRO:    '#E05C5C',
  AVISO:   '#E6A817',
  INFO:    '#29B6D8',
}

export function DashboardAdmin() {
  const { data, isLoading, isError, dataUpdatedAt } = useAdminDashboard()
  const ativar    = useAtivarTenant()
  const suspender = useSuspenderTenant()

  if (isLoading) return <div>Carregando dashboard...</div>
  if (isError)   return <div>Erro ao carregar dados.</div>
  if (!data)     return null

  const { kpis, logsRecentes, distribuicaoPlanos } = data

  async function handleAtivar(tenantId: string) {
    try {
      await ativar.mutateAsync(tenantId)
      toast.success('Empresa ativada!')
    } catch {
      toast.error('Erro ao ativar empresa.')
    }
  }

  async function handleSuspender(tenantId: string) {
    try {
      await suspender.mutateAsync(tenantId)
      toast.warning('Empresa suspensa.')
    } catch {
      toast.error('Erro ao suspender empresa.')
    }
  }

  return (
    <div className="admin-dashboard">

      {/* Última atualização */}
      <div className="last-update">
        Atualizado: {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        <KpiCard
          valor={kpis.empresas.ativas}
          label="Empresas ativas"
          tendencia={kpis.empresas.tendencia}
          cor="#29B6D8"
        />
        <KpiCard
          valor={kpis.usuarios.total}
          label="Usuários totais"
          sub={`${kpis.usuarios.ativos7d} ativos esta semana`}
        />
        <KpiCard
          valor={kpis.rdos.mes}
          label="RDOs este mês"
          tendencia={kpis.rdos.tendencia}
        />
        <KpiCard
          valor={`R$ ${kpis.receita.mrr.toLocaleString('pt-BR')}`}
          label="MRR"
          tendencia={kpis.receita.tendencia}
          cor="#F59E0B"
        />
        <KpiCard
          valor={kpis.alertas.abertos}
          label="Alertas abertos"
          sub={`${kpis.alertas.criticos} críticos`}
          cor={kpis.alertas.criticos > 0 ? '#E05C5C' : undefined}
        />
      </div>

      <div className="dashboard-grid">

        {/* ── Receita por plano ── */}
        <section>
          <h3>Receita por plano</h3>
          {distribuicaoPlanos.map((d) => (
            <div key={d.plano} className="plano-row">
              <span className="plano-nome">{PLANO_LABEL[d.plano]}</span>
              <span className="plano-emp">{d.empresas} empresa{d.empresas !== 1 ? 's' : ''}</span>
              <div className="plano-bar-wrap">
                <div
                  className="plano-bar"
                  style={{
                    width: `${(d.receita / kpis.receita.mrr) * 100}%`,
                    background: d.plano === 'ENTERPRISE'
                      ? '#F59E0B' : d.plano === 'PRO'
                      ? '#29B6D8' : 'rgba(255,255,255,0.15)',
                  }}
                />
              </div>
              <span className="plano-valor">
                {d.receita > 0 ? `R$ ${d.receita.toLocaleString('pt-BR')}` : 'Grátis'}
              </span>
            </div>
          ))}
        </section>

        {/* ── Alertas recentes ── */}
        <section>
          <h3>Alertas recentes</h3>
          {logsRecentes.length === 0 && (
            <div className="empty">Nenhum alerta. Tudo em ordem!</div>
          )}
          {logsRecentes.map((log) => (
            <LogItem key={log.id} log={log} />
          ))}
        </section>

      </div>

      {/* ── Empresas aguardando ativação ── */}
      {kpis.empresas.aguardando > 0 && (
        <section className="aguardando-section">
          <h3>Aguardando ativação ({kpis.empresas.aguardando})</h3>
          <p className="hint">
            Acesse <strong>Empresas</strong> no menu para ativar.
          </p>
        </section>
      )}

    </div>
  )
}

// ── Subcomponentes ───────────────────────────────────────────
function KpiCard({
  valor, label, sub, tendencia, cor,
}: {
  valor:      number | string
  label:      string
  sub?:       string
  tendencia?: { percentual: number; direcao: 'up' | 'down' | 'stable' }
  cor?:       string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-value" style={{ color: cor }}>
        {valor}
      </div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {tendencia && tendencia.direcao !== 'stable' && (
        <div className={`kpi-tend ${tendencia.direcao}`}>
          {tendencia.direcao === 'up' ? '↑' : '↓'} {Math.abs(tendencia.percentual)}% vs mês anterior
        </div>
      )}
    </div>
  )
}

function LogItem({ log }: { log: LogEntry }) {
  const cor = NIVEL_COR[log.nivel] ?? '#8B95A8'
  return (
    <div className="log-item" style={{ borderLeft: `3px solid ${cor}` }}>
      <div className="log-empresa">{log.tenant?.nome ?? 'Sistema'}</div>
      <div className="log-msg">{log.mensagem}</div>
      <div className="log-meta">
        {log.usuario?.email && <span>{log.usuario.email}</span>}
        <span>{new Date(log.criadoEm).toLocaleString('pt-BR')}</span>
        {!log.resolvido && <span className="nao-resolvido">Pendente</span>}
      </div>
    </div>
  )
}
