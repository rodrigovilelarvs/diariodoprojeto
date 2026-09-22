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
// Usuários PERSONALIZADOS pra testar autorização (todos com a mesma senha)
export const LEITOR_EMAIL = 'leitor@teste.com'   // nenhuma permissão marcada
export const EMISSOR_EMAIL = 'emissor@teste.com' // só "emitir RDO"
export const GERENTE_EMAIL = 'gerente@teste.com' // só "gerenciar equipe" (não é ADMIN)
// Mesmo e-mail em mais de uma empresa (testes de "uma senha por e-mail")
export const TENANT2_ID = 't2'
export const MULTI_EMAIL = 'multi@teste.com'       // contas em t1 e t2, MESMA credencial (teste123)
export const DONO_EMAIL = 'dono@teste.com'         // t1: teste123 · t2: outra senha (atacante123)
export const VIAJANTE_EMAIL = 'viajante@teste.com' // conta só em t1; convidado pra t2
export const NOVATO_EMAIL = 'novato@teste.com'     // e-mail novo, convidado pra t2
// Super-admin (painel /admin) e empresas do painel — usados pelo teste de planos
export const SUPERADMIN_EMAIL = 'super@teste.com'
export const PROJETO_ID = 'p1'
export const PROJETO_NOME = 'Obra Teste E2E'
// Projeto CONCLUÍDO com histórico de RDOs — usado pelo teste de download em massa
export const PROJETO_CONCLUIDO_ID = 'p2'
export const PROJETO_CONCLUIDO_NOME = 'Obra Concluida E2E'
// Projeto concluído com muitas mídias (7 fotos) — usado pra testar a divisão do ZIP em partes
export const PROJETO_GRANDE_ID = 'p3'
export const PROJETO_GRANDE_NOME = 'Obra Grande E2E'
// Host fictício das mídias — o teste intercepta as requisições a ele (page.route)
export const STORAGE_FAKE = 'https://storage-fake.teste/rdos'

const TENANT2 = { id: 't2', nome: 'Empresa Dois', status: 'ATIVO', limiteRdosMes: 0, limiteUsuarios: 0, limiteProjetos: 0 }
const TENANT = { id: TENANT_ID, nome: 'Empresa Teste', status: 'ATIVO', limiteRdosMes: 0, limiteUsuarios: 0, limiteProjetos: 0 }

const SEM_PERMISSOES = {
  permEmitirRdo: false, permAprovarRdo: false, permGerenciarProjetos: false,
  permGerenciarEquipe: false, permVerRelatorios: false, permGerenciarTarefas: false,
}

const HASH_TESTE123 = '$2a$10$/A37tU4hhXLUW8oVrW5Wu./Povna1X4mapHVqf4H/SFsMfAtl3/9e' // bcrypt de "teste123"
const HASH_ATACANTE = '$2a$10$JYe9lDfKsQ79nb84iFtS7OtCAkVnZuvbmknB6Qk2H6I8z2fawjw2O' // bcrypt de "atacante123"

function usuarioFake(
  id: string, nome: string, email: string, perfil: string, perms: Partial<typeof SEM_PERMISSOES>,
  extra: { tenant?: typeof TENANT; senha?: string } = {},
) {
  const tenant = extra.tenant ?? TENANT
  return {
    id, tenantId: tenant.id, nome, email,
    senha: extra.senha ?? HASH_TESTE123,
    telefone: null, funcao: perfil === 'ADMIN' ? 'Administrador' : 'Colaborador', perfil, status: 'ATIVO', avatarUrl: null,
    ...SEM_PERMISSOES, ...perms,
    ultimoAcessoEm: null, criadoEm: AGORA, atualizadoEm: AGORA, tenant,
  }
}

