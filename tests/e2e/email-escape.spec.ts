import http from 'node:http'
import { test, expect } from '@playwright/test'

// Todo texto que vem de fora (nome de pessoa, empresa, projeto, comentário,
// motivo, link...) é escapado antes de entrar no HTML dos e-mails. Sem isso, um
// nome como <a href="https://site-falso">clique aqui</a> viraria um link dentro
// de um e-mail que parece oficial (phishing).
//
// Este teste chama CADA função de envio de lib/email.ts com um texto hostil em
// todos os campos e lê o e-mail que o Resend receberia (o SDK aponta pra um
// receptor local via RESEND_BASE_URL). Se um template novo esquecer de escapar
// algum campo, o teste falha.

// Precisam estar definidos ANTES de importar lib/email (o cliente do Resend lê no carregamento)
process.env.RESEND_API_KEY ??= 're_chave_de_teste'
process.env.RESEND_BASE_URL = 'http://127.0.0.1:3199'

const HOSTIL = `<img src=x onerror=alert(1)>"'&`
const HOSTIL_ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;'

type Email = { to: string | string[]; subject: string; html: string }
let recebidos: Email[] = []
let receptor: http.Server

test.beforeAll(async () => {
  receptor = http.createServer((req, res) => {
    let corpo = ''
    req.on('data', (parte) => { corpo += parte })
    req.on('end', () => {
      try { recebidos.push(JSON.parse(corpo)) } catch { /* não é e-mail */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: 'email-de-teste' }))
    })
  })
  await new Promise<void>((ok) => receptor.listen(3199, '127.0.0.1', ok))
})
test.afterAll(async () => { await new Promise<void>((ok) => receptor.close(() => ok())) })

const pessoa = { email: HOSTIL, nome: HOSTIL }
const rdoBase = { numero: 7, projeto: HOSTIL, data: '2026-09-01', link: `https://app.exemplo/rdos/1?x=${HOSTIL}` }

// Um chamador por template: todos os campos de texto recebem o texto hostil
// (menos números e datas). Ao criar um template novo, acrescente-o aqui.
const templates: Array<[string, (m: typeof import('../../lib/email')) => Promise<unknown>]> = [
  ['convite de usuário', m => m.enviarConviteUsuario({ email: HOSTIL, nome: HOSTIL, nomeEmpresa: HOSTIL, perfil: HOSTIL, token: HOSTIL, expiradoEm: new Date() })],
  ['aviso de conta criada', m => m.enviarContaCriada({ email: HOSTIL, nome: HOSTIL, nomeEmpresa: HOSTIL, perfil: HOSTIL, origem: 'empresa' })],
  ['boas-vindas da empresa', m => m.enviarBoasVindasEmpresa({ email: HOSTIL, nomeAdmin: HOSTIL, nomeEmpresa: HOSTIL, plano: HOSTIL, token: HOSTIL })],
  ['empresa ativada', m => m.enviarEmpresaAtivada({ email: HOSTIL, nomeAdmin: HOSTIL, nomeEmpresa: HOSTIL })],
  ['empresa suspensa', m => m.enviarEmpresaSuspensa({ email: HOSTIL, nomeAdmin: HOSTIL, nomeEmpresa: HOSTIL, motivo: HOSTIL })],
  ['RDO para aprovação', m => m.enviarRdoParaAprovacao({ aprovadores: [pessoa], rdo: { ...rdoBase, emissor: HOSTIL, pctMedio: 50, totalHH: 8 } })],
  ['RDO aprovado', m => m.enviarRdoAprovado({ email: HOSTIL, nomeEmissor: HOSTIL, rdo: rdoBase })],
  ['RDO rejeitado', m => m.enviarRdoRejeitado({ email: HOSTIL, nomeEmissor: HOSTIL, aprovadorNome: HOSTIL, motivo: HOSTIL, rdo: rdoBase })],
  ['comentário no RDO', m => m.enviarComentarioRdo({ destinatarios: [pessoa], autorNome: HOSTIL, texto: HOSTIL, rdo: { numero: 7, projeto: HOSTIL, link: rdoBase.link } })],
  ['lembrete diário', m => m.enviarLembreteDiario({ destinatarios: [pessoa], projeto: HOSTIL, data: new Date() })],
  ['contrato vencendo', m => m.enviarContratoVencendo({ destinatarios: [pessoa], projeto: HOSTIL, dataFim: new Date(), diasRestantes: 30 })],
  ['convites pendentes', m => m.enviarConvitePendente({ destinatarios: [pessoa], convites: [{ email: HOSTIL, diasPendente: 3 }] })],
  ['resumo diário', m => m.enviarResumoDiario({ destinatario: pessoa, itens: [{ titulo: HOSTIL, resumo: HOSTIL, link: `https://app.exemplo/x?a=${HOSTIL}` }] })],
  ['recuperação de senha', m => m.enviarRecuperacaoSenha({ email: HOSTIL, nome: HOSTIL, token: HOSTIL })],
]

for (const [nome, enviar] of templates) {
  test(`e-mail "${nome}" escapa o texto hostil`, async () => {
    const email = await import('../../lib/email')
    recebidos = []
    await enviar(email)
    expect(recebidos.length, 'o e-mail chegou ao receptor').toBeGreaterThan(0)

    for (const { html } of recebidos) {
      // nada do texto hostil pode virar HTML de verdade (tag nova nem quebra de atributo)
      expect(html).not.toMatch(/<img\b/i)
      expect(html).not.toContain(HOSTIL)
      // e o texto aparece, mas escapado (não foi simplesmente descartado)
      expect(html).toContain(HOSTIL_ESCAPADO)
    }
  })
}

test('o cabeçalho e o título do e-mail (layout) também escapam', async () => {
  const email = await import('../../lib/email')
  recebidos = []
  // o título do convite é montado com o nome da empresa
  await email.enviarConviteUsuario({ email: 'a@b.c', nomeEmpresa: HOSTIL, perfil: 'ADMIN', token: 't', expiradoEm: new Date() })
  const { html } = recebidos[0]
  expect(html).toContain(`<title>Convite para ${HOSTIL_ESCAPADO}</title>`)
})
