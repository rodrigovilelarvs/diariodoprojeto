// lib/email.ts
// Serviço de e-mails via Resend — todos os templates do sistema

import { Resend } from 'resend'
import { fmtData } from '@/lib/format'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM ?? 'Diário do Projeto <noreply@diariodoprojeto.com.br>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── Cores do design ──────────────────────────────────────
const C = {
  bg:    '#0F1117',
  card:  '#1C2333',
  bord:  '#2A3547',
  ta:    '#29B6D8',
  tsu:   '#4CAF7D',
  tw:    '#E6A817',
  td:    '#E05C5C',
  tp:    '#E8EAF0',
  ts:    '#8B95A8',
}

// ── Layout base HTML ─────────────────────────────────────
function layout(conteudo: string, titulo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${C.card};border:1px solid ${C.bord};border-radius:12px 12px 0 0;padding:24px 28px;border-bottom:none;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:4px;height:32px;background:${C.ta};border-radius:2px;display:inline-block;vertical-align:middle;"></div>
            <span style="font-size:13px;font-weight:700;color:${C.ta};letter-spacing:.08em;vertical-align:middle;">
              DIÁRIO DO PROJETO
            </span>
          </div>
          <div style="font-size:20px;font-weight:600;color:${C.tp};margin-top:10px;line-height:1.3;">
            ${titulo}
          </div>
        </td></tr>

        <!-- Conteúdo -->
        <tr><td style="background:${C.card};border:1px solid ${C.bord};border-top:none;border-bottom:none;padding:0 28px 24px;">
          ${conteudo}
        </td></tr>

        <!-- Rodapé -->
        <tr><td style="background:${C.bg};border:1px solid ${C.bord};border-top:none;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;">
          <p style="font-size:11px;color:${C.ts};margin:0;">
            © 2026 RVS Gestão de Projetos · Diário do Projeto
          </p>
          <p style="font-size:10px;color:#4A5568;margin:4px 0 0;">
            Você recebeu este e-mail porque possui acesso à plataforma.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Componentes HTML reutilizáveis ────────────────────────
function btn(texto: string, href: string, cor = C.ta): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}"
      style="display:inline-block;padding:12px 28px;background:${cor};border-radius:8px;
             color:#0F1117;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:.02em;">
      ${texto}
    </a>
  </div>`
}

function alerta(texto: string, cor = C.ta): string {
  return `<div style="background:${cor}18;border:.5px solid ${cor}60;border-radius:8px;
                      padding:12px 14px;margin:14px 0;font-size:12px;color:${C.tp};line-height:1.6;">
    ${texto}
  </div>`
}

function infoRow(label: string, valor: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:12px;color:${C.ts};border-bottom:1px solid ${C.bord};">${label}</td>
    <td style="padding:7px 0;font-size:12px;font-weight:500;color:${C.tp};text-align:right;border-bottom:1px solid ${C.bord};">${valor}</td>
  </tr>`
}