const ADMIN = usuarioFake('admin1', 'Rodrigo Vilela Santos', ADMIN_EMAIL, 'ADMIN', {
  permEmitirRdo: true, permAprovarRdo: true, permGerenciarProjetos: true,
  permGerenciarEquipe: true, permVerRelatorios: true, permGerenciarTarefas: true,
})
const LEITOR  = usuarioFake('leitor1', 'Leitor Sem Permissoes', LEITOR_EMAIL, 'PERSONALIZADO', {})
const EMISSOR = usuarioFake('emissor1', 'Emissor De RDO', EMISSOR_EMAIL, 'PERSONALIZADO', { permEmitirRdo: true })
const GERENTE = usuarioFake('gerente1', 'Gerente De Equipe', GERENTE_EMAIL, 'PERSONALIZADO', { permGerenciarEquipe: true })
// Mesmo e-mail em duas empresas, com a MESMA credencial (a senha é uma só por e-mail)
const MULTI_A = usuarioFake('multi-a', 'Multi Empresa', MULTI_EMAIL, 'ADMIN', {})
const MULTI_B = usuarioFake('multi-b', 'Multi Empresa', MULTI_EMAIL, 'PERSONALIZADO', { permEmitirRdo: true }, { tenant: TENANT2 })
// Mesmo e-mail em duas empresas com credenciais DIFERENTES: a conta de t2 foi
// cadastrada à parte, com uma senha que outra pessoa escolheu
const DONO_A = usuarioFake('dono-a', 'Dono Da Conta', DONO_EMAIL, 'ADMIN', {})
const DONO_B = usuarioFake('dono-b', 'Dono Da Conta', DONO_EMAIL, 'PERSONALIZADO', {}, { tenant: TENANT2, senha: HASH_ATACANTE })
const VIAJANTE = usuarioFake('viajante-a', 'Viajante', VIAJANTE_EMAIL, 'PERSONALIZADO', {})
const USUARIOS = [ADMIN, LEITOR, EMISSOR, GERENTE, MULTI_A, MULTI_B, DONO_A, DONO_B, VIAJANTE]

// Convites pendentes pra empresa t2
const conviteFake = (token: string, email: string) => ({
  id: `conv-${token}`, token, email, tenantId: TENANT2_ID, tenant: TENANT2, funcao: null,
  perfil: 'PERSONALIZADO', permEmitirRdo: false, permAprovarRdo: false, permGerenciarProjetos: false,
  permGerenciarEquipe: false, permVerRelatorios: false, permGerenciarTarefas: false,
  aceitoEm: null as Date | null, expiradoEm: new Date(Date.now() + 7 * 86_400_000),
})
const CONVITES = [conviteFake('conv-viajante', VIAJANTE_EMAIL), conviteFake('conv-novato', NOVATO_EMAIL)]

// where de usuário usado pelas rotas de login/convite/perfil: e-mail, id, empresa e senha (preenchida ou não)
const casaUsuario = (u: any, where: any = {}) =>
  (where.email == null || u.email === where.email) &&
  (where.id == null || u.id === where.id) &&
  (where.tenantId == null || u.tenantId === where.tenantId) &&
  (where.senha === undefined ? true : where.senha?.not === null ? u.senha != null : u.senha === where.senha)

const SUPERADMIN = {
  id: 'sa1', nome: 'Super Admin Teste', email: SUPERADMIN_EMAIL,
  senha: '$2a$10$/A37tU4hhXLUW8oVrW5Wu./Povna1X4mapHVqf4H/SFsMfAtl3/9e', // bcrypt de "teste123"
}

// Empresas que aparecem no painel do super-admin. Ficam separadas do tenant t1
// (o das telas do app), então mexer nos limites delas não afeta os outros testes.
// `pessoas` = todos os usuários da empresa, com o status de cada um (o _count
// devolvido pelo findMany respeita o filtro de status pedido pela rota)
const empresaAdmin = (id: string, nome: string, plano: string, lim: [number, number, number], pessoas: string[]) => ({
  id, nome, plano, status: 'ATIVO', cnpj: null, criadoEm: AGORA, atualizadoEm: AGORA, dataVencimentoPlano: null,
  limiteUsuarios: lim[0], limiteRdosMes: lim[1], limiteProjetos: lim[2],
  pessoas, usuarios: [],
})
const TENANTS_ADMIN = [
  // A: 3 ativos + 1 inativo → ocupa 3 vagas, não 4
  empresaAdmin('ta', 'Empresa A (Starter)', 'STARTER', [3, 30, 2], ['ATIVO', 'ATIVO', 'ATIVO', 'INATIVO']),
  // B: 1 ativo + 1 convite pendente → ocupa 1 vaga
  empresaAdmin('tb', 'Empresa B (Starter)', 'STARTER', [3, 30, 2], ['ATIVO', 'CONVIDADO']),
  empresaAdmin('tc', 'Empresa C (Pro)', 'PRO', [10, 100, 10], ['ATIVO']),
]
// Forma que o Prisma devolve: _count com a contagem de usuários já filtrada
const comContagem = (t: (typeof TENANTS_ADMIN)[number], include?: any) => {
  const filtro = include?._count?.select?.usuarios?.where?.status
  const usuarios = filtro ? t.pessoas.filter(p => p === filtro).length : t.pessoas.length
  return { ...t, _count: { usuarios, projetos: 0, logs: 0 } }
}
const planoBase = (tipo: string, preco: number, lim: [number, number, number]) => ({
  id: `plano-${tipo}`, tipo, precoMensal: preco, limiteUsuarios: lim[0], limiteRdosMes: lim[1], limiteProjetos: lim[2],
  temRelatorios: false, temExportPdf: true, temApi: false, temSuporteDedicado: false, descricao: null, tenantId: null,
})
const PLANOS: Record<string, any> = {
  STARTER: planoBase('STARTER', 0, [3, 30, 2]),
  PRO: planoBase('PRO', 297, [10, 100, 10]),
  ENTERPRISE: planoBase('ENTERPRISE', 1485, [0, 0, 0]),
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
  etapas: [{
    id: 'e1', numero: '1.0', nome: 'Etapa sem datas', ordem: 0,
    atividades: [
      { id: 'a1', nome: 'Atividade A', pctAcumulado: 50, dataInicio: null, dataFim: null, status: 'EM_ANDAMENTO', ordem: 0 },
      { id: 'a2', nome: 'Atividade B', pctAcumulado: 30, dataInicio: null, dataFim: null, status: 'EM_ANDAMENTO', ordem: 1 },
    ],
  }],
  _count: { rdos: 0, etapas: 1 },
}

