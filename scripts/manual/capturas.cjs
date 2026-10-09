// Gera as capturas de tela do manual com dados fictícios "bonitos":
// as respostas da API (banco falso) são reescritas em voo antes de chegar à página.
const { chromium } = require('@playwright/test')
const fs = require('fs')
const { transformExtra } = require('./dados-ficticios.cjs')
// Uso: node scripts/manual/capturas.cjs [pasta-de-saida] [nomes,separados,por,virgula]
// (veja scripts/manual/README.md — precisa do servidor com FAKE_DB=1 rodando)
const OUT = process.argv[2] || 'scripts/manual/.capturas'
const ONLY = process.argv[3] ? process.argv[3].split(',') : null
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.MANUAL_BASE_URL || 'http://localhost:3400'

const SUBST = [
  ['Obra Teste E2E', 'Residencial Jardim das Flores'],
  ['Obra Concluida E2E', 'Galpão Logístico Norte'],
  ['Obra Grande E2E', 'Ponte Rio Verde'],
  ['Empresa Teste', 'Construtora Horizonte'],
  ['Empresa Dois', 'Horizonte Reformas'],
  ['Rodrigo Vilela Santos', 'Carlos Almeida'],
  ['Gestor Do Projeto', 'Marina Souza'],
  ['Construtora Teste Ltda', 'Alfa Engenharia Ltda'],
  ['admin@teste.com', 'carlos@horizonte.com.br'],
  ['Leitor Sem Permissoes', 'Paulo Ramos'], ['leitor@teste.com', 'paulo@horizonte.com.br'],
  ['Emissor De RDO', 'Juliana Costa'],      ['emissor@teste.com', 'juliana@horizonte.com.br'],
  ['Gerente De Equipe', 'Roberto Lima'],    ['gerente@teste.com', 'roberto@horizonte.com.br'],
  ['Multi Empresa', 'Fernanda Dias'],       ['multi@teste.com', 'fernanda@horizonte.com.br'],
  ['Dono Da Conta', 'Ricardo Nunes'],       ['dono@teste.com', 'ricardo@horizonte.com.br'],
  ['Viajante', 'Camila Prado'],             ['viajante@teste.com', 'camila@horizonte.com.br'],
  ['Novato', 'Eduardo Pires'],              ['novato@teste.com', 'eduardo@horizonte.com.br'],
  ['Projeto fixo do banco falso de testes.', 'Edifício residencial de 12 pavimentos com 96 unidades.'],
  ['Contrato 001', 'Contrato 2026-014'],
  ['Etapa sem datas', 'Estrutura'],
  ['Atividade A', 'Concretagem da laje'],
  ['Atividade B', 'Alvenaria de vedação'],
  ['Serviço avulso', 'Limpeza e organização do canteiro'],
  ['Mestre de obras', 'Mestre de obras'],
]
function bonito(txt) { let t = txt; for (const [a, b] of SUBST) t = t.split(a).join(b); return t }

function projetoVar(base, i, o) {
  return { ...base, id: i === 0 ? 'p1' : 'px' + i, nome: o.nome, grupo: o.grupo, status: o.status, pctReal: o.real, pctPlanejado: o.plan, desvio: o.real - o.plan,
    gestor: { id: 'g' + i, nome: o.gestor }, cor: o.cor, _count: { rdos: o.rdos, etapas: 4 }, totalAtividades: o.ativ, totalOcorrencias: o.oc,
    totalComentarios: o.com, totalFotos: o.fotos, totalVideos: o.vid, ocorrenciasAbertas: o.oc > 2 ? 2 : 0 }
}
const PROJETOS = [
  { nome: 'Residencial Jardim das Flores', grupo: 'Residencial', status: 'ATIVO', real: 62, plan: 58, gestor: 'Marina Souza', cor: '#29B6D8', rdos: 48, ativ: 14, oc: 3, com: 21, fotos: 164, vid: 6 },
  { nome: 'Galpão Logístico Norte', grupo: 'Industrial', status: 'ATIVO', real: 35, plan: 44, gestor: 'Roberto Lima', cor: '#F59E0B', rdos: 31, ativ: 9, oc: 5, com: 12, fotos: 98, vid: 2 },
  { nome: 'Reforma Edifício Central', grupo: 'Reformas', status: 'ATIVO', real: 80, plan: 78, gestor: 'Marina Souza', cor: '#8E24AA', rdos: 57, ativ: 11, oc: 1, com: 30, fotos: 212, vid: 9 },
  { nome: 'Ponte Rio Verde', grupo: 'Infraestrutura', status: 'ATIVO', real: 18, plan: 20, gestor: 'Carlos Almeida', cor: '#4CAF7D', rdos: 12, ativ: 18, oc: 0, com: 4, fotos: 41, vid: 1 },
  { nome: 'Clínica São Lucas', grupo: 'Comercial', status: 'CONCLUIDO', real: 100, plan: 100, gestor: 'Roberto Lima', cor: '#E05C5C', rdos: 74, ativ: 16, oc: 0, com: 40, fotos: 301, vid: 12 },
]