function tabela(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="border-collapse:collapse;margin:12px 0;">${rows}</table>`
}

function paragrafo(texto: string): string {
  return `<p style="font-size:13px;color:${C.ts};line-height:1.7;margin:12px 0;">${texto}</p>`
}

function divisor(): string {
  return `<div style="height:1px;background:${C.bord};margin:20px 0;"></div>`
}

// ════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════

// ── 1. Convite de usuário ────────────────────────────────
export async function enviarConviteUsuario({
  email, nome, nomeEmpresa, perfil, token, expiradoEm,
}: {
  email:      string
  nome?:      string
  nomeEmpresa: string
  perfil:     string
  token:      string
  expiradoEm: Date
}) {
  const link = `${APP_URL}/convite/${token}`
  const exp  = expiradoEm.toLocaleDateString('pt-BR')

  const perfilL: Record<string,string> = {
    ADMIN: 'Administrador', PERSONALIZADO: 'Personalizado',
  }

  const html = layout(`
    ${paragrafo(`${nome ? `Olá, <strong style="color:${C.tp}">${nome}</strong>! ` : ''}Você foi convidado para acessar a plataforma <strong style="color:${C.ta}">Diário do Projeto</strong> como membro de <strong style="color:${C.tp}">${nomeEmpresa}</strong>.`)}
    ${tabela(
      infoRow('Empresa', nomeEmpresa) +
      infoRow('Perfil de acesso', perfilL[perfil] ?? perfil) +
      infoRow('Convite expira em', exp)
    )}
    ${alerta('Clique no botão abaixo para criar sua senha e acessar a plataforma.')}
    ${btn('Aceitar convite e criar senha', link, C.ta)}
    ${divisor()}
    ${paragrafo(`Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="font-size:11px;color:${C.ta};word-break:break-all;">${link}</span>`)}
    ${paragrafo(`Este convite expira em <strong>${exp}</strong>. Caso não queira acessar, ignore este e-mail.`)}
  `, `Convite para ${nomeEmpresa}`)

  return resend.emails.send({
    from: FROM, to: email,
    subject: `Convite para o Diário do Projeto — ${nomeEmpresa}`,
    html,
  })
}

// ── 2. Boas-vindas nova empresa (admin) ──────────────────
export async function enviarBoasVindasEmpresa({
  email, nomeAdmin, nomeEmpresa, plano, precoMensal, token,
}: {
  email:       string
  nomeAdmin:   string
  nomeEmpresa: string
  plano:       string
  precoMensal?: number // preço atual do plano escolhido (vem do PlanoConfig)
  token:       string
}) {
  const link = `${APP_URL}/convite/${token}`
  const precoPro = precoMensal != null && precoMensal > 0
    ? `R$ ${precoMensal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/mês`
    : null
  const planoL: Record<string,string> = {
    STARTER:'Starter (Grátis)', PRO: precoPro ? `Pro (${precoPro})` : 'Pro', ENTERPRISE:'Enterprise',
  }

  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nomeAdmin}</strong>! A empresa <strong style="color:${C.ta}">${nomeEmpresa}</strong> foi cadastrada na plataforma Diário do Projeto.`)}
    ${tabela(
      infoRow('Empresa', nomeEmpresa) +
      infoRow('Plano', planoL[plano] ?? plano) +
      infoRow('Seu perfil', 'Administrador')
    )}
    ${alerta(`🎉 Sua conta está pronta! Clique abaixo para criar sua senha e começar a usar.`, C.tsu)}
    ${btn('Acessar minha conta', link, C.tsu)}
    ${divisor()}
    ${paragrafo('Após o primeiro acesso você poderá:<br/>• Criar projetos e convidar sua equipe<br/>• Emitir os primeiros RDOs<br/>• Configurar o fluxo de aprovação')}
    ${paragrafo(`Dúvidas? Responda este e-mail e nossa equipe te ajuda.`)}
  `, `Bem-vindo ao Diário do Projeto`)

  return resend.emails.send({
    from: FROM, to: email,
    subject: `Bem-vindo ao Diário do Projeto — ${nomeEmpresa}`,
    html,
  })
}

// ── 3. Empresa ativada ────────────────────────────────────
export async function enviarEmpresaAtivada({
  email, nomeAdmin, nomeEmpresa,
}: {
  email:       string
  nomeAdmin:   string
  nomeEmpresa: string
}) {
  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nomeAdmin}</strong>!`)}
    ${alerta(`✔ A empresa <strong>${nomeEmpresa}</strong> foi ativada com sucesso. Você já pode acessar a plataforma.`, C.tsu)}
    ${btn('Acessar agora', `${APP_URL}/login`, C.tsu)}
    ${divisor()}
    ${paragrafo('Se tiver qualquer dúvida, entre em contato com nosso suporte respondendo este e-mail.')}
  `, 'Empresa ativada!')

  return resend.emails.send({
    from: FROM, to: email,
    subject: `✔ ${nomeEmpresa} ativada no Diário do Projeto`,
    html,
  })
}

// ── 4. Empresa suspensa ───────────────────────────────────
export async function enviarEmpresaSuspensa({
  email, nomeAdmin, nomeEmpresa, motivo,
}: {
  email:       string
  nomeAdmin:   string
  nomeEmpresa: string
  motivo?:     string
}) {
  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nomeAdmin}</strong>,`)}
    ${alerta(`⚠ O acesso da empresa <strong>${nomeEmpresa}</strong> foi suspenso temporariamente.${motivo ? `<br/><br/><strong>Motivo:</strong> ${motivo}` : ''}`, C.tw)}
    ${paragrafo('Para reativar o acesso, entre em contato com nosso suporte.')}
    ${btn('Falar com suporte', `mailto:suporte@diariodoprojeto.com.br`, C.tw)}
  `, 'Acesso suspenso')

  return resend.emails.send({
    from: FROM, to: email,
    subject: `⚠ Acesso suspenso — ${nomeEmpresa}`,
    html,
  })
}

// ── 5. RDO enviado para aprovação ─────────────────────────
export async function enviarRdoParaAprovacao({
  aprovadores, rdo,
}: {
  aprovadores: Array<{ email: string; nome: string }>
  rdo: {
    numero:      number
    data:        string
    projeto:     string
    emissor:     string
    pctMedio:    number
    totalHH:     number
    link:        string
  }
}) {
  const data = fmtData(rdo.data, {
    weekday:'long', day:'2-digit', month:'long', year:'numeric',
  })

  const resultados = await Promise.allSettled(
    aprovadores.map(apr => {
      const html = layout(`
        ${paragrafo(`Olá, <strong style="color:${C.tp}">${apr.nome}</strong>! Um novo RDO aguarda sua aprovação e assinatura digital.`)}
        ${tabela(
          infoRow('RDO #', String(rdo.numero)) +
          infoRow('Projeto', rdo.projeto) +
          infoRow('Data', data) +
          infoRow('Emissor', rdo.emissor) +
          infoRow('Progresso médio', `${rdo.pctMedio}%`) +
          infoRow('H/H registradas', String(rdo.totalHH))
        )}
        ${alerta('Revise o registro e clique em <strong>Aprovar RDO</strong> para assinar digitalmente.')}
        ${btn('Revisar e aprovar RDO', rdo.link, C.tsu)}
        ${divisor()}
        ${paragrafo('Caso identifique alguma inconsistência, você pode solicitar revisão diretamente na plataforma.')}
      `, `RDO #${rdo.numero} aguarda sua aprovação`)

      return resend.emails.send({
        from: FROM, to: apr.email,
        subject: `📋 RDO #${rdo.numero} — ${rdo.projeto} aguarda sua aprovação`,
        html,
      })
    })
  )

  return resultados
}

