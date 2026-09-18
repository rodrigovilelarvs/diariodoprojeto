// lib/fake-db-test.ts
// Banco falso usado pelos testes de ponta a ponta (Playwright, ver
// tests/e2e/) e também útil pra depuração manual local — ative com
// FAKE_DB=1 (ver lib/prisma.ts). Nunca é usado em produção: a Vercel não
// define essa variável, então o require abaixo nunca roda lá.
//
// Implementa só os métodos do Prisma que os fluxos testados realmente
// chamam; qualquer método não coberto cai num fallback genérico (ver
// `modelo()`) que devolve algo neutro em vez de estourar.

const AGORA = new Date()

export const TENANT_ID = 't1'
export const ADMIN_EMAIL = 'admin@teste.com'
export const ADMIN_SENHA = 'teste123'
export const PROJETO_ID = 'p1'
export const PROJETO_NOME = 'Obra Teste E2E'

const TENANT = { id: TENANT_ID, nome: 'Empresa Teste', status: 'ATIVO', limiteRdosMes: 0, limiteUsuarios: 0, limiteProjetos: 0 }

const ADMIN = {
  id: 'admin1', tenantId: TENANT_ID, nome: 'Rodrigo Vilela Santos', email: ADMIN_EMAIL,
  senha: '$2a$10$/A37tU4hhXLUW8oVrW5Wu./Povna1X4mapHVqf4H/SFsMfAtl3/9e', // bcrypt de "teste123"
  telefone: null, funcao: 'Administrador', perfil: 'ADMIN', status: 'ATIVO', avatarUrl: null,
  permEmitirRdo: true, permAprovarRdo: true, permGerenciarProjetos: true,
  permGerenciarEquipe: true, permVerRelatorios: true, permGerenciarTarefas: true,
  ultimoAcessoEm: null, criadoEm: AGORA, atualizadoEm: AGORA, tenant: TENANT,
}

const PROJETO = {
  id: PROJETO_ID, tenantId: TENANT_ID, nome: PROJETO_NOME, descricao: 'Projeto fixo do banco falso de testes.',
  pedidoCompraContrato: 'Contrato 001', empresaContratada: 'Construtora Teste Ltda',
  status: 'ATIVO', grupo: null, fotoUrl: null,
  dataInicioContrato: new Date('2026-08-01'), dataFimContrato: new Date('2026-12-01'),
  cor: '#29B6D8', gestorId: null, gestor: null,
  assinaturaModo: 'ABERTA', assinante1Id: null, assinante2Id: null, assinante3Id: null,
  assinante1: null, assinante2: null, assinante3: null,
  criadoEm: AGORA, atualizadoEm: AGORA,
  etapas: [],
  _count: { rdos: 0, etapas: 0 },
}

// RDOs criados durante os testes ficam guardados aqui (id → objeto completo),
// pra o GET /api/app/rdos/[id] devolver o mesmo RDO que o POST acabou de criar.
const rdosCriados = new Map<string, any>()
let proximoNumero = 1

function pick<T extends object>(obj: T, select?: Record<string, any>): any {
  if (!select) return obj
  const out: any = {}
  for (const k of Object.keys(select)) {
    if ((select as any)[k] === true) out[k] = (obj as any)[k]
    else if (typeof (select as any)[k] === 'object') out[k] = (obj as any)[k]
  }
  return out
}

function defaultParaMetodo(method: string) {
  if (['findMany', 'groupBy'].includes(method)) return async () => []
  if (method === 'findFirst' || method === 'findUnique') return async () => null
  if (method === 'count') return async () => 0
  if (method === 'aggregate') return async () => ({ _sum: {}, _count: 0, _avg: {} })
  if (['create', 'update', 'upsert'].includes(method)) return async (args: any) => args?.data ?? {}
  return async () => {}
}

// Modelo com métodos explícitos em `overrides`; qualquer método do Prisma
// não coberto aqui cai num default genérico em vez de estourar.
function modelo(overrides: Record<string, (...a: any[]) => any>) {
  return new Proxy(overrides, {
    get: (target, prop) => (prop in target ? target[prop as string] : defaultParaMetodo(String(prop))),
  })
}

