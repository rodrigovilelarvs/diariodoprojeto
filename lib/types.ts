// src/lib/types.ts
// Tipos TypeScript espelhando o schema Prisma — compartilhados entre hooks e componentes

// ── Enums ────────────────────────────────────────────────────
export type PlanoTipo      = 'STARTER' | 'PRO' | 'ENTERPRISE'
export type TenantStatus   = 'AGUARDANDO' | 'ATIVO' | 'SUSPENSO'
export type UsuarioPerfil  = 'ADMIN' | 'PERSONALIZADO'
export type UsuarioStatus  = 'ATIVO' | 'INATIVO' | 'CONVIDADO'
export type RdoStatus      = 'RASCUNHO' | 'PENDENTE_APROVACAO' | 'APROVADO' | 'REJEITADO'
export type AtividadeStatus = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'EM_ATRASO'
export type ClimaCondicao  = 'SOL' | 'NUBLADO' | 'CHUVA' | 'TEMPESTADE'
export type ClimaImpacto   = 'NENHUM' | 'PARCIAL' | 'TOTAL'
export type OcorrenciaTipo = 'ACIDENTE_INCIDENTE' | 'ATRASO_MATERIAL' | 'PROBLEMA_TECNICO' | 'PARALISACAO' | 'CONDICAO_CLIMATICA' | 'FALTA_MAO_DE_OBRA' | 'OUTRO'
export type OcorrenciaGravidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'
export type MidiaTipo      = 'FOTO' | 'VIDEO' | 'ARQUIVO'
export type LogNivel       = 'INFO' | 'AVISO' | 'ERRO' | 'CRITICO'
export type LogCategoria   = 'LOGIN' | 'RDO' | 'USUARIO' | 'PLANO' | 'EMPRESA' | 'ASSINATURA' | 'SISTEMA'
export type AssinaturaStatus = 'PENDENTE' | 'ASSINADO'
export type MaoDeObraCategoria = 'DIRETA' | 'INDIRETA' | 'TERCEIRIZADO'

// ── Auth ─────────────────────────────────────────────────────
export interface LoginResponse {
  token:   string
  usuario: UsuarioResumo
  tenant:  { id: string; nome: string }
}

export interface AdminLoginResponse {
  token:    string
  admin:    { id: string; nome: string; email: string }
  expiraEm: string
}

// ── Usuário ──────────────────────────────────────────────────
// As 5 flags só têm efeito quando perfil = 'PERSONALIZADO' — ADMIN sempre
// tem tudo liberado, independente delas.
export interface PermissoesUsuario {
  permEmitirRdo:         boolean
  permAprovarRdo:        boolean
  permGerenciarProjetos: boolean
  permGerenciarEquipe:   boolean
  permVerRelatorios:     boolean
  permGerenciarTarefas:  boolean
}

export interface UsuarioResumo extends Partial<PermissoesUsuario> {
  id:        string
  nome:      string
  email:     string
  perfil:    UsuarioPerfil
  funcao?:   string // cargo/função exibido junto ao nome na aprovação e no PDF
  avatarUrl?: string
}

export interface Usuario extends UsuarioResumo {
  status:         UsuarioStatus
  ultimoAcessoEm?: string
  criadoEm:       string
  _count?:        { projetoAcessos: number }
}

export interface Convite extends Partial<PermissoesUsuario> {
  id:          string
  email:       string
  funcao?:     string
  perfil:      UsuarioPerfil
  criadoEm:    string
  expiradoEm:  string
}

export interface UsuariosResponse {
  usuarios: Usuario[]
  convites: Convite[]
  uso:      { atual: number; limite: number }
}

// ── Meu perfil ───────────────────────────────────────────────
export interface EmpresaVinculada {
  tenantId:     string
  nome:         string
  tenantStatus: TenantStatus
  perfil:       UsuarioPerfil
  statusConta:  UsuarioStatus
  atual:        boolean
}

// ── Dados da empresa ─────────────────────────────────────────
export interface EmpresaInfo {
  id:                  string
  nome:                string
  cnpj?:               string
  setor?:              string
  cidade?:             string
  uf?:                 string
  contatoNome?:        string
  contatoEmail?:       string
  contatoTelefone?:    string
  plano:               PlanoTipo
  status:              TenantStatus
  dataVencimentoPlano?: string
  ativadoEm?:          string
  criadoEm:            string
  limites: { usuarios: number; rdosMes: number; projetos: number }
  uso:     { usuarios: number; rdosMes: number; projetos: number }
  planoConfig?: {
    precoMensal:        number
    temRelatorios:      boolean
    temExportPdf:       boolean
    temApi:             boolean
    temSuporteDedicado: boolean
    descricao?:         string
  }
}