// ── 6. RDO aprovado (notifica o emissor) ─────────────────
export async function enviarRdoAprovado({
  email, nomeEmissor, rdo,
}: {
  email:       string
  nomeEmissor: string
  rdo: {
    numero:   number
    projeto:  string
    data:     string
    link:     string
  }
}) {
  const data = fmtData(rdo.data)

  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nomeEmissor}</strong>!`)}
    ${alerta(`✔ O RDO <strong>#${rdo.numero}</strong> do projeto <strong>${rdo.projeto}</strong> foi totalmente aprovado e assinado por todos os responsáveis.`, C.tsu)}
    ${tabela(
      infoRow('RDO #', String(rdo.numero)) +
      infoRow('Projeto', rdo.projeto) +
      infoRow('Data', data) +
      infoRow('Status', '✔ Aprovado')
    )}
    ${btn('Ver RDO aprovado', rdo.link, C.tsu)}
  `, `RDO #${rdo.numero} aprovado!`)

  return resend.emails.send({
    from: FROM, to: email,
    subject: `✔ RDO #${rdo.numero} aprovado — ${rdo.projeto}`,
    html,
  })
}

// ── 7. RDO rejeitado / revisão solicitada ─────────────────
export async function enviarRdoRejeitado({
  email, nomeEmissor, rdo, motivo, aprovadorNome,
}: {
  email:        string
  nomeEmissor:  string
  aprovadorNome: string
  motivo?:      string
  rdo: {
    numero:  number
    projeto: string
    data:    string
    link:    string
  }
}) {
  const data = fmtData(rdo.data)

  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nomeEmissor}</strong>,`)}
    ${alerta(`⚠ <strong>${aprovadorNome}</strong> solicitou revisão do RDO <strong>#${rdo.numero}</strong> · ${rdo.projeto}.${motivo ? `<br/><br/><strong>Comentário:</strong> "${motivo}"` : ''}`, C.tw)}
    ${tabela(
      infoRow('RDO #', String(rdo.numero)) +
      infoRow('Projeto', rdo.projeto) +
      infoRow('Data', data) +
      infoRow('Solicitado por', aprovadorNome)
    )}
    ${btn('Editar e reenviar RDO', rdo.link, C.tw)}
    ${divisor()}
    ${paragrafo('Acesse o RDO, faça as correções necessárias e envie novamente para aprovação.')}
  `, `Revisão solicitada — RDO #${rdo.numero}`)

  return resend.emails.send({
    from: FROM, to: email,
    subject: `⚠ Revisão solicitada no RDO #${rdo.numero} — ${rdo.projeto}`,
    html,
  })
}

