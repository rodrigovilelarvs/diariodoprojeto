'use client'
// src/app/page.tsx
// Página inicial pública do site — antes disso a raiz só redirecionava pro
// painel (que exige login); como o app agora já está em uso real e vai
// ganhar mais gente de fora olhando, faz sentido ter uma tela de
// apresentação de verdade antes do login.

import Link from 'next/link'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

// Fecha a gaveta do menu mobile ao tocar num link — igual ao menu do app
// logado (ver fecharMenuMobile em components/layout/Sidebar.tsx), senão a
// gaveta fica aberta por cima do conteúdo pro qual acabou de navegar.
function fecharMenuMobile() {
  const cb = document.getElementById('ldg-nav-toggle') as HTMLInputElement | null
  if (cb) cb.checked = false
}

const RECURSOS: Array<{ icon: string; titulo: string; desc: string }> = [
  { icon: 'ti-file-text',           titulo: 'RDO digital completo',            desc: 'Mão de obra, equipamentos, clima, atividades e ocorrências — tudo em um só registro diário, sem planilha solta.' },
  { icon: 'ti-writing',             titulo: 'Assinatura digital, Lei 14.063',  desc: 'Assinatura aberta a todo o time ou por responsáveis definidos, com validade jurídica — sem papel, sem carimbo.' },
  { icon: 'ti-checklist',           titulo: 'Fluxo de aprovação configurável', desc: 'Defina quem aprova cada projeto, acompanhe pendências e corte o vai-e-volta por e-mail.' },
  { icon: 'ti-chart-bar',           titulo: 'Relatórios e dashboards',        desc: 'Desvio planejado × realizado, H/H por categoria, status dos RDOs e ocorrências, sempre atualizados.' },
  { icon: 'ti-users',               titulo: 'Equipe com permissão sob medida', desc: 'Administrador ou perfil personalizado, pessoa por pessoa — e acesso por projeto quando precisar restringir.' },
  { icon: 'ti-device-mobile',       titulo: 'Pensado pro celular da obra',    desc: 'Interface 100% responsiva — quem está no canteiro registra do próprio celular, sem travar.' },
  { icon: 'ti-building-skyscraper', titulo: 'Multi-empresa, uma conta só',    desc: 'O mesmo e-mail acessa várias empresas sem misturar dados — troca em dois cliques.' },
  { icon: 'ti-shield-lock',         titulo: 'Segurança de verdade',           desc: 'Dados isolados por empresa a nível de banco, e-mails protegidos contra phishing, acesso auditado.' },
]

const PASSOS: Array<{ n: string; titulo: string; desc: string }> = [
  { n: '1', titulo: 'Registre o dia',        desc: 'Mão de obra, equipamentos, clima e atividades em minutos, direto do celular ou do escritório.' },
  { n: '2', titulo: 'Envie para aprovação',  desc: 'Fluxo configurável por projeto, com notificação de quem precisa agir.' },
  { n: '3', titulo: 'Colha as assinaturas',  desc: 'Responsáveis assinam digitalmente, com validade legal — sem imprimir nada.' },
  { n: '4', titulo: 'Acompanhe em relatórios', desc: 'Desvio, progresso e indicadores sempre atualizados, prontos pra exportar.' },
]

const PLANOS: Array<{
  tipo: string; resumo: string; destaque?: boolean
  itens: string[]
}> = [
  {
    tipo: 'Starter', resumo: 'Pra experimentar a plataforma sem compromisso.',
    itens: ['Até 3 usuários', 'Até 2 projetos', '30 RDOs por mês', 'Exportação em PDF'],
  },
  {
    tipo: 'Pro', resumo: 'Pra equipes que precisam de mais recursos.', destaque: true,
    itens: ['Até 10 usuários', 'Até 10 projetos', 'RDOs ilimitados', 'Relatórios e dashboards completos', 'Exportação em PDF'],
  },
  {
    tipo: 'Enterprise', resumo: 'Pra grandes empresas com necessidades específicas.',
    itens: ['Usuários ilimitados', 'Projetos ilimitados', 'RDOs ilimitados', 'Relatórios e dashboards completos', 'Acesso à API', 'Suporte dedicado'],
  },
]