// ── Projeto ──────────────────────────────────────────────────
export type ProjetoAcessoNivel = 'VISUALIZAR' | 'EDITAR' | 'GERENCIAMENTO'
export type ProjetoAssinaturaModo = 'ABERTA' | 'DEFINIDA'

export interface ProjetoAcessoItem {
  id:        string
  usuarioId: string
  nivel:     ProjetoAcessoNivel
  usuario:   Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> & { status: string }
}

// Visão inversa da mesma ACL — a partir de um usuário, quais projetos ele
// enxerga e com qual nível (nivel null = sem registro específico, ou seja,
// vê o projeto se ele não tiver nenhuma restrição configurada por ninguém).
export interface UsuarioAcessoProjeto {
  id:     string
  nome:   string
  cor:    string
  grupo?: string
  status: string
  restrito: boolean // true = este projeto tem ACL configurada (por alguém)
  nivel:  ProjetoAcessoNivel | null // nível deste usuário especificamente, se houver
}

export interface Projeto {
  id:                  string
  nome:                string
  descricao?:          string
  pedidoCompraContrato?: string
  empresaContratada?:  string
  status:              string
  grupo?:              string
  fotoUrl?:            string
  cor:                 string
  dataInicioContrato?: string
  dataFimContrato?:    string
  gestor?:             UsuarioResumo
  pctReal:             number
  pctPlanejado:        number
  desvio:              number
  ocorrenciasAbertas:  number
  totalAtividades?:    number
  totalOcorrencias?:   number
  totalComentarios?:   number
  totalFotos?:         number
  totalVideos?:        number
  _count:              { rdos: number; etapas: number }
  podeGerenciar?:      boolean
  assinaturaModo?:     ProjetoAssinaturaModo
  assinante1?:         Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
  assinante2?:         Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
  assinante3?:         Pick<UsuarioResumo, 'id' | 'nome' | 'email' | 'perfil'> | null
}

