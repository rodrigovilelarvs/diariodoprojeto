// src/hooks/useEmpresa.ts
// Todos os hooks React Query do lado da empresa

import {
  useQuery, useMutation, useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Projeto, RdosResponse, Rdo, EapResponse,
  UsuariosResponse, RelatorioResponse, ResumoProjeto,
  MaoDeObraItem, EquipamentoItem, OcorrenciaItem, RegistroAtividade,
  FuncaoCadastro, MaoDeObraCategoria,
  EquipamentoCadastro, EquipamentoTipo,
  OcorrenciaTipoCadastro,
  ProjetoAcessoItem, ProjetoAcessoNivel, ProjetoAssinaturaModo, UsuarioAcessoProjeto,
  UsuarioResumo, Usuario, EmpresaVinculada, EmpresaInfo,
} from '@/lib/types'

// ── Query keys centralizadas ─────────────────────────────────
export const QK = {
  projetos:   ['projetos']                          as const,
  rdos:       (filtros?: Record<string, string>) =>
                ['rdos', filtros ?? {}]             as const,
  rdo:        (id: string) => ['rdo', id]           as const,
  rdoLog:     (id: string) => ['rdo-log', id]        as const,
  eap:        (projetoId: string) =>
                ['eap', projetoId]                  as const,
  resumoProjeto: (id: string) => ['resumo-projeto', id] as const,
  projetoAcesso: (id: string) => ['projeto-acesso', id] as const,
  projetoAssinaturas: (id: string) => ['projeto-assinaturas', id] as const,
  usuarios:   ['usuarios']                          as const,
  usuarioAcessos: (id: string) => ['usuario-acessos', id] as const,
  relatorio:  (filtros?: Record<string, string>) =>
                ['relatorio', filtros ?? {}]        as const,
  minhaAssinatura: ['minha-assinatura']              as const,
  notificacoes: ['notificacoes']                     as const,
  notificacoesUsuario: (id: string) => ['notificacoes-usuario', id] as const,
  funcoes:    ['funcoes']                            as const,
  equipamentosCadastro: ['equipamentos-cadastro']    as const,
  ocorrenciaTipos: ['ocorrencia-tipos']              as const,
  meuPerfil:  ['meu-perfil']                         as const,
  empresasVinculadas: ['empresas-vinculadas']        as const,
  empresaInfo: ['empresa-info']                      as const,
}

// ════════════════════════════════════════
// PROJETOS
// ════════════════════════════════════════

export function useProjetos() {
  return useQuery({
    queryKey: QK.projetos,
    queryFn:  () => api.get<Projeto[]>('/api/app/projetos'),
    staleTime: 60_000, // 1 min — projetos mudam pouco
  })
}

export function useCriarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      nome:               string
      descricao?:         string
      pedidoCompraContrato?: string
      empresaContratada?: string
      grupo?:             string
      fotoUrl?:           string
      dataInicioContrato?: string
      dataFimContrato?:    string
      gestorId?:           string
      cor?:                string
    }) => api.post<Projeto>('/api/app/projetos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projetos }),
  })
}