const PROJETO_CONCLUIDO = { ...PROJETO, id: PROJETO_CONCLUIDO_ID, nome: PROJETO_CONCLUIDO_NOME, status: 'CONCLUIDO' }
const PROJETO_GRANDE = { ...PROJETO, id: PROJETO_GRANDE_ID, nome: PROJETO_GRANDE_NOME, status: 'CONCLUIDO' }
const PROJETOS_CONCLUIDOS: Record<string, typeof PROJETO> = {
  [PROJETO_CONCLUIDO_ID]: PROJETO_CONCLUIDO, [PROJETO_GRANDE_ID]: PROJETO_GRANDE,
}

// RDOs criados durante os testes ficam guardados aqui (id → objeto completo),
// pra o GET /api/app/rdos/[id] devolver o mesmo RDO que o POST acabou de criar.
const rdosCriados = new Map<string, any>()
let proximoNumero = 1
const rdosConcluido = new Map<string, any>()

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
  $transaction: async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(fakeDb)),
  $queryRaw: async () => [],
  $disconnect: async () => {},

  tenant: modelo({
    findUnique: async ({ where }: any) => [TENANT, TENANT2].find(t => t.id === where.id) ?? null,
    findMany: async ({ where, include }: any) =>
      TENANTS_ADMIN
        .filter(t => (!where?.plano || t.plano === where.plano) && (!where?.status || t.status === where.status))
        .map(t => comContagem(t, include)),
    count: async ({ where }: any = {}) =>
      TENANTS_ADMIN.filter(t => (!where?.plano || t.plano === where.plano) && (!where?.status || t.status === where.status)).length,
    // atualização em massa: aplica `data` nas empresas do plano e devolve quantas mudaram
    updateMany: async ({ where, data }: any) => {
      const alvo = TENANTS_ADMIN.filter(t => !where?.plano || t.plano === where.plano)
      for (const t of alvo) Object.assign(t, data)
      return { count: alvo.length }
    },
    groupBy: async ({ where }: any) => {
      const por: Record<string, number> = {}
      for (const t of TENANTS_ADMIN) if (!where?.status || t.status === where.status) por[t.plano] = (por[t.plano] ?? 0) + 1
      return Object.entries(por).map(([plano, _count]) => ({ plano, _count }))
    },
  }),

  planoConfig: modelo({
    findUnique: async ({ where }: any) => (where?.tipo ? PLANOS[where.tipo] ?? null : null),
    findMany: async () => Object.values(PLANOS),
    upsert: async ({ where, update, create }: any) => {
      PLANOS[where.tipo] = PLANOS[where.tipo] ? Object.assign(PLANOS[where.tipo], update) : { ...planoBase(where.tipo, 0, [3, 30, 2]), ...create }
      return PLANOS[where.tipo]
    },
  }),

  superAdmin: modelo({
    findUnique: async ({ where }: any) =>
      [SUPERADMIN].find(a => (where.email != null && a.email === where.email) || (where.id != null && a.id === where.id)) ?? null,
  }),

  usuario: modelo({
    // exige e-mail ou id (senão devolve nada, como antes); os demais campos do where restringem
    findFirst: async ({ where }: any) =>
      where && (where.email != null || where.id != null) ? USUARIOS.find(u => casaUsuario(u, where)) ?? null : null,
    findUnique: async ({ where, select }: any) => {
      const u = USUARIOS.find(u => u.id === where.id)
      return u ? pick(u, select) : null
    },
    findMany: async ({ where }: any = {}) => USUARIOS.filter(u => casaUsuario(u, where)),
    count: async ({ where }: any = {}) => USUARIOS.filter(u => casaUsuario(u, where)).length,
    update: async ({ where, data }: any) => {
      const u = USUARIOS.find(x => x.id === where?.id)
      return u ? Object.assign(u, data) : { ...ADMIN, ...data }
    },
    // atualização em massa (troca/redefinição de senha nas contas do e-mail)
    updateMany: async ({ where, data }: any) => {
      const alvo = USUARIOS.filter(u => casaUsuario(u, where))
      for (const u of alvo) Object.assign(u, data)
      return { count: alvo.length }
    },
    upsert: async ({ where, update, create }: any) => {
      const chave = where?.tenantId_email
      const existente = USUARIOS.find(u => u.tenantId === chave?.tenantId && u.email === chave?.email)
      if (existente) return Object.assign(existente, update)
      const tenant = [TENANT, TENANT2].find(t => t.id === create.tenantId) ?? TENANT
      const novo = { ...usuarioFake(`novo-${USUARIOS.length}`, create.nome, create.email, create.perfil, {}, { tenant, senha: create.senha }), ...create }
      USUARIOS.push(novo)
      return novo
    },
  }),

  convite: modelo({
    findUnique: async ({ where }: any) => CONVITES.find(c => c.token === where?.token) ?? null,
    update: async ({ where, data }: any) => {
      const c = CONVITES.find(x => x.id === where?.id)
      return c ? Object.assign(c, data) : data
    },
  }),

  logAuditoria: modelo({
    count: async () => 0,
    findFirst: async () => null,
    create: async ({ data }: any) => data,
  }),

  projeto: modelo({
    findFirst: async ({ where }: any) =>
      where?.id === PROJETO_ID ? PROJETO : PROJETOS_CONCLUIDOS[where?.id] ?? null,
    findMany: async () => [PROJETO],
    count: async () => 1,
  }),

  // Atividades (EAP) por projeto — usadas pra testar o cálculo de desvio:
  //   p1: duas atividades SEM datas (lista só de atividades) → sem cronograma
  //   p2: uma atividade COM datas já vencidas, 40% feita → atrasada
  atividade: modelo({
    findMany: async ({ where }: any) => {
      const projetoId = where?.etapa?.projetoId
      if (projetoId === PROJETO_ID) {
        return [
          { pctAcumulado: 50, dataInicio: null, dataFim: null },
          { pctAcumulado: 30, dataInicio: null, dataFim: null },
        ]
      }
      if (projetoId === PROJETO_CONCLUIDO_ID) {
        return [{ pctAcumulado: 40, dataInicio: new Date('2026-01-01'), dataFim: new Date('2026-02-01') }]
      }
      return []
    },
  }),

  // Projeto grande (p3) tem acesso RESTRITO: só o admin está liberado — os
  // demais usuários do tenant não enxergam nem editam nada dele. Exceção: o LEITOR
  // (sem nenhuma permissão global) recebe GERENCIAMENTO explícito só nesse projeto.
  projetoAcesso: modelo({
    findMany: async ({ where }: any) =>
      where?.projetoId === PROJETO_GRANDE_ID
        ? [
            { projetoId: PROJETO_GRANDE_ID, usuarioId: ADMIN.id, nivel: 'GERENCIAMENTO' },
            { projetoId: PROJETO_GRANDE_ID, usuarioId: LEITOR.id, nivel: 'GERENCIAMENTO' },
          ]
        : [],
  }),

  // Mídia dos RDOs do histórico (busca por id, já com o RDO dono — status/projeto)
  midia: modelo({
    findFirst: async ({ where }: any) => {
      for (const rdo of rdosConcluido.values()) {
        const m = rdo.midias.find((x: any) => x.id === where?.id)
        if (m) return { ...m, rdo: { projetoId: rdo.projetoId, status: rdo.status } }
      }
      return null
    },
    create: async ({ data }: any) => ({ id: 'midia-nova', ...data }),
  }),

  // Mão de obra / equipamento / atividade de um RDO — o POST de criação (ver
  // app/api/app/rdos/route.ts) grava aqui a cópia do RDO anterior. Sem isso,
  // o teste de regressão da cópia não teria como enxergar o resultado (a
  // resposta do POST vem do rdo.findUnique logo em seguida, que devolve o
  // registro salvo em rdosCriados/rdosConcluido).
  maoDeObra: modelo({
    create: async ({ data }: any) => {
      const rdo = rdosCriados.get(data.rdoId) ?? rdosConcluido.get(data.rdoId)
      const item = { id: `mo-fake-${Math.random().toString(36).slice(2, 8)}`, ...data }
      if (rdo) rdo.maoDeObra.push(item)
      return item
    },
  }),
  equipamentoUso: modelo({
    create: async ({ data }: any) => {
      const rdo = rdosCriados.get(data.rdoId) ?? rdosConcluido.get(data.rdoId)
      const item = { id: `eq-fake-${Math.random().toString(36).slice(2, 8)}`, ...data }
      if (rdo) rdo.equipamentos.push(item)
      return item
    },
  }),
  registroRdoAtividade: modelo({
    create: async ({ data }: any) => {
      const rdo = rdosCriados.get(data.rdoId) ?? rdosConcluido.get(data.rdoId)
      const item = { id: `ra-fake-${Math.random().toString(36).slice(2, 8)}`, atividade: null, ...data }
      if (rdo) rdo.atividadeRegistros.push(item)
      return item
    },
  }),

  rdo: modelo({
    findFirst: async ({ where, orderBy }: any) => {
      // GET /api/app/rdos/[id] — resposta completa de um RDO já criado
      if (where?.id && rdosCriados.has(where.id)) return rdosCriados.get(where.id)
      if (where?.id && rdosConcluido.has(where.id)) return rdosConcluido.get(where.id)
      // "próximo número" e "RDO anterior pra copiar" (POST /api/app/rdos) —
      // ambos buscam sem id: { where: { projetoId }, orderBy: { numero: 'desc' } }.
      // O mais recente do projeto, qualquer status (ver o bug real corrigido
      // em app/api/app/rdos/route.ts: não filtra mais por status aqui).
      if (where?.projetoId) {
        let todos = [...rdosCriados.values(), ...rdosConcluido.values()].filter((r) => r.projetoId === where.projetoId)
        if (where.status?.in) todos = todos.filter((r) => where.status.in.includes(r.status))
        if (orderBy?.numero === 'desc') todos.sort((a, b) => b.numero - a.numero)
        return todos[0] ?? null
      }
      return null
    },
    findMany: async ({ where, take }: any) => {
      const projetoId = where?.projetoId ?? where?.projeto?.id
      if (projetoId in PROJETOS_CONCLUIDOS) return [...rdosConcluido.values()].filter(r => r.projetoId === projetoId)
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
    findUnique: async ({ where }: any) => rdosCriados.get(where.id) ?? rdosConcluido.get(where.id) ?? null,
  }),

  // A criação de RDO roda dentro de $transaction — implementado fora do
  // `modelo()` acima porque precisa persistir estado entre a chamada de
  // criação e o findUnique/findFirst subsequentes na mesma request.
}