// ── Resumo do projeto ─────────────────────────────────────────
export interface ResumoMidiaItem { id: string; url: string; nomeArq: string; descricao?: string; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoAtividadeItem { id: string; nome: string; pctAnterior: number; pctAtual: number; deltaHoje: number; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoOcorrenciaItem { id: string; tipo: string; descricao: string; resolvida: boolean; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoComentarioItem { id: string; texto: string; criadoEm: string; autorNome: string; totalRespostas: number; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoClimaItem { rdoId: string; rdoNumero: number; rdoData: string; climaManha?: ClimaCondicao; climaTarde?: ClimaCondicao; climaNoite?: ClimaCondicao; precipitacaoMm?: number; climaImpacto: ClimaImpacto }
export interface ResumoMaoDeObraItem { funcaoNome: string; quantidade: number; horaEntrada: string; horaSaida: string; totalHH: number; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoEquipamentoItem { equipamentoNome: string; quantidade: number; observacao?: string; rdoId: string; rdoNumero: number; rdoData: string }
export interface ResumoRdoItem { id: string; numero: number; data: string; status: RdoStatus; totalFotos: number; assinaturas: { status: string }[] }

export interface ResumoProjeto {
  projeto: Pick<Projeto, 'id' | 'nome' | 'descricao' | 'pedidoCompraContrato' | 'empresaContratada' | 'status' | 'grupo' | 'fotoUrl' | 'cor' | 'dataInicioContrato' | 'dataFimContrato' | 'gestor' | 'podeGerenciar'>
  kpis: {
    totalRdos: number
    pctReal: number
    pctPlanejado: number
    desvio: number
    ocorrenciasAbertas: number
    totalHH: number
  }
  rdosRecentes: ResumoRdoItem[]
  fotos:       ResumoMidiaItem[]
  videos:      ResumoMidiaItem[]
  anexos:      ResumoMidiaItem[]
  atividades:  ResumoAtividadeItem[]
  ocorrencias: ResumoOcorrenciaItem[]
  comentarios: ResumoComentarioItem[]
  clima:       ResumoClimaItem[]
  maoDeObra:   ResumoMaoDeObraItem[]
  equipamentos: ResumoEquipamentoItem[]
}

// ── Atividade / EAP ──────────────────────────────────────────
export interface RegistroHistorico {
  pctAnterior: number
  pctAtual:    number
  deltaHoje:   number
  rdo:         { numero: number; data: string }
}

export interface Atividade {
  id:            string
  etapaId:       string
  numero:        string
  nome:          string
  status:        AtividadeStatus
  pctAcumulado:  number
  dataInicio?:   string
  dataFim?:      string
  registrosRdo:  RegistroHistorico[]
}

export interface Etapa {
  id:          string
  numero:      string
  nome:        string
  ordem:       number
  atividades:  Atividade[]
}

export interface EapResponse {
  etapas: Etapa[]
  kpis: {
    total:     number
    nao:       number
    andamento: number
    concluida: number
    atraso:    number
    pctMedio:  number
    pctPlanejado: number
  }
}

// ── RDO ─────────────────────────────────────────────────────
export interface MaoDeObraItem {
  id?:              string
  funcaoCadastroId?: string
  funcaoCadastro?:  FuncaoCadastro | null
  funcaoNome:       string
  categoria:        MaoDeObraCategoria
  quantidade:       number
  horaEntrada:      string
  horaSaida:        string
  totalHH:          number
}

export interface FuncaoCadastro {
  id:        string
  nome:      string
  categoria: MaoDeObraCategoria
}

export type EquipamentoTipo = 'PROPRIO' | 'ALUGADO' | 'TERCEIRIZADO'

export interface EquipamentoItem {
  id?:                    string
  equipamentoCadastroId?: string
  equipamentoCadastro?:   EquipamentoCadastro | null
  equipamentoNome:        string
  quantidade:             number
  observacao?:            string
}

export interface EquipamentoCadastro {
  id:   string
  nome: string
  tipo: EquipamentoTipo
}

export interface OcorrenciaItem {
  id?:         string
  tipo:        string
  horaInicio?: string
  horaTermino?: string
  duracaoMin?: number
  descricao:   string
  responsavel?: string
}

export interface OcorrenciaTipoCadastro {
  id:   string
  nome: string
}

export interface MidiaItem {
  id:        string
  tipo:      MidiaTipo
  nomeArq:   string
  url:       string
  descricao?: string
  ordem:     number
}

export interface Comentario {
  id:        string
  texto:     string
  criadoEm:  string
  editadoEm?: string
  autor:     UsuarioResumo
  respostas: Comentario[]
}

export interface AssinaturaItem {
  id:        string
  status:    AssinaturaStatus
  cargo:     string
  assinadoEm?: string
  usuario:   UsuarioResumo
  assinaturaDigital?: { imagemUrl: string }
}

export interface RegistroAtividade {
  id?:          string
  atividadeId?: string
  pctAnterior:  number
  pctAtual:     number
  deltaHoje:    number
  avulsa?:      boolean
  avulsaEtapa?: string
  avulsaNome?:  string
  atividade?:   Atividade & { etapa: Pick<Etapa, 'numero' | 'nome'> }
}

export interface Rdo {
  id:             string
  numero:         number
  data:           string
  status:         RdoStatus
  horaInicio?:    string
  horaTermino?:   string
  intervaloHoras?: number
  totalHoras?:    number
  climaManha?:    ClimaCondicao
  climaTarde?:    ClimaCondicao
  climaNoite?:    ClimaCondicao
  precipitacaoMm?: number
  climaImpacto:   ClimaImpacto
  observacoes?:   string
  projeto:        Pick<Projeto, 'id' | 'nome' | 'dataInicioContrato' | 'dataFimContrato' | 'pedidoCompraContrato' | 'empresaContratada' | 'assinaturaModo' | 'assinante1' | 'assinante2' | 'assinante3'>
  emissor:        UsuarioResumo
  atividadeRegistros: RegistroAtividade[]
  maoDeObra:      MaoDeObraItem[]
  equipamentos:   EquipamentoItem[]
  ocorrencias:    OcorrenciaItem[]
  midias:         MidiaItem[]
  comentarios:    Comentario[]
  assinaturas:    AssinaturaItem[]
  criadoEm:       string
  atualizadoEm:   string
}

export interface RdoResumo {
  id:      string
  numero:  number
  data:    string
  status:  RdoStatus
  climaManha?: ClimaCondicao
  projeto: Pick<Projeto, 'id' | 'nome'>
  emissor: Pick<UsuarioResumo, 'id' | 'nome'>
  assinaturas: { status: string }[]
  _count:  { midias: number; comentarios: number; ocorrencias: number }
}

export interface RdosResponse {
  rdos:   RdoResumo[]
  total:  number
  pagina: number
  por:    number
}

// ── Relatórios ───────────────────────────────────────────────
export interface RelatorioResponse {
  dataInicio: string
  dataFim:    string
  kpis: {
    totalRdos:  number
    totalHH:    number
    aprovados:  number
    pendentes:  number
    rascunhos:  number
    rejeitados: number
    desvioMedio:        number
    taxaAprovacao:      number
    ocorrenciasAbertas: number
    totalProjetos:      number
    totalUsuarios:      number
    totalFotos:         number
    totalVideos:        number
    totalAnexos:        number
    armazenamentoBytes: number
  }
  progressoPorProjeto: Array<{
    id:           string
    nome:         string
    cor:          string
    pctReal:      number
    pctPlanejado: number
    desvio:       number
    totalRdos:    number
  }>
  statusRdos: Array<{ status: RdoStatus; total: number }>
  ocorrenciasPorTipo:      Array<{ tipo: string; total: number; horas: number }>
  hhPorFuncao:             Array<{ funcao: string; totalHH: number }>
  hhPorCategoria:          Array<{ categoria: MaoDeObraCategoria; totalHH: number; totalPessoas: number }>
  rdosPorPeriodo: {
    agrupamento: 'dia' | 'semana' | 'mes'
    pontos: Array<{ data: string; total: number }>
  }
  rankingPiorDesvio: Array<{
    id:           string
    nome:         string
    cor:          string
    pctReal:      number
    pctPlanejado: number
    desvio:       number
    totalRdos:    number
  }>
  tempoAprovacao: {
    mediaHoras: number | null
    amostra:    number
    distribuicao: Array<{ faixa: string; total: number }>
  }
}

// ── Super-admin — Plano ──────────────────────────────────────
export interface PlanoConfig {
  id:                 string
  tipo:               PlanoTipo
  precoMensal:        number
  limiteUsuarios:     number
  limiteRdosMes:      number
  limiteProjetos:     number
  temRelatorios:      boolean
  temExportPdf:       boolean
  temApi:             boolean
  temSuporteDedicado: boolean
  descricao?:         string
}

export interface PlanosResponse {
  planos:       PlanoConfig[]
  distribuicao: Array<{ plano: PlanoTipo; empresas: number; receita: number }>
  mrr:          number
}

// ── Super-admin — Tenant ─────────────────────────────────────
export interface Tenant {
  id:             string
  nome:           string
  cnpj?:          string
  setor?:         string
  cidade?:        string
  uf?:            string
  plano:          PlanoTipo
  status:         TenantStatus
  obsInterna?:    string
  contatoNome?:   string
  contatoEmail?:  string
  contatoTelefone?: string
  dataVencimentoPlano?: string
  limiteUsuarios: number
  limiteRdosMes:  number
  limiteProjetos: number
  ativadoEm?:     string
  criadoEm:       string
  rdosMes:        number
  alertas:        number
  _count: {
    usuarios: number
    projetos: number
    logs:     number
  }
  usuarios?: Array<{ id: string; nome: string; email: string; telefone?: string; status: UsuarioStatus }>
}

export interface TenantsResponse {
  tenants: Tenant[]
  total:   number
  pagina:  number
  por:     number
  resumo: {
    total:      number
    ativos:     number
    aguardando: number
    suspensos:  number
    mrr:        number
  }
}

// ── Super-admin — Log ────────────────────────────────────────
export interface LogEntry {
  id:          string
  nivel:       LogNivel
  categoria:   LogCategoria
  mensagem:    string
  detalhe?:    string
  ipAddress?:  string
  criadoEm:    string
  resolvido:   boolean
  resolvidoEm?: string
  notaInterna?: string
  tenant?:     { id: string; nome: string }
  usuario?:    { id: string; nome: string; email: string }
}

export interface LogsResponse {
  logs:  LogEntry[]
  total: number
  kpis: {
    total:                number
    alertasNaoResolvidos: number
    porNivel:             Record<LogNivel, number>
  }
}

// ── Super-admin — Dashboard ──────────────────────────────────
export interface DashboardAdminResponse {
  kpis: {
    empresas: {
      total: number; ativas: number; aguardando: number; novasMes: number
      tendencia: { valor: number; percentual: number; direcao: 'up' | 'down' | 'stable' }
    }
    usuarios: { total: number; ativos7d: number; novosMes: number }
    rdos:     { mes: number; mesPassado: number; tendencia: { valor: number; percentual: number; direcao: 'up' | 'down' | 'stable' } }
    receita:  {
      mrr: number
      tendencia: { valor: number; percentual: number; direcao: 'up' | 'down' | 'stable' }
      porPlano: Record<PlanoTipo, { empresas: number; receita: number }>
    }
    alertas: { abertos: number; criticos: number }
  }
  logsRecentes:      LogEntry[]
  distribuicaoPlanos: Array<{ plano: PlanoTipo; empresas: number; receita: number }>
}