export function useAtualizarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string
      nome?:               string
      descricao?:          string
      pedidoCompraContrato?: string
      empresaContratada?:  string
      grupo?:              string
      status?:             string
      fotoUrl?:            string
      dataInicioContrato?: string
      dataFimContrato?:    string
      gestorId?:           string
      cor?:                string
    }) => api.patch<Projeto>(`/api/app/projetos/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.projetos })
      qc.invalidateQueries({ queryKey: QK.resumoProjeto(vars.id) })
    },
  })
}

export function useExcluirProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/app/projetos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projetos }),
  })
}

export function useDuplicarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, comConteudo }: { id: string; comConteudo?: boolean }) =>
      api.post<Projeto>(`/api/app/projetos/${id}/duplicar`, { comConteudo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.projetos }),
  })
}

export function useResumoProjeto(id: string) {
  return useQuery({
    queryKey: QK.resumoProjeto(id),
    queryFn:  () => api.get<ResumoProjeto>(`/api/app/projetos/${id}/resumo`),
    enabled:  !!id,
    staleTime: 30_000,
  })
}

// ── Acesso à pasta do projeto ──────────────────────────────
export interface ProjetoAcessoResponse {
  acessos:  ProjetoAcessoItem[]
  usuarios: Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'>[]
}

export function useProjetoAcesso(projetoId: string) {
  return useQuery({
    queryKey: QK.projetoAcesso(projetoId),
    queryFn:  () => api.get<ProjetoAcessoResponse>(`/api/app/projetos/${projetoId}/acesso`),
    enabled:  !!projetoId,
  })
}

export function useDefinirAcessoProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projetoId, usuarioId, nivel }: { projetoId: string; usuarioId: string; nivel: ProjetoAcessoNivel }) =>
      api.post<ProjetoAcessoItem>(`/api/app/projetos/${projetoId}/acesso`, { usuarioId, nivel }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.projetoAcesso(vars.projetoId) }),
  })
}

export function useRemoverAcessoProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projetoId, usuarioId }: { projetoId: string; usuarioId: string }) =>
      api.delete(`/api/app/projetos/${projetoId}/acesso/${usuarioId}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.projetoAcesso(vars.projetoId) }),
  })
}

// ── Assinaturas exigidas do projeto ────────────────────────
export interface ProjetoAssinaturasResponse {
  assinaturaModo: ProjetoAssinaturaModo
  assinante1: Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
  assinante2: Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
  assinante3: Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
  usuariosElegiveis: Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'>[]
}

export function useProjetoAssinaturas(projetoId: string) {
  return useQuery({
    queryKey: QK.projetoAssinaturas(projetoId),
    queryFn:  () => api.get<ProjetoAssinaturasResponse>(`/api/app/projetos/${projetoId}/assinaturas`),
    enabled:  !!projetoId,
  })
}

export function useAtualizarAssinaturasProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projetoId, ...body }: {
      projetoId: string
      assinaturaModo?: ProjetoAssinaturaModo
      assinante1Id?: string | null
      assinante2Id?: string | null
      assinante3Id?: string | null
    }) => api.patch(`/api/app/projetos/${projetoId}/assinaturas`, body),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.projetoAssinaturas(vars.projetoId) }),
  })
}

// ════════════════════════════════════════
// RDOs
// ════════════════════════════════════════

export function useRdos(
  filtros?: { projetoId?: string; status?: string; pagina?: number; sortBy?: string; sortDir?: string; data?: string },
  opcoes?: { enabled?: boolean },
) {
  const params = new URLSearchParams()
  if (filtros?.projetoId) params.set('projetoId', filtros.projetoId)
  if (filtros?.status)    params.set('status',    filtros.status)
  if (filtros?.pagina)    params.set('pagina',    String(filtros.pagina))
  if (filtros?.sortBy)    params.set('sortBy',    filtros.sortBy)
  if (filtros?.sortDir)   params.set('sortDir',   filtros.sortDir)
  if (filtros?.data)      params.set('data',      filtros.data)

  const qs = params.toString()
  return useQuery({
    queryKey: QK.rdos(filtros as Record<string, string>),
    queryFn:  () => api.get<RdosResponse>(`/api/app/rdos${qs ? `?${qs}` : ''}`),
    staleTime: 30_000,
    enabled: opcoes?.enabled ?? true,
  })
}

export function useRdo(
  id: string,
  options?: UseQueryOptions<Rdo>,
) {
  return useQuery<Rdo>({
    queryKey: QK.rdo(id),
    queryFn:  () => api.get<Rdo>(`/api/app/rdos/${id}`),
    enabled:  !!id,
    staleTime: 15_000,
    ...options,
  })
}

export interface RdoLogItem { mensagem: string; criadoEm: string; usuario: string }

export function useRdoLog(id: string) {
  return useQuery({
    queryKey: QK.rdoLog(id),
    queryFn:  () => api.get<{ edicoes: RdoLogItem[]; visualizacoes: RdoLogItem[] }>(`/api/app/rdos/${id}/log`),
    enabled:  !!id,
    staleTime: 15_000,
  })
}