const fakeDbBase = {
  $transaction: async (fn: any) => fn(fakeDb),
  $queryRaw: async () => [],
  $disconnect: async () => {},

  tenant: modelo({
    findUnique: async ({ where }: any) => (where.id === TENANT_ID ? TENANT : null),
  }),

  usuario: modelo({
    findFirst: async ({ where }: any) => (where.email === ADMIN_EMAIL ? ADMIN : null),
    findUnique: async ({ where, select }: any) => (where.id === ADMIN.id ? pick(ADMIN, select) : null),
    findMany: async () => [ADMIN],
    count: async () => 1,
    update: async ({ data }: any) => ({ ...ADMIN, ...data }),
  }),

  logAuditoria: modelo({
    count: async () => 0,
    findFirst: async () => null,
    create: async ({ data }: any) => data,
  }),

  projeto: modelo({
    findFirst: async ({ where }: any) => (where?.id === PROJETO_ID ? PROJETO : null),
    findMany: async () => [PROJETO],
    count: async () => 1,
  }),

  rdo: modelo({
    findFirst: async ({ where, orderBy }: any) => {
      // GET /api/app/rdos/[id] — resposta completa de um RDO já criado
      if (where?.id && rdosCriados.has(where.id)) return rdosCriados.get(where.id)
      // "próximo número" (orderBy numero desc) e "RDO anterior pra copiar" —
      // sem histórico no banco falso, sempre "nenhum anterior"
      void orderBy
      return null
    },
    findMany: async ({ where, take }: any) => {
      const projetoId = where?.projetoId ?? where?.projeto?.id
      let lista = [...rdosCriados.values()]
      if (projetoId) lista = lista.filter(r => r.projetoId === projetoId)
      // Filtros usados pela tela de relatórios — sem isso, um RDO criado
      // por outro teste (ex.: em rascunho) vaza pras métricas que exigem
      // status/enviadoEm específicos e quebra a rota com dado inconsistente.
      if (where?.status?.in) lista = lista.filter(r => where.status.in.includes(r.status))
      if (where?.enviadoEm?.not === null) lista = lista.filter(r => r.enviadoEm != null)
      return take ? lista.slice(0, take) : lista
    },
    count: async () => rdosCriados.size,
    findUnique: async ({ where }: any) => rdosCriados.get(where.id) ?? null,
  }),

  // A criação de RDO roda dentro de $transaction — implementado fora do
  // `modelo()` acima porque precisa persistir estado entre a chamada de
  // criação e o findUnique/findFirst subsequentes na mesma request.
}

const rdoCreate = async ({ data }: any) => {
  const id = `rdo-teste-${proximoNumero}`
  const numero = proximoNumero++
  const criado = {
    id, projetoId: data.projetoId, numero, data: data.data ?? AGORA, status: data.status ?? 'RASCUNHO',
    emissorId: data.emissorId, emissor: { id: ADMIN.id, nome: ADMIN.nome },
    horaInicio: data.horaInicio ?? null, horaTermino: data.horaTermino ?? null,
    intervaloHoras: data.intervaloHoras ?? null, totalHoras: data.totalHoras ?? null,
    climaManha: null, climaTarde: null, climaNoite: null, precipitacaoMm: null, climaImpacto: 'NENHUM',
    observacoes: null, enviadoEm: null, criadoEm: AGORA, atualizadoEm: AGORA,
    projeto: {
      id: PROJETO_ID, nome: PROJETO_NOME,
      dataInicioContrato: PROJETO.dataInicioContrato, dataFimContrato: PROJETO.dataFimContrato,
      pedidoCompraContrato: PROJETO.pedidoCompraContrato, empresaContratada: PROJETO.empresaContratada,
      assinaturaModo: PROJETO.assinaturaModo, assinante1: null, assinante2: null, assinante3: null,
    },
    atividadeRegistros: [], maoDeObra: [], equipamentos: [],
    ocorrencias: [], midias: [], comentarios: [], assinaturas: [], aprovacoes: [],
    _count: { midias: 0, comentarios: 0, ocorrencias: 0 },
  }
  rdosCriados.set(id, criado)
  return { id, numero }
}

const fakeDbFull = {
  ...fakeDbBase,
  rdo: modelo({
    ...(fakeDbBase.rdo as any),
    create: rdoCreate,
  }),
}

export const fakeDb: any = new Proxy(fakeDbFull, {
  get: (target, prop) => (prop in target ? (target as any)[prop] : modelo({})),
})