function montarRdo({ id, numero, projeto, dataRdo, status, midias = [] }: {
  id: string; numero: number; projeto: typeof PROJETO; dataRdo: Date; status: string; midias?: any[]
}) {
  return {
    id, projetoId: projeto.id, numero, data: dataRdo, status,
    emissorId: ADMIN.id, emissor: { id: ADMIN.id, nome: ADMIN.nome },
    horaInicio: null, horaTermino: null, intervaloHoras: null, totalHoras: null,
    climaManha: null, climaTarde: null, climaNoite: null, precipitacaoMm: null, climaImpacto: 'NENHUM',
    observacoes: null, enviadoEm: null, criadoEm: AGORA, atualizadoEm: AGORA,
    projeto: {
      id: projeto.id, nome: projeto.nome,
      dataInicioContrato: projeto.dataInicioContrato, dataFimContrato: projeto.dataFimContrato,
      pedidoCompraContrato: projeto.pedidoCompraContrato, empresaContratada: projeto.empresaContratada,
      assinaturaModo: projeto.assinaturaModo, assinante1: null, assinante2: null, assinante3: null,
    },
    atividadeRegistros: [], maoDeObra: [], equipamentos: [],
    ocorrencias: [], midias, comentarios: [], assinaturas: [], aprovacoes: [],
    _count: { midias: midias.length, comentarios: 0, ocorrencias: 0 },
  }
}