export function useCriarRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { projetoId: string; data: string; copiarAnterior?: boolean }) =>
      api.post<Rdo>('/api/app/rdos', body),
    onSuccess: () => {
      // Só invalida a lista. NÃO pré-popular o cache do detalhe com a resposta
      // do POST: ela tem menos campos que o GET /api/app/rdos/[id], e o
      // formulário quebrava ao montar com relações ausentes. A tela de detalhe
      // busca o RDO completo por conta própria (1 request rápido a mais).
      qc.invalidateQueries({ queryKey: ['rdos'] })
    },
  })
}

export function useSalvarRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id, ...body
    }: {
      id:                  string
      numero?:             number
      data?:               string
      horaInicio?:         string
      horaTermino?:        string
      intervaloHoras?:     number
      climaManha?:         string
      climaTarde?:         string
      climaNoite?:         string | null
      precipitacaoMm?:     number
      climaImpacto?:       string
      observacoes?:        string
      atividadeRegistros?: RegistroAtividade[]
      maoDeObra?:          MaoDeObraItem[]
      equipamentos?:       EquipamentoItem[]
      ocorrencias?:        OcorrenciaItem[]
    }) => api.patch<{ ok: boolean }>(`/api/app/rdos/${id}`, body),
    onSuccess: (_, vars) => {
      // Invalida o RDO específico para recarregar do servidor
      qc.invalidateQueries({ queryKey: QK.rdo(vars.id) })
    },
  })
}

export function useEnviarRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; status: string; aprovadores: number }>(
        `/api/app/rdos/${id}/enviar`,
        {},
      ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: QK.rdo(id) })
      qc.invalidateQueries({ queryKey: ['rdos'] })
    },
  })
}

export function useReabrirRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; status: string }>(`/api/app/rdos/${id}/reabrir`, {}),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: QK.rdo(id) })
      qc.invalidateQueries({ queryKey: ['rdos'] })
    },
  })
}

export function useExcluirRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: boolean }>(`/api/app/rdos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rdos'] })
    },
  })
}

// ── Auto-save de rascunho ──────────────────────────────────
// Chame useSalvarRdo com debounce de 2s no componente do formulário

// ════════════════════════════════════════
// EAP — LISTA DE TAREFAS
// ════════════════════════════════════════

export function useEap(projetoId: string) {
  return useQuery({
    queryKey: QK.eap(projetoId),
    queryFn:  () => api.get<EapResponse>(`/api/app/tarefas?projetoId=${projetoId}`),
    enabled:  !!projetoId,
    staleTime: 30_000,
  })
}

export function useCriarEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { projetoId: string; nome: string; numero?: string }) =>
      api.post('/api/app/tarefas', { tipo: 'etapa', ...body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) })
    },
  })
}

export function useCriarAtividade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      projetoId:    string
      etapaId:      string
      nome:         string
      dataInicio?:  string
      dataFim?:     string
      status?:      string
      pctAcumulado?: number
    }) => api.post('/api/app/tarefas', { tipo: 'atividade', ...body }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) })
    },
  })
}

export function useAtualizarEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projetoId, ...body }: { id: string; projetoId: string; nome?: string; numero?: string }) =>
      api.patch(`/api/app/tarefas/etapa/${id}`, body),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) }),
  })
}

export function useAtualizarAtividade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, projetoId, ...body }: {
      id: string; projetoId: string
      nome?: string; dataInicio?: string; dataFim?: string; status?: string; pctAcumulado?: number
    }) => api.patch(`/api/app/tarefas/atividade/${id}`, body),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) }),
  })
}

export function useRemoverAtividade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projetoId: string }) =>
      api.delete(`/api/app/tarefas/atividade/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) }),
  })
}