// ── 7.1 Novo comentário no RDO (fora de uma rejeição formal) ──
export async function enviarComentarioRdo({
  destinatarios, autorNome, texto, rdo,
}: {
  destinatarios: Array<{ email: string; nome: string }>
  autorNome:     string
  texto:         string
  rdo: {
    numero:  number
    projeto: string
    link:    string
  }
}) {
  const resultados = await Promise.allSettled(
    destinatarios.map(dest => {
      const html = layout(`
        ${paragrafo(`Olá, <strong style="color:${C.tp}">${dest.nome}</strong>,`)}
        ${alerta(`💬 <strong>${autorNome}</strong> comentou no RDO <strong>#${rdo.numero}</strong> · ${rdo.projeto}.<br/><br/>"${texto}"`, C.ta)}
        ${btn('Ver comentário', rdo.link, C.ta)}
      `, `Novo comentário — RDO #${rdo.numero}`)

      return resend.emails.send({
        from: FROM, to: dest.email,
        subject: `💬 ${autorNome} comentou no RDO #${rdo.numero} — ${rdo.projeto}`,
        html,
      })
    })
  )

  return resultados
}

// ── 8. Lembrete diário (RDO não emitido no dia anterior) ──
export async function enviarLembreteDiario({
  destinatarios, projeto, data,
}: {
  destinatarios: Array<{ email: string; nome: string }>
  projeto:       string
  data:          Date   // dia que ficou sem RDO (normalmente ontem)
}) {
  const dataFormatada = fmtData(data, { weekday:'long', day:'2-digit', month:'long' })
  const dataCurta = fmtData(data)

  const resultados = await Promise.allSettled(
    destinatarios.map(dest => {
      const html = layout(`
        ${paragrafo(`Olá, <strong style="color:${C.tp}">${dest.nome}</strong>!`)}
        ${alerta(`🕐 Lembrete: o RDO de <strong>${dataFormatada}</strong> do projeto <strong>${projeto}</strong> não foi emitido.`, C.tw)}
        ${paragrafo('Regularize o quanto antes para manter o histórico do projeto atualizado.')}
        ${btn('Emitir RDO pendente', `${APP_URL}/rdos/novo`, C.ta)}
      `, 'Lembrete: RDO pendente')

      return resend.emails.send({
        from: FROM, to: dest.email,
        subject: `🕐 RDO de ${dataCurta} não foi emitido — ${projeto}`,
        html,
      })
    })
  )

  return resultados
}

// ── 8.1 Contrato do projeto vencendo em breve ──────────────
export async function enviarContratoVencendo({
  destinatarios, projeto, dataFim, diasRestantes,
}: {
  destinatarios: Array<{ email: string; nome: string }>
  projeto:       string
  dataFim:       Date
  diasRestantes: number
}) {
  const dataFormatada = fmtData(dataFim, { weekday:'long', day:'2-digit', month:'long', year:'numeric' })

  const resultados = await Promise.allSettled(
    destinatarios.map(dest => {
      const html = layout(`
        ${paragrafo(`Olá, <strong style="color:${C.tp}">${dest.nome}</strong>!`)}
        ${alerta(`📅 O contrato do projeto <strong>${projeto}</strong> vence em <strong>${diasRestantes} dias</strong> (${dataFormatada}).`, C.tw)}
        ${paragrafo('Verifique se é necessário renovar o contrato ou atualizar o prazo cadastrado no projeto.')}
        ${btn('Ver projeto', `${APP_URL}/painel`, C.ta)}
      `, 'Contrato de projeto vencendo')

      return resend.emails.send({
        from: FROM, to: dest.email,
        subject: `📅 Contrato de "${projeto}" vence em ${diasRestantes} dias`,
        html,
      })
    })
  )

  return resultados
}

// ── 8.2 Convites parados (não aceitos depois de alguns dias) ──
export async function enviarConvitePendente({
  destinatarios, convites,
}: {
  destinatarios: Array<{ email: string; nome: string }>
  convites:      Array<{ email: string; diasPendente: number }>
}) {
  const linhas = convites
    .map(c => infoRow(c.email, `${c.diasPendente} dia${c.diasPendente === 1 ? '' : 's'} sem aceite`))
    .join('')

  const resultados = await Promise.allSettled(
    destinatarios.map(dest => {
      const html = layout(`
        ${paragrafo(`Olá, <strong style="color:${C.tp}">${dest.nome}</strong>!`)}
        ${alerta(`✉️ ${convites.length === 1 ? 'Um convite enviado ainda não foi aceito' : `${convites.length} convites enviados ainda não foram aceitos`}.`, C.tw)}
        ${tabela(linhas)}
        ${paragrafo('Reenvie o convite ou cancele-o se não for mais necessário.')}
        ${btn('Ver convites pendentes', `${APP_URL}/usuarios`, C.ta)}
      `, 'Convites aguardando aceite')

      return resend.emails.send({
        from: FROM, to: dest.email,
        subject: convites.length === 1
          ? `✉️ Convite para ${convites[0].email} ainda não foi aceito`
          : `✉️ ${convites.length} convites aguardando aceite`,
        html,
      })
    })
  )

  return resultados
}

// ── 8.3 Resumo diário (modo "1 e-mail por dia" em vez de imediato) ──
export async function enviarResumoDiario({
  destinatario, itens,
}: {
  destinatario: { email: string; nome: string }
  itens:        Array<{ titulo: string; resumo: string; link?: string }>
}) {
  const blocos = itens.map(it => `
    <div style="padding:12px 0;border-bottom:1px solid ${C.bord};">
      <div style="font-size:13px;font-weight:600;color:${C.tp};margin-bottom:4px;">${it.titulo}</div>
      <div style="font-size:12px;color:${C.ts};line-height:1.6;">${it.resumo}</div>
      ${it.link ? `<a href="${it.link}" style="font-size:12px;color:${C.ta};text-decoration:none;">Ver detalhes →</a>` : ''}
    </div>
  `).join('')

  const plural = itens.length === 1 ? 'notificação' : 'notificações'
  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${destinatario.nome}</strong>! Você está no modo de resumo diário — aqui está tudo que aconteceu hoje:`)}
    ${blocos}
  `, `Resumo do dia — ${itens.length} ${plural}`)

  return resend.emails.send({
    from: FROM, to: destinatario.email,
    subject: `📋 Resumo do dia — ${itens.length} ${plural}`,
    html,
  })
}