const rdoCreate = async ({ data }: any) => {
  const id = `rdo-teste-${proximoNumero}`
  const numero = proximoNumero++
  const criado = {
    ...montarRdo({ id, numero, projeto: PROJETO, dataRdo: data.data ?? AGORA, status: data.status ?? 'RASCUNHO' }),
    horaInicio: data.horaInicio ?? null, horaTermino: data.horaTermino ?? null,
    intervaloHoras: data.intervaloHoras ?? null, totalHoras: data.totalHoras ?? null,
  }
  rdosCriados.set(id, criado)
  return { id, numero }
}

// Histórico do projeto concluído: 3 RDOs em 2 dias (+1 rascunho). O mesmo
// nome de arquivo aparece em dois dias diferentes (cada um vai pra sua pasta)
// e uma das mídias aponta pra uma URL que o teste faz devolver 404.
const midia = (id: string, rdoId: string, tipo: string, nomeArq: string) =>
  ({ id, rdoId, tipo, nomeArq, url: `${STORAGE_FAKE}/${nomeArq}`, descricao: null, ordem: 0, tamanhoBytes: 10 })
for (const r of [
  montarRdo({ id: 'rc1', numero: 1, projeto: PROJETO_CONCLUIDO, dataRdo: new Date('2026-08-10'), status: 'APROVADO',
    midias: [midia('m1', 'rc1', 'FOTO', 'foto.png'), midia('m2', 'rc1', 'ARQUIVO', 'laudo.txt')] }),
  montarRdo({ id: 'rc2', numero: 2, projeto: PROJETO_CONCLUIDO, dataRdo: new Date('2026-08-11'), status: 'APROVADO',
    midias: [midia('m3', 'rc2', 'FOTO', 'foto.png'), midia('m4', 'rc2', 'VIDEO', 'quebrado.mp4')] }),
  montarRdo({ id: 'rc3', numero: 3, projeto: PROJETO_CONCLUIDO, dataRdo: new Date('2026-08-12'), status: 'RASCUNHO' }),
  montarRdo({ id: 'rg1', numero: 1, projeto: PROJETO_GRANDE, dataRdo: new Date('2026-08-20'), status: 'APROVADO',
    midias: [1, 2, 3, 4, 5, 6, 7].map(n => midia(`mg${n}`, 'rg1', 'FOTO', `f${n}.png`)) }),
]) rdosConcluido.set(r.id, r)