export function useRemoverEtapa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; projetoId: string }) =>
      api.delete(`/api/app/tarefas/etapa/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: QK.eap(vars.projetoId) }),
  })
}

// ════════════════════════════════════════
// FUNÇÕES — Mão de obra (catálogo direta/indireta)
// ════════════════════════════════════════

export function useFuncoes() {
  return useQuery({
    queryKey: QK.funcoes,
    queryFn:  () => api.get<FuncaoCadastro[]>('/api/app/funcoes'),
    staleTime: 60_000,
  })
}

export function useCriarFuncao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nome: string; categoria: MaoDeObraCategoria }) =>
      api.post<FuncaoCadastro>('/api/app/funcoes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.funcoes }),
  })
}

// ════════════════════════════════════════
// EQUIPAMENTOS — catálogo (próprio/alugado/terceirizado)
// ════════════════════════════════════════

export function useEquipamentosCadastro() {
  return useQuery({
    queryKey: QK.equipamentosCadastro,
    queryFn:  () => api.get<EquipamentoCadastro[]>('/api/app/equipamentos'),
    staleTime: 60_000,
  })
}

export function useCriarEquipamentoCadastro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nome: string; tipo: EquipamentoTipo }) =>
      api.post<EquipamentoCadastro>('/api/app/equipamentos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.equipamentosCadastro }),
  })
}

// ════════════════════════════════════════
// TIPOS DE OCORRÊNCIA — catálogo por tenant
// ════════════════════════════════════════

export function useOcorrenciaTipos() {
  return useQuery({
    queryKey: QK.ocorrenciaTipos,
    queryFn:  () => api.get<OcorrenciaTipoCadastro[]>('/api/app/ocorrencia-tipos'),
    staleTime: 60_000,
  })
}

export function useCriarOcorrenciaTipo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nome: string }) =>
      api.post<OcorrenciaTipoCadastro>('/api/app/ocorrencia-tipos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.ocorrenciaTipos }),
  })
}

// ════════════════════════════════════════
// USUÁRIOS
// ════════════════════════════════════════

export function useUsuarios() {
  return useQuery({
    queryKey: QK.usuarios,
    queryFn:  () => api.get<UsuariosResponse>('/api/app/usuarios'),
    staleTime: 60_000,
  })
}

export function useConvidarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      email: string; perfil: string; nome?: string; senha?: string; funcao?: string
      permEmitirRdo?: boolean; permAprovarRdo?: boolean
      permGerenciarProjetos?: boolean; permGerenciarEquipe?: boolean; permVerRelatorios?: boolean
      permGerenciarTarefas?: boolean
    }) => api.post('/api/app/usuarios', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.usuarios }),
  })
}

export function useAtualizarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string; nome?: string; perfil?: string; status?: string; funcao?: string
      permEmitirRdo?: boolean; permAprovarRdo?: boolean
      permGerenciarProjetos?: boolean; permGerenciarEquipe?: boolean; permVerRelatorios?: boolean
      permGerenciarTarefas?: boolean
    }) => api.patch(`/api/app/usuarios/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.usuarios }),
  })
}

// Projetos que um usuário específico acessa (visão inversa de useProjetoAcesso)
export function useUsuarioAcessos(usuarioId: string | null) {
  return useQuery({
    queryKey: QK.usuarioAcessos(usuarioId ?? ''),
    queryFn:  () => api.get<{ projetos: UsuarioAcessoProjeto[] }>(`/api/app/usuarios/${usuarioId}/acessos`),
    enabled:  !!usuarioId,
  })
}

export function useDefinirAcessoUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ usuarioId, projetoId, nivel }: { usuarioId: string; projetoId: string; nivel: ProjetoAcessoNivel }) =>
      api.post(`/api/app/usuarios/${usuarioId}/acessos`, { projetoId, nivel }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.usuarioAcessos(vars.usuarioId) })
      qc.invalidateQueries({ queryKey: QK.usuarios })
    },
  })
}

export function useRemoverAcessoUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ usuarioId, projetoId }: { usuarioId: string; projetoId: string }) =>
      api.delete(`/api/app/usuarios/${usuarioId}/acessos/${projetoId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.usuarioAcessos(vars.usuarioId) })
      qc.invalidateQueries({ queryKey: QK.usuarios })
    },
  })
}

export function useCancelarConvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conviteId: string) => api.delete(`/api/app/usuarios/convite/${conviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.usuarios }),
  })
}

// ════════════════════════════════════════
// RELATÓRIOS
// ════════════════════════════════════════

export interface RelatorioFiltros {
  projetoId?:  string
  grupo?:      string
  periodo?:    number  // dias — ignorado quando dataInicio/dataFim são informados
  dataInicio?: string  // YYYY-MM-DD
  dataFim?:    string  // YYYY-MM-DD
}

