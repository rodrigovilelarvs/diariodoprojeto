// Define o ambiente do cliente de e-mail (Resend) para os testes. Precisa ser
// importado ANTES de lib/email: o cliente lê essas variáveis quando o módulo carrega.
// (Fica num arquivo à parte porque imports estáticos são executados em ordem,
// e import() dinâmico de arquivo .ts falha no Node 20 usado pelo CI.)
process.env.RESEND_API_KEY ??= 're_chave_de_teste'
process.env.RESEND_BASE_URL = 'http://127.0.0.1:3199'

export {}