// RDO anterior do projeto p1, com horários/mão de obra/equipamento/atividade
// avulsa preenchidos, em RASCUNHO (o cenário do bug real: o último RDO do
// projeto ainda não tinha sido enviado pra aprovação, e a cópia não achava
// nada). Número bem alto pra continuar sendo "o mais recente" (orderBy numero
// desc) mesmo depois de outros testes criarem RDOs novos em p1 durante a suíte.
export const RDO_ANTERIOR_ID = 'rdo-anterior-fixture'
const rdoAnteriorFixture = {
  ...montarRdo({ id: RDO_ANTERIOR_ID, numero: 900, projeto: PROJETO, dataRdo: new Date('2026-09-01'), status: 'RASCUNHO' }),
  horaInicio: '07:00', horaTermino: '17:00', intervaloHoras: 1, totalHoras: 9,
  // categoria INDIRETA de propósito: é o valor que o bug real trocava por
  // DIRETA ao copiar (o schema tem @default(DIRETA) na coluna, e o create da
  // cópia esquecia de mandar o campo) — DIRETA já era o padrão do banco, não
  // pegaria essa regressão.
  maoDeObra: [{ id: 'mo-fixture', funcaoNome: 'Mestre de obras', categoria: 'INDIRETA', quantidade: 3, horaEntrada: '07:00', horaSaida: '17:00', totalHH: 27 }],
  equipamentos: [{ id: 'eq-fixture', equipamentoNome: 'Betoneira', quantidade: 1, observacao: null }],
  // avulsa (sem atividadeId/etapa da EAP) — não depende do fixture de atividades
  atividadeRegistros: [{ id: 'ra-fixture', atividadeId: null, pctAnterior: 20, pctAtual: 40, deltaHoje: 20, avulsa: true, avulsaEtapa: '1.0', avulsaNome: 'Serviço avulso', atividade: null }],
}
rdosCriados.set(RDO_ANTERIOR_ID, rdoAnteriorFixture)

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