export function useRelatorio(filtros: RelatorioFiltros = {}) {
  const { projetoId, grupo, periodo, dataInicio, dataFim } = filtros
  const params = new URLSearchParams()
  if (projetoId)  params.set('projetoId', projetoId)
  if (grupo)      params.set('grupo', grupo)
  if (dataInicio && dataFim) {
    params.set('dataInicio', dataInicio)
    params.set('dataFim', dataFim)
  } else {
    params.set('periodo', String(periodo ?? 30))
  }

  return useQuery({
    queryKey: QK.relatorio(Object.fromEntries(params)),
    queryFn:  () =>
      api.get<RelatorioResponse>(`/api/app/relatorios?${params.toString()}`),
    staleTime: 120_000, // 2 min — relatórios são menos urgentes
  })
}

// ════════════════════════════════════════
// COMENTÁRIOS
// ════════════════════════════════════════

export function useEnviarComentario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { rdoId: string; texto: string; parentId?: string }) =>
      api.post(`/api/app/rdos/${body.rdoId}/comentarios`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
    },
  })
}

export function useEditarComentario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rdoId, comentarioId, texto }: { rdoId: string; comentarioId: string; texto: string }) =>
      api.patch(`/api/app/rdos/${rdoId}/comentarios/${comentarioId}`, { texto }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
    },
  })
}