export default function LandingPage() {
  // html/body globais ficam com overflow:hidden pro layout do app logado
  // (que rola por dentro, via .content) — como esta página não usa esse
  // shell, ela precisa da própria rolagem, senão trava sem dar scroll.
  return (
    <div style={{ background: 'var(--s0)', color: 'var(--tp)', height: '100dvh', overflowY: 'auto' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.31.0/tabler-icons.min.css" />

      {/* ── Nav ───────────────────────────────────────────── */}
      <input type="checkbox" id="ldg-nav-toggle" className="ldg-nav-toggle-input" />
      <header className="ldg-header">
        <div className="ldg-wrap ldg-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'var(--ta)', letterSpacing: '.02em' }}>
            <i className="ti ti-file-text" style={{ fontSize: 18 }} />
            DIÁRIO DO PROJETO
          </div>
          <nav className="ldg-nav-links">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
            <a href="#seguranca">Segurança</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <Link href="/login" className="ldg-btn ldg-btn-p" style={{ padding: '7px 16px', fontSize: 12.5 }}>
              Entrar
            </Link>
            <label htmlFor="ldg-nav-toggle" className="ldg-hamburger" aria-label="Abrir menu">
              <i className="ti ti-menu-2" />
            </label>
          </div>
        </div>
        <nav className="ldg-nav-mobile">
          <a href="#recursos" onClick={fecharMenuMobile}>Recursos</a>
          <a href="#como-funciona" onClick={fecharMenuMobile}>Como funciona</a>
          <a href="#planos" onClick={fecharMenuMobile}>Planos</a>
          <a href="#seguranca" onClick={fecharMenuMobile}>Segurança</a>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="ldg-wrap ldg-hero-grid" style={{ paddingTop: 64, paddingBottom: 56, display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 48, alignItems: 'center' }}>
        <div>
          <div className="ldg-badge">
            <i className="ti ti-certificate" />
            Conforme a Lei 14.063 — assinatura digital com validade jurídica
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, lineHeight: 1.15, margin: '16px 0 14px', letterSpacing: '-.02em' }}>
            O diário de obra que sua construtora <span style={{ color: 'var(--ta)' }}>leva a sério</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ts)', lineHeight: 1.65, maxWidth: 480, marginBottom: 26 }}>
            Registre o dia a dia da obra, colha assinaturas digitais, aprove em poucos cliques
            e acompanhe tudo em tempo real — do canteiro ao escritório, em qualquer celular.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/login" className="ldg-btn ldg-btn-p" style={{ padding: '11px 22px', fontSize: 13.5 }}>
              <i className="ti ti-login" /> Entrar na plataforma
            </Link>
            <a href="#planos" className="ldg-btn" style={{ padding: '11px 22px', fontSize: 13.5 }}>
              Ver planos
            </a>
          </div>
        </div>

        {/* Mini-replica do cartão de projeto da plataforma — não é print, é um
            resumo visual fiel ao que a tela real mostra (ver app/(app)/painel). */}
        <div className="ldg-mock">
          <div className="ldg-mock-top">
            <span className="ldg-mock-dot" /><span className="ldg-mock-dot" /><span className="ldg-mock-dot" />
            <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--tm)' }}>RDO #0042 · Obra Jardim das Flores</span>
          </div>
          <div className="ldg-mock-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tp)' }}>Progresso da obra</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--bgsu)', color: 'var(--tsu)', border: '.5px solid var(--tsu)', fontWeight: 600 }}>
                Em andamento
              </span>
            </div>
            {[
              { l: 'Planejado', v: 62, c: 'var(--tm)' },
              { l: 'Realizado', v: 58, c: 'var(--ta)' },
            ].map(b => (
              <div key={b.l} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ts)', marginBottom: 3 }}>
                  <span>{b.l}</span><span style={{ fontWeight: 600, color: b.c }}>{b.v}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--s1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${b.v}%`, height: '100%', background: b.c, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 14, marginTop: 16, paddingTop: 14, borderTop: '.5px solid var(--b)' }}>
              {[
                { i: 'ti-users', t: '12 pessoas' },
                { i: 'ti-tool', t: '4 equip.' },
                { i: 'ti-photo', t: '9 fotos' },
                { i: 'ti-writing', t: '3 assinaturas' },
              ].map(it => (
                <div key={it.t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--tm)' }}>
                  <i className={`ti ${it.i}`} style={{ color: 'var(--ta)', fontSize: 12 }} />{it.t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recursos ──────────────────────────────────────── */}
      <section id="recursos" className="ldg-wrap" style={{ padding: '48px 24px 56px' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
          <div className="ldg-eyebrow">Recursos</div>
          <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 10px' }}>Tudo que a gestão de obra precisa, num só lugar</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ts)', lineHeight: 1.6 }}>Sem planilha, sem papel perdido, sem WhatsApp como sistema de registro.</p>
        </div>
        <div className="ldg-features-grid">
          {RECURSOS.map(r => (
            <div key={r.titulo} className="ldg-card">
              <div className="ldg-icon-box"><i className={`ti ${r.icon}`} /></div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>{r.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.55 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como funciona ─────────────────────────────────── */}
      <section id="como-funciona" style={{ background: 'var(--s1)', borderTop: '.5px solid var(--b)', borderBottom: '.5px solid var(--b)' }}>
        <div className="ldg-wrap" style={{ padding: '56px 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
            <div className="ldg-eyebrow">Como funciona</div>
            <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 0' }}>Do canteiro ao relatório, em quatro passos</h2>
          </div>
          <div className="ldg-steps-grid">
            {PASSOS.map((p, i) => (
              <div key={p.n} style={{ position: 'relative' }}>
                <div className="ldg-step-n">{p.n}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, margin: '14px 0 5px' }}>{p.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.55 }}>{p.desc}</div>
                {i < PASSOS.length - 1 && <div className="ldg-step-line" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segurança ─────────────────────────────────────── */}
      <section id="seguranca" className="ldg-wrap ldg-seg-grid" style={{ padding: '56px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <div>
          <div className="ldg-eyebrow">Segurança</div>
          <h2 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 700, margin: '8px 0 14px' }}>Seus dados de obra, isolados e protegidos</h2>
          <p style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.65, marginBottom: 18 }}>
            Cada empresa enxerga só os próprios dados — o isolamento é garantido a nível de banco,
            não só na tela. E-mails transacionais escapam HTML pra evitar phishing, e todo acesso
            fica registrado em auditoria.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Row Level Security em todas as tabelas, por empresa',
              'Assinatura digital conforme a Lei 14.063/2020',
              'Senhas com hash, nunca em texto puro',
              'Log de auditoria por empresa',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--tp)' }}>
                <i className="ti ti-circle-check" style={{ color: 'var(--tsu)', fontSize: 15, flexShrink: 0 }} />{t}
              </div>
            ))}
          </div>
        </div>
        <div className="ldg-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <i className="ti ti-shield-lock" style={{ fontSize: 44, color: 'var(--ta)' }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>Lei 14.063</div>
          <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 4 }}>Assinatura eletrônica com validade jurídica</div>
        </div>
      </section>

      {/* ── Planos ────────────────────────────────────────── */}
      <section id="planos" style={{ background: 'var(--s1)', borderTop: '.5px solid var(--b)', borderBottom: '.5px solid var(--b)' }}>
        <div className="ldg-wrap" style={{ padding: '56px 24px' }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
            <div className="ldg-eyebrow">Planos</div>
            <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 10px' }}>Um plano pro tamanho da sua obra</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ts)' }}>Sem fidelidade. Fale com a gente pra achar o plano certo.</p>
          </div>
          <div className="ldg-pricing-grid">
            {PLANOS.map(p => (
              <div key={p.tipo} className="ldg-card ldg-plan" style={p.destaque ? { borderColor: 'var(--ta)', background: 'var(--bga)' } : undefined}>
                {p.destaque && <div className="ldg-plan-badge">Mais popular</div>}
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{p.tipo}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ts)', margin: '8px 0 18px', lineHeight: 1.5 }}>{p.resumo}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                  {p.itens.map(it => (
                    <div key={it} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--tp)' }}>
                      <i className="ti ti-check" style={{ color: 'var(--tsu)', fontSize: 14, marginTop: 1, flexShrink: 0 }} />{it}
                    </div>
                  ))}
                </div>
                <a href="mailto:suportediariodoprojeto@gmail.com"
                  className={`ldg-btn ${p.destaque ? 'ldg-btn-p' : ''}`}
                  style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 12.5 }}>
                  Falar com a gente
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────── */}
      <section className="ldg-wrap" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 700, marginBottom: 10 }}>Pronto para digitalizar o diário da sua obra?</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ts)', marginBottom: 22 }}>Fale com a gente ou entre direto se já tem uma conta.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" className="ldg-btn ldg-btn-p" style={{ padding: '11px 22px', fontSize: 13.5 }}>
            <i className="ti ti-login" /> Entrar na plataforma
          </Link>
          <a href="mailto:suportediariodoprojeto@gmail.com" className="ldg-btn" style={{ padding: '11px 22px', fontSize: 13.5 }}>
            <i className="ti ti-mail" /> suportediariodoprojeto@gmail.com
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{ borderTop: '.5px solid var(--b)' }}>
        <div className="ldg-wrap" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--ta)' }}>
            <i className="ti ti-file-text" />DIÁRIO DO PROJETO
          </div>
          <div style={{ fontSize: 11, color: 'var(--tm)' }}>© 2026 RVS Gestão de Projetos</div>
          <Link href="/login" style={{ fontSize: 11, color: 'var(--ts)', textDecoration: 'none' }}>Entrar →</Link>
        </div>
      </footer>
    </div>
  )
}
