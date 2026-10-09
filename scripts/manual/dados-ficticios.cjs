// Enriquecimento extra das respostas (tarefas, resumo do projeto, detalhe do RDO)
function foto(i) {
  const tons = [['#8ec5e8', '#e9f4fb'], ['#f2c48d', '#fbeedd'], ['#a9c9a0', '#eaf3e6'], ['#b7b0d8', '#efecf8']][i % 4]
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + tons[0] + '"/><stop offset="1" stop-color="' + tons[1] + '"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><rect y="196" width="320" height="44" fill="#9a8f80"/><g fill="#6b7280"><rect x="46" y="70" width="14" height="128"/><rect x="118" y="70" width="14" height="128"/><rect x="190" y="70" width="14" height="128"/><rect x="262" y="70" width="14" height="128"/><rect x="36" y="62" width="250" height="10"/><rect x="36" y="118" width="250" height="8" opacity=".8"/></g><g stroke="#f59e0b" stroke-width="5" fill="none"><path d="M232 196V40h70M232 40l-46 24"/><path d="M290 40v38" stroke-width="2"/></g></svg>'
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
function sig() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M18 70 C30 20 48 18 46 52 C45 78 60 30 78 40 C92 48 70 78 96 62 C116 50 118 34 134 52 C150 70 160 40 176 44 C196 50 190 74 214 58 C230 46 246 40 282 30" fill="none" stroke="#1a2a6c" stroke-width="3.2" stroke-linecap="round"/><path d="M20 82 C80 74 160 86 270 70" fill="none" stroke="#1a2a6c" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>'
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
const NOMES = ['laje-bloco-b-armacao', 'laje-bloco-b-concretagem', 'alvenaria-pav2', 'instalacoes-eletricas', 'canteiro-organizado', 'cura-da-laje']
const DESCR = ['Armação da laje', 'Concretagem em andamento', 'Alvenaria do 2º pavimento', 'Passagem de eletrodutos', 'Canteiro organizado', 'Início da cura']
const MIDIAS = NOMES.map((n, i) => ({ id: 'm' + i, tipo: 'FOTO', nomeArq: n + '.jpg', url: foto(i), descricao: DESCR[i], ordem: i }))

function rdoRico(base, o) {
  return {
    ...base, id: o.id, numero: o.numero, data: o.data, status: o.status,
    // o exemplo mostra um projeto do lado da contratada: a empresa informada é a contratante (cliente)
    projeto: { ...base.projeto, empresaTipo: 'CONTRATANTE', empresaContratada: 'Incorporadora Beta S.A.' },
    climaManha: 'SOL', climaTarde: 'NUBLADO', climaNoite: null, precipitacaoMm: 0, climaImpacto: 'NENHUM',
    horaInicio: '07:00', horaTermino: '17:00', intervaloHoras: 1, totalHoras: 9,
    observacoes: 'Concretagem da laje do bloco B concluída sem intercorrências. Cura iniciada às 16h; o turno seguinte deve manter a laje úmida.',
    emissor: { id: 'e', nome: 'Juliana Costa' },
    atividadeRegistros: [
      { id: 'r1', atividadeId: 'a1', pctAnterior: 48, pctAtual: 62, deltaHoje: 14, atividade: { id: 'a1', nome: 'Concretagem da laje', pctAcumulado: 62, status: 'EM_ANDAMENTO', etapa: { numero: '3.0', nome: 'Estrutura' }, numero: '3.1', etapaId: 'e3', registrosRdo: [] } },
      { id: 'r2', atividadeId: 'a2', pctAnterior: 30, pctAtual: 35, deltaHoje: 5, atividade: { id: 'a2', nome: 'Alvenaria de vedação', pctAcumulado: 35, status: 'EM_ANDAMENTO', etapa: { numero: '4.0', nome: 'Vedações' }, numero: '4.1', etapaId: 'e4', registrosRdo: [] } },
    ],
    maoDeObra: [
      { id: 'mo1', funcaoNome: 'Mestre de obras', categoria: 'INDIRETA', quantidade: 1, horaEntrada: '07:00', horaSaida: '17:00', totalHH: 9 },
      { id: 'mo2', funcaoNome: 'Pedreiro', categoria: 'DIRETA', quantidade: 6, horaEntrada: '07:00', horaSaida: '17:00', totalHH: 54 },
      { id: 'mo3', funcaoNome: 'Servente', categoria: 'DIRETA', quantidade: 4, horaEntrada: '07:00', horaSaida: '17:00', totalHH: 36 },
      { id: 'mo4', funcaoNome: 'Armador', categoria: 'DIRETA', quantidade: 3, horaEntrada: '07:00', horaSaida: '17:00', totalHH: 27 },
      { id: 'mo5', funcaoNome: 'Eletricista', categoria: 'TERCEIRIZADO', quantidade: 2, horaEntrada: '08:00', horaSaida: '17:00', totalHH: 16 },
    ],
    equipamentos: [
      { id: 'eq1', equipamentoNome: 'Betoneira 400L', quantidade: 1 },
      { id: 'eq2', equipamentoNome: 'Vibrador de concreto', quantidade: 2 },
      { id: 'eq3', equipamentoNome: 'Caminhão betoneira', quantidade: 1, observacao: 'Entrega às 09h30' },
    ],
    ocorrencias: [{ id: 'oc1', tipo: 'Atraso de material', horaInicio: '08:00', horaTermino: '09:30', duracaoMin: 90, descricao: 'Caminhão de concreto chegou 1h30 após o horário combinado.', responsavel: 'Fornecedor de concreto' }],
    midias: MIDIAS,
    comentarios: [{ id: 'c1', texto: 'Conferir a cura da laje amanhã cedo, por favor.', criadoEm: '2026-10-06T18:10:00.000Z', autor: { id: 'g', nome: 'Marina Souza' }, respostas: [{ id: 'c2', texto: 'Combinado, o encarregado já foi avisado.', criadoEm: '2026-10-06T18:42:00.000Z', autor: { id: 'e', nome: 'Juliana Costa' }, respostas: [] }] }],
    assinaturas: o.assinaturas || [], aprovacoes: [], _count: { midias: 6, comentarios: 2, ocorrencias: 1 },
  }
}

function tarefas() {
  const at = (id, n, nome, pct, ini, fim, st) => ({ id, etapaId: 'e', numero: n, nome, status: st, pctAcumulado: pct, dataInicio: ini + 'T00:00:00.000Z', dataFim: fim + 'T00:00:00.000Z', registrosRdo: [] })
  const etapas = [
    { id: 'e1', numero: '1.0', nome: 'Fundação', ordem: 0, atividades: [at('a11', '1.1', 'Escavação e locação', 100, '2026-06-01', '2026-06-20', 'CONCLUIDA'), at('a12', '1.2', 'Estacas e blocos', 100, '2026-06-21', '2026-07-30', 'CONCLUIDA')] },
    { id: 'e3', numero: '3.0', nome: 'Estrutura', ordem: 1, atividades: [at('a1', '3.1', 'Concretagem da laje', 62, '2026-09-01', '2026-10-30', 'EM_ANDAMENTO'), at('a31', '3.2', 'Armação de pilares', 85, '2026-08-20', '2026-10-15', 'EM_ANDAMENTO')] },
    { id: 'e4', numero: '4.0', nome: 'Vedações', ordem: 2, atividades: [at('a2', '4.1', 'Alvenaria de vedação', 35, '2026-09-15', '2026-12-10', 'EM_ANDAMENTO'), at('a41', '4.2', 'Instalações elétricas', 18, '2026-09-01', '2026-09-30', 'EM_ATRASO')] },
    { id: 'e5', numero: '5.0', nome: 'Acabamentos', ordem: 3, atividades: [at('a51', '5.1', 'Pintura interna', 0, '2027-01-05', '2027-03-20', 'NAO_INICIADA')] },
  ]
  return { etapas, kpis: { total: 7, nao: 1, andamento: 3, concluida: 2, atraso: 1, pctMedio: 57, pctPlanejado: 58 } }
}

// retorna novo body (string) ou null se a rota não é tratada aqui
function transformExtra(p, body, rdosVar) {
  if (p === '/api/app/empresa') {
    const j = JSON.parse(body)
    j.limites = { usuarios: 15, rdosMes: 0, projetos: 10 }; j.limiteUsuarios = 15; j.limiteProjetos = 10
    j.uso = { usuarios: 7, rdosMes: 48, projetos: 5 }
    Object.assign(j, { cnpj: '12.345.678/0001-90', setor: 'Construção civil', cidade: 'Vila Velha', uf: 'ES', contatoNome: 'Carlos Almeida', contatoEmail: 'carlos@horizonte.com.br', contatoTelefone: '(27) 99999-0000', plano: 'PRO', dataVencimentoPlano: '2026-11-10T00:00:00.000Z', ativadoEm: '2026-01-12T00:00:00.000Z', criadoEm: '2026-01-10T00:00:00.000Z' })
    j.planoConfig = { precoMensal: 100, precoAnual: 960, limiteUsuarios: 15, limiteRdosMes: 0, limiteProjetos: 10, temRelatorios: true, temExportPdf: true, temApi: false, temSuporteDedicado: false, descricao: null }
    return JSON.stringify(j)
  }
  if (p === '/api/app/usuarios') {
    const j = JSON.parse(body)
    if (j && j.uso) { j.uso = { atual: 7, limite: 15 } }
    return JSON.stringify(j)
  }
  if (p === '/api/app/assinatura') return JSON.stringify({ assinatura: { imagemUrl: sig(), atualizadoEm: '2026-09-20T12:00:00.000Z' } })
  if (/^\/api\/app\/projetos\/[^/]+\/acesso$/.test(p)) {
    const j = JSON.parse(body)
    j.acessos = [
      { id: 'ac1', usuarioId: 'u1', nivel: 'GERENCIAMENTO', usuario: { id: 'u1', nome: 'Marina Souza', email: 'marina@horizonte.com.br', perfil: 'PERSONALIZADO', status: 'ATIVO' } },
      { id: 'ac2', usuarioId: 'u2', nivel: 'EDITAR', usuario: { id: 'u2', nome: 'Juliana Costa', email: 'juliana@horizonte.com.br', perfil: 'PERSONALIZADO', status: 'ATIVO' } },
      { id: 'ac3', usuarioId: 'u3', nivel: 'VISUALIZAR', usuario: { id: 'u3', nome: 'Roberto Lima', email: 'roberto@horizonte.com.br', perfil: 'PERSONALIZADO', status: 'ATIVO' } },
    ]
    return JSON.stringify(j)
  }
  if (p === '/api/app/tarefas') return JSON.stringify(tarefas())
  if (/^\/api\/app\/projetos\/[^/]+\/resumo$/.test(p)) {
    const j = JSON.parse(body)
    j.projeto = { ...j.projeto, grupo: 'Residencial', fotoUrl: null, empresaTipo: 'CONTRATANTE', empresaContratada: 'Incorporadora Beta S.A.' }
    j.kpis = { totalRdos: 48, pctReal: 62, pctPlanejado: 58, desvio: 4, ocorrenciasAbertas: 2, totalHH: 9312 }
    j.rdosRecentes = rdosVar().slice(0, 5).map(r => ({ id: r.id, numero: r.numero, data: r.data, status: r.status, assinaturas: r.assinaturas, totalFotos: r._count.midias }))
    j.fotos = MIDIAS.map((m, i) => ({ id: m.id, url: m.url, nomeArq: m.nomeArq, descricao: m.descricao, rdoId: 'rx0', rdoNumero: 48 - (i % 3), rdoData: '2026-10-06T00:00:00.000Z' }))
    j.atividades = [{ id: 'x', nome: 'Concretagem da laje', pctAnterior: 48, pctAtual: 62, deltaHoje: 14, rdoId: 'rx0', rdoNumero: 48, rdoData: '2026-10-06T00:00:00.000Z' }]
    return JSON.stringify(j)
  }
  if (/^\/api\/app\/rdos\/[^/]+$/.test(p)) {
    const j = JSON.parse(body)
    if (j && j.projeto && !j.erro) {
      const id = p.split('/').pop()
      const pend = id === 'rx1'
      const num = id === 'rx0' ? 48 : id === 'rx1' ? 47 : j.numero
      const ass = pend ? [
        { id: 's1', status: 'PENDENTE', cargo: 'GERENTE', usuario: { id: 'g', nome: 'Marina Souza' } },
        { id: 's2', status: 'ASSINADO', cargo: 'FISCAL', assinadoEm: '2026-10-05T19:20:00.000Z', assinaturaDigital: { imagemUrl: sig() }, usuario: { id: 'f', nome: 'Roberto Lima' } },
      ] : []
      return JSON.stringify(rdoRico(j, { id, numero: num, data: pend ? '2026-10-05T00:00:00.000Z' : '2026-10-06T00:00:00.000Z', status: pend ? 'PENDENTE_APROVACAO' : 'RASCUNHO', assinaturas: ass }))
    }
  }
  return null
}

module.exports = { transformExtra }