export function useExcluirComentario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rdoId, comentarioId }: { rdoId: string; comentarioId: string }) =>
      api.delete(`/api/app/rdos/${rdoId}/comentarios/${comentarioId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
    },
  })
}

// ════════════════════════════════════════
// ASSINATURAS
// ════════════════════════════════════════

export function useMinhaAssinatura() {
  return useQuery({
    queryKey: QK.minhaAssinatura,
    queryFn:  () => api.get<{ assinatura: { imagemUrl: string; atualizadoEm: string } | null }>('/api/app/assinatura'),
    staleTime: 60_000,
  })
}

export function useSalvarAssinatura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { imagemBase64: string }) =>
      api.post<{ assinatura: { imagemUrl: string; atualizadoEm: string } }>('/api/app/assinatura', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.minhaAssinatura })
      // Invalida todos os RDOs pois o status das assinaturas pode ter mudado
      qc.invalidateQueries({ queryKey: ['rdo'] })
    },
  })
}

// ════════════════════════════════════════
// MEU PERFIL
// ════════════════════════════════════════

export function useMeuPerfil() {
  return useQuery({
    queryKey: QK.meuPerfil,
    queryFn:  () => api.get<Usuario>('/api/app/perfil'),
    staleTime: 30_000,
  })
}

export function useAtualizarPerfil() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { nome?: string; avatarUrl?: string | null }) =>
      api.patch<Usuario>('/api/app/perfil', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.meuPerfil }),
  })
}

export function useAlterarSenha() {
  return useMutation({
    mutationFn: (body: { senhaAtual: string; novaSenha: string }) =>
      api.post<{ ok: true }>('/api/app/perfil/senha', body),
  })
}

export function useEmpresasVinculadas() {
  return useQuery({
    queryKey: QK.empresasVinculadas,
    queryFn:  () => api.get<{ empresas: EmpresaVinculada[] }>('/api/app/perfil/empresas'),
    staleTime: 60_000,
  })
}

// ════════════════════════════════════════
// DADOS DA EMPRESA
// ════════════════════════════════════════

export function useEmpresaInfo() {
  return useQuery({
    queryKey: QK.empresaInfo,
    queryFn:  () => api.get<EmpresaInfo>('/api/app/empresa'),
    staleTime: 60_000,
  })
}

export function useAtualizarEmpresaInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      nome?: string; cnpj?: string; setor?: string; cidade?: string; uf?: string
      contatoNome?: string; contatoEmail?: string; contatoTelefone?: string
    }) => api.patch<Partial<EmpresaInfo>>('/api/app/empresa', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.empresaInfo }),
  })
}

// ════════════════════════════════════════
// NOTIFICAÇÕES
// ════════════════════════════════════════

export interface PreferenciaNotificacao {
  emailRdoEnviado:       boolean
  emailRdoAprovado:      boolean
  emailRdoRejeitado:     boolean
  emailLembreteDiario:   boolean
  emailContratoVencendo: boolean
  emailConvitePendente:  boolean
  modoNotificacao:       'IMEDIATO' | 'DIGEST_DIARIO'
}

export function useNotificacoes() {
  return useQuery({
    queryKey: QK.notificacoes,
    queryFn:  () => api.get<PreferenciaNotificacao>('/api/app/notificacoes'),
    staleTime: 60_000,
  })
}

export function useAtualizarNotificacoes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<PreferenciaNotificacao>) =>
      api.patch<PreferenciaNotificacao>('/api/app/notificacoes', body),
    onSuccess: (novo) => qc.setQueryData(QK.notificacoes, novo),
  })
}

// Visão do admin sobre a preferência de OUTRO usuário (mesmos campos, outra rota).
export function useNotificacoesUsuario(usuarioId: string | null) {
  return useQuery({
    queryKey: QK.notificacoesUsuario(usuarioId ?? ''),
    queryFn:  () => api.get<PreferenciaNotificacao>(`/api/app/usuarios/${usuarioId}/notificacoes`),
    enabled:  !!usuarioId,
  })
}

export function useAtualizarNotificacoesUsuario(usuarioId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<PreferenciaNotificacao>) =>
      api.patch<PreferenciaNotificacao>(`/api/app/usuarios/${usuarioId}/notificacoes`, body),
    onSuccess: (novo) => qc.setQueryData(QK.notificacoesUsuario(usuarioId), novo),
  })
}

// ════════════════════════════════════════
// MÍDIAS — Upload com progresso
// ════════════════════════════════════════

export function useUploadMidia() {
  const qc = useQueryClient()

  const upload = useMutation({
    mutationFn: async ({
      rdoId,
      tenantId,
      file,
      onProgress,
    }: {
      rdoId:       string
      tenantId:    string
      file:        File
      onProgress?: (pct: number) => void
    }) => {
      // Validação tamanho
      const tipo = file.type.startsWith('image/') ? 'FOTO'
                 : file.type.startsWith('video/') ? 'VIDEO'
                 : 'ARQUIVO'
      if (tipo === 'VIDEO' && file.size > 50 * 1024 * 1024) {
        throw new Error(`${file.name} excede o limite de 50MB para vídeos.`)
      }

      // 1. Upload para Supabase Storage via importação dinâmica
      const { uploadMidia } = await import('@/lib/storage')
      onProgress?.(10)
      const { url } = await uploadMidia({ tenantId, rdoId, file, onProgress })
      onProgress?.(80)

      // 2. Registra no banco via API
      const res = await api.post('/api/app/midias', {
        rdoId,
        tipo,
        nomeArq:      file.name,
        url,
        tamanhoBytes: file.size,
        ordem:        0,
      })
      onProgress?.(100)
      return res
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
    },
  })

  return upload
}

export function useAtualizarMidia() {
  return useMutation({
    mutationFn: ({ midiaId, descricao }: { midiaId: string; rdoId: string; descricao: string }) =>
      api.patch(`/api/app/midias?id=${midiaId}`, { descricao }),
  })
}

export function useRemoverMidia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ midiaId, rdoId }: { midiaId: string; rdoId: string }) =>
      api.delete(`/api/app/midias?id=${midiaId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
    },
  })
}

// ════════════════════════════════════════
// APROVAÇÃO
// ════════════════════════════════════════

export function useAprovarRdo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      rdoId,
      aprovado,
      comentario,
    }: {
      rdoId:      string
      aprovado:   boolean
      comentario?: string
    }) =>
      api.post<{
        ok:             boolean
        status:         string
        assinadas:      number
        total:          number
        todosAssinaram: boolean
        mensagem:       string
      }>(`/api/app/rdos/${rdoId}/aprovar`, { aprovado, comentario }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QK.rdo(vars.rdoId) })
      qc.invalidateQueries({ queryKey: ['rdos'] })
    },
  })
}