// ── 9. Recuperação de senha ───────────────────────────────
export async function enviarRecuperacaoSenha({
  email, nome, token,
}: {
  email: string
  nome:  string
  token: string
}) {
  const link = `${APP_URL}/recuperar-senha/${token}`

  const html = layout(`
    ${paragrafo(`Olá, <strong style="color:${C.tp}">${nome}</strong>!`)}
    ${paragrafo('Recebemos uma solicitação para redefinir a senha da sua conta no Diário do Projeto.')}
    ${btn('Redefinir minha senha', link, C.ta)}
    ${divisor()}
    ${paragrafo(`Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="font-size:11px;color:${C.ta};word-break:break-all;">${link}</span>`)}
    ${alerta('Este link expira em 1 hora. Se você não solicitou a redefinição, pode ignorar este e-mail com segurança — sua senha atual continua válida.', C.tw)}
  `, 'Redefinição de senha')

  return resend.emails.send({
    from: FROM, to: email,
    subject: '🔒 Redefinição de senha — Diário do Projeto',
    html,
  })
}

// ── Helper: envio seguro (nunca quebra o request) ─────────
export async function enviarEmailSeguro(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.error('[EMAIL ERROR]', err)
    // Nunca propaga — e-mail falho não deve quebrar a requisição principal
  }
}