function rdosVar() {
  const sts = ['RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADO', 'APROVADO', 'APROVADO', 'REJEITADO', 'APROVADO', 'APROVADO']
  const projs = [0, 0, 2, 1, 0, 3, 2, 1]
  const datas = ['2026-10-06', '2026-10-05', '2026-10-05', '2026-10-03', '2026-10-02', '2026-10-02', '2026-10-01', '2026-09-30']
  const num = [48, 47, 57, 31, 46, 12, 56, 30]
  return sts.map((s, i) => ({
    id: 'rx' + i, numero: num[i], data: datas[i] + 'T00:00:00.000Z', status: s, climaManha: i % 3 === 0 ? 'SOL' : 'NUBLADO',
    projeto: { id: 'px' + projs[i], nome: PROJETOS[projs[i]].nome, grupo: PROJETOS[projs[i]].grupo, gestor: { id: 'g', nome: PROJETOS[projs[i]].gestor } },
    emissor: { id: 'e', nome: ['Juliana Costa', 'Carlos Almeida', 'Roberto Lima'][i % 3] },
    assinaturas: s === 'APROVADO' ? [{ status: 'ASSINADO' }] : [{ status: 'PENDENTE' }],
    _count: { midias: 4 + i, comentarios: i % 3, ocorrencias: i % 2 },
  }))
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 })
  const prepare = async (ctx) => {
  await ctx.addInitScript(() => {
    try { localStorage.setItem('diario_tema', 'light') } catch {}
    const st = document.createElement('style')
    st.textContent = 'nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button],.tsqd-parent-container,.tsqd-open-btn-container{display:none!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st))
  })

  await ctx.route('**/api/**', async route => {
    const req = route.request()
    if (req.method() !== 'GET' && !req.url().includes('/api/auth/login')) return route.continue()
    const ehRx = /\/api\/app\/rdos\/rx\d/.test(req.url())
    const res = await route.fetch(ehRx ? { url: req.url().replace(/rdos\/rx\d+/, 'rdos/rdo-anterior-fixture') } : undefined)
    let body = await res.text()
    const url = new URL(req.url())
    const p = url.pathname
    try {
      if (p === '/api/app/projetos' && res.headers()['content-type']?.includes('json')) {
        const j = JSON.parse(body)
        const base = Array.isArray(j) ? j[0] : null
        if (base) body = JSON.stringify(PROJETOS.map((o, i) => projetoVar(base, i, o)))
      } else if (p === '/api/app/rdos') {
        const j = JSON.parse(body)
        let rows = rdosVar()
        const st = url.searchParams.get('status'); if (st) rows = rows.filter(r => r.status === st)
        if (url.searchParams.get('data')) rows = []
        body = JSON.stringify({ ...j, rdos: rows, total: rows.length })
      } else if (p === '/api/app/relatorios') {
        const j = JSON.parse(body)
        j.kpis = { ...j.kpis, totalRdos: 148, totalHH: 9312, aprovados: 112, pendentes: 9, rascunhos: 21, rejeitados: 6, desvioMedio: -3, taxaAprovacao: 76, ocorrenciasAbertas: 4, totalProjetos: 5, totalUsuarios: 12, totalFotos: 816, totalVideos: 30, totalAnexos: 22, armazenamentoBytes: 1.4 * 1024 ** 3 }
        j.progressoPorProjeto = PROJETOS.map((o, i) => ({ id: 'px' + i, nome: o.nome, cor: o.cor, pctReal: o.real, pctPlanejado: o.plan, desvio: o.real - o.plan, totalRdos: o.rdos }))
        j.rankingPiorDesvio = [...j.progressoPorProjeto].sort((a, b) => a.desvio - b.desvio).slice(0, 5)
        j.statusRdos = [{ status: 'RASCUNHO', total: 21 }, { status: 'PENDENTE_APROVACAO', total: 9 }, { status: 'APROVADO', total: 112 }, { status: 'REJEITADO', total: 6 }]
        j.ocorrenciasPorTipo = [{ tipo: 'Atraso de material', total: 9, horas: 14 }, { tipo: 'Condição climática', total: 7, horas: 22 }, { tipo: 'Falha de equipamento', total: 4, horas: 6 }, { tipo: 'Falta de mão de obra', total: 3, horas: 5 }]
        j.hhPorFuncao = [{ funcao: 'Pedreiro', totalHH: 2880 }, { funcao: 'Servente', totalHH: 2400 }, { funcao: 'Carpinteiro', totalHH: 1360 }, { funcao: 'Armador', totalHH: 1120 }, { funcao: 'Eletricista', totalHH: 760 }, { funcao: 'Mestre de obras', totalHH: 792 }]
        j.hhPorCategoria = [{ categoria: 'DIRETA', totalHH: 5120, totalPessoas: 34 }, { categoria: 'INDIRETA', totalHH: 1960, totalPessoas: 11 }, { categoria: 'TERCEIRIZADO', totalHH: 2232, totalPessoas: 15 }]
        j.tempoAprovacao = { mediaHoras: 9.5, amostra: 87, distribuicao: [{ faixa: 'Até 4h', total: 31 }, { faixa: '4h – 24h', total: 42 }, { faixa: '1 – 3 dias', total: 11 }, { faixa: 'Mais de 3 dias', total: 3 }] }
        const pts = []; for (let d = 0; d < 30; d++) { const dt = new Date('2026-09-07'); dt.setDate(dt.getDate() + d); pts.push({ data: dt.toISOString().slice(0, 10), total: [0, 6, 5, 5, 4, 6, 0][dt.getDay()] + (d % 4 === 0 ? 1 : 0) }) }
        j.rdosPorPeriodo = { agrupamento: 'dia', pontos: pts }
        body = JSON.stringify(j)
      }
      else { const x = transformExtra(p, body, rdosVar); if (x) body = x }
    } catch (e) { console.error('transform', p, e.message) }
    body = bonito(body)
    const headers = { ...res.headers() }; delete headers['content-length']; delete headers['content-encoding']
    await route.fulfill({ status: res.status(), headers, body })
  })

  }
  await prepare(ctx)

  const page = await ctx.newPage()
  const quer = (n) => !ONLY || ONLY.includes(n)
  const shot = async (n, opts = {}) => { await page.waitForTimeout(opts.wait ?? 1500); await page.screenshot({ path: `${OUT}/${n}.png`, ...opts.shot }); console.log('shot', n) }

  // ── Login ──
  await page.goto(BASE + '/login'); await page.waitForTimeout(800)
  if (quer('login')) { await page.getByPlaceholder('seu@email.com').fill('carlos@horizonte.com.br'); await shot('login') }
  await page.getByPlaceholder('seu@email.com').fill('admin@teste.com')
  await page.locator('input[type="password"]').fill('teste123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/painel', { timeout: 20000 })

  const esconderBanner = async (pg) => pg.evaluate(() => { const t = [...document.querySelectorAll('div')].find(d => d.textContent && d.textContent.startsWith('Dados do RDO anterior carregados') && d.children.length < 6); if (t) t.style.display = 'none' })
  const go = async (path, wait = 1800) => { await page.goto(BASE + path); await page.waitForTimeout(wait); if (path.startsWith('/rdos/rx') || path.startsWith('/aprovacao/')) await esconderBanner(page) }

  if (quer('painel')) { await go('/painel'); await shot('painel-lista') }
  if (quer('painel-cartoes')) { await go('/painel'); await page.getByTitle('Ver em cartões').click(); await shot('painel-cartoes') }
  if (quer('novo-projeto')) {
    await go('/painel'); await page.getByRole('button', { name: /Novo projeto/ }).click(); await page.waitForTimeout(700)
    await page.getByPlaceholder('Ex: Reforma Edifício Central').fill('Residencial Vista Verde')
    await page.getByPlaceholder(/Ex: PC-/).first().fill('Contrato 2026-021')
    await page.getByRole('radio', { name: 'Empresa contratante' }).click()
    await page.getByPlaceholder(/Nome da empresa contratante/).fill('Incorporadora Beta S.A.')
    await shot('novo-projeto')
  }
  if (quer('menu-acoes')) { await go('/painel'); await page.getByTitle('Mais ações').first().click(); await shot('menu-acoes', { wait: 700 }) }
  if (quer('projeto')) { await go('/projetos/p1'); await shot('projeto-visao-geral') }
  if (quer('acesso')) { await go('/projetos/p1/acesso'); await shot('projeto-acesso') }
  if (quer('assinaturas')) { await go('/projetos/p1/assinaturas'); await page.getByText('Pré-definida').click(); await shot('projeto-assinaturas', { wait: 700 }) }
  if (quer('lista-rdos')) { await go('/rdos'); await shot('lista-rdos') }
  if (quer('aprovacao-lista')) { await go('/rdos?status=PENDENTE_APROVACAO'); await shot('aprovacao-lista') }
  if (quer('relatorios')) { await go('/relatorios', 2500); await shot('relatorios') }
  if (quer('tarefas')) { await go('/tarefas'); await shot('tarefas') }
  if (quer('usuarios')) { await go('/usuarios'); await shot('usuarios') }
  if (quer('cadastro-usuario')) {
    await go('/usuarios'); await page.getByRole('button', { name: /Convidar usuário/ }).click(); await page.waitForTimeout(800)
    await shot('cadastro-usuario')
  }
  if (quer('perfil')) { await go('/perfil'); await shot('perfil') }
  if (quer('empresa')) { await go('/empresa'); await shot('empresa') }
  if (quer('notificacoes')) { await go('/notificacoes'); await shot('notificacoes') }
  if (quer('novo-rdo')) {
    await go('/rdos/novo'); await page.locator('select').first().selectOption({ index: 1 }).catch(() => {}); await shot('novo-rdo')
  }

  if (quer('rdo-form')) {
    await go('/rdos/rx0', 2600)
    await shot('rdo-form-topo', { wait: 300 })
    const sec = (t) => page.locator('.sec', { has: page.locator('.sec-title', { hasText: t }) }).first()
    const lista = { 'rdo-identificacao': 'Identificação', 'rdo-clima': 'Condições climáticas', 'rdo-atividades': 'Atividade, horários e progresso', 'rdo-mao-de-obra': 'Mão de obra', 'rdo-equipamentos': 'Equipamentos', 'rdo-ocorrencias': 'Ocorrências', 'rdo-midias': 'Fotos, vídeos e arquivos', 'rdo-comentarios': 'Comentários' }
    for (const [n, t] of Object.entries(lista)) {
      const el = sec(t)
      if (await el.count()) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await el.screenshot({ path: OUT + '/' + n + '.png' }); console.log('shot', n) } else console.log('FALTOU', n)
    }
    await page.locator('.content').evaluate(e => { e.scrollTop = e.scrollHeight }).catch(() => {})
    await page.waitForTimeout(700)
    await page.screenshot({ path: OUT + '/rdo-barra-acoes.png', clip: { x: 192, y: 740, width: 1174, height: 80 } }); console.log('shot rdo-barra-acoes')
  }
  if (quer('aprovacao')) {
    await go('/aprovacao/rx1', 2600)
    await shot('aprovacao-topo', { wait: 300 })
    const el = page.locator('.sec', { has: page.locator('.sec-title', { hasText: 'Assinaturas' }) }).first()
    if (await el.count()) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await el.screenshot({ path: OUT + '/aprovacao-assinaturas.png' }); console.log('shot aprovacao-assinaturas') }
  }
  if (quer('mobile')) {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await prepare(mctx)
    const m = await mctx.newPage()
    await m.goto(BASE + '/login'); await m.getByPlaceholder('seu@email.com').fill('admin@teste.com'); await m.locator('input[type="password"]').fill('teste123')
    await m.getByRole('button', { name: 'Entrar' }).click(); await m.waitForURL('**/painel'); await m.waitForTimeout(1200)
    await m.screenshot({ path: OUT + '/mobile-painel.png' }); console.log('shot mobile-painel')
    await m.goto(BASE + '/rdos/rx0'); await m.waitForTimeout(2600); await esconderBanner(m)
    await m.screenshot({ path: OUT + '/mobile-rdo-topo.png' }); console.log('shot mobile-rdo-topo')
    await m.locator('.content').evaluate(e => { e.scrollTop = 1500 }).catch(() => {}); await m.waitForTimeout(600)
    await m.screenshot({ path: OUT + '/mobile-rdo-meio.png' }); console.log('shot mobile-rdo-meio')
    await mctx.close()
  }
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
