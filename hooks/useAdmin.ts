// src/hooks/useAdmin.ts
// Todos os hooks React Query do super-admin

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  DashboardAdminResponse, TenantsResponse,
  Tenant, LogsResponse, LogEntry, PlanoTipo,
} from '@/lib/types'

// ── Query keys ───────────────────────────────────────────────
export const AQK = {
  dashboard:  ['admin', 'dashboard']                           as const,
  tenants:    (filtros?: Record<string, string>) =>
                ['admin', 'tenants', filtros ?? {}]            as const,
  tenant:     (id: string) => ['admin', 'tenant', id]         as const,
  logs:       (filtros?: Record<string, string>) =>
                ['admin', 'logs', filtros ?? {}]               as const,
  planos:     ['admin', 'planos']                              as const,
}

// ════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════

export function useAdminDashboard() {
  return useQuery({
    queryKey: AQK.dashboard,
    queryFn:  () => api.get<DashboardAdminResponse>('/api/admin/dashboard', true),
    staleTime: 30_000,
    refetchInterval: 60_000, // atualiza automaticamente a cada 1 min
  })
}

// ════════════════════════════════════════
// TENANTS — EMPRESAS
// ════════════════════════════════════════

export function useTenants(filtros?: {
  status?:  string
  plano?:   string
  busca?:   string
  pagina?:  number
}) {
  const params = new URLSearchParams()
  if (filtros?.status) params.set('status', filtros.status)
  if (filtros?.plano)  params.set('plano',  filtros.plano)
  if (filtros?.busca)  params.set('busca',  filtros.busca)
  if (filtros?.pagina) params.set('pagina', String(filtros.pagina))

  const qs = params.toString()
  return useQuery({
    queryKey: AQK.tenants(filtros as Record<string, string>),
    queryFn:  () =>
      api.get<TenantsResponse>(`/api/admin/tenants${qs ? `?${qs}` : ''}`, true),
    staleTime: 30_000,
  })
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: AQK.tenant(id),
    queryFn:  () => api.get<Tenant & {
      usuarios:      unknown[]
      projetos:      unknown[]
      convites:      unknown[]
      logsRecentes:  unknown[]
      alertasAbertos: number
      rdosMes:       number
      uso:           Record<string, { atual: number; limite: number }>
    }>(`/api/admin/tenants/${id}`, true),
    enabled:  !!id,
    staleTime: 15_000,
  })
}

export function useCriarTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      nome:         string
      cnpj?:        string
      setor?:       string
      cidade?:      string
      uf?:          string
      admNome:      string
      admEmail:     string
      admTelefone?: string
      senha?:       string
      plano:        PlanoTipo
      obsInterna?:  string
      dataVencimentoPlano?: string
      ativarImediatamente?: boolean
    }) => api.post('/api/admin/tenants', body, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}

export function useAtualizarTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<{
      nome:           string
      cnpj:           string
      setor:          string
      cidade:         string
      uf:             string
      status:         string
      obsInterna:     string
      dataVencimentoPlano: string | null
      admNome:        string
      admEmail:       string
      admTelefone:    string
      admSenha:       string
      limiteUsuarios: number
      limiteRdosMes:  number
      limiteProjetos: number
    }>) => api.patch(`/api/admin/tenants/${id}`, body, true),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: AQK.tenant(vars.id) })
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}

// Atalhos semânticos para status
export function useAtivarTenant() {
  const atualizar = useAtualizarTenant()
  return {
    ...atualizar,
    mutate:      (id: string) => atualizar.mutate({ id, status: 'ATIVO' }),
    mutateAsync: (id: string) => atualizar.mutateAsync({ id, status: 'ATIVO' }),
  }
}

export function useSuspenderTenant() {
  const atualizar = useAtualizarTenant()
  return {
    ...atualizar,
    mutate:      (id: string) => atualizar.mutate({ id, status: 'SUSPENSO' }),
    mutateAsync: (id: string) => atualizar.mutateAsync({ id, status: 'SUSPENSO' }),
  }
}

export function useMudarPlano() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, plano, limiteUsuarios, limiteRdosMes, limiteProjetos,
    }: {
      id:              string
      plano:           PlanoTipo
      limiteUsuarios?: number
      limiteRdosMes?:  number
      limiteProjetos?: number
    }) =>
      api.patch(`/api/admin/tenants/${id}/plano`, {
        plano, limiteUsuarios, limiteRdosMes, limiteProjetos,
      }, true),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: AQK.tenant(vars.id) })
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}

export function useExcluirTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, confirmar }: { id: string; confirmar: string }) =>
      api.delete(`/api/admin/tenants/${id}`, { confirmar }, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}

// ════════════════════════════════════════
// LOGS DE AUDITORIA
// ════════════════════════════════════════

export function useLogs(filtros?: {
  tenantId?:  string
  nivel?:     string
  categoria?: string
  busca?:     string
  resolvido?: boolean
  periodo?:   number
  pagina?:    number
}) {
  const params = new URLSearchParams()
  if (filtros?.tenantId)  params.set('tenantId',  filtros.tenantId)
  if (filtros?.nivel)     params.set('nivel',     filtros.nivel)
  if (filtros?.categoria) params.set('categoria', filtros.categoria)
  if (filtros?.busca)     params.set('busca',     filtros.busca)
  if (filtros?.periodo)   params.set('periodo',   String(filtros.periodo))
  if (filtros?.pagina)    params.set('pagina',    String(filtros.pagina))
  if (filtros?.resolvido != null)
    params.set('resolvido', String(filtros.resolvido))

  const qs = params.toString()
  return useQuery({
    queryKey: AQK.logs(filtros as Record<string, string>),
    queryFn:  () =>
      api.get<LogsResponse>(`/api/admin/logs${qs ? `?${qs}` : ''}`, true),
    staleTime: 15_000,
    refetchInterval: 30_000, // atualiza a cada 30s
  })
}

export function useResolverLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, resolvido, notaInterna,
    }: {
      id:           string
      resolvido?:   boolean
      notaInterna?: string
    }) =>
      api.patch<LogEntry>(`/api/admin/logs/${id}`, { resolvido, notaInterna }, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}

// ════════════════════════════════════════
// PLANOS
// ════════════════════════════════════════

export function usePlanos() {
  return useQuery({
    queryKey: AQK.planos,
    queryFn:  () => api.get<{
      planos:         unknown[]
      distribuicao:   Record<string, number>
      mrr:            number
    }>('/api/admin/planos', true),
    staleTime: 300_000, // 5 min — planos mudam raramente
  })
}

export function useAtualizarPlano() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      tipo:               PlanoTipo
      precoMensal?:       number
      limiteUsuarios?:    number
      limiteRdosMes?:     number
      limiteProjetos?:    number
      temRelatorios?:     boolean
      temExportPdf?:      boolean
      temApi?:            boolean
      temSuporteDedicado?: boolean
    }) => api.patch('/api/admin/planos', body, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AQK.planos })
      qc.invalidateQueries({ queryKey: AQK.dashboard })
    },
  })
}
