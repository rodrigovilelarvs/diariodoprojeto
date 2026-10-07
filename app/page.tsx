'use client'
// src/app/page.tsx
// Página inicial pública do site — antes disso a raiz só redirecionava pro
// painel (que exige login); como o app agora já está em uso real e vai
// ganhar mais gente de fora olhando, faz sentido ter uma tela de
// apresentação de verdade antes do login.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

// Fecha a gaveta do menu mobile ao tocar num link — igual ao menu do app
// logado (ver fecharMenuMobile em components/layout/Sidebar.tsx), senão a
// gaveta fica aberta por cima do conteúdo pro qual acabou de navegar.
function fecharMenuMobile() {
  const cb = document.getElementById('ldg-nav-toggle') as HTMLInputElement | null
  if (cb) cb.checked = false
}

// Anima a entrada de uma seção quando ela cruza a viewport (scroll-reveal) —
// via IntersectionObserver em vez de biblioteca externa, já que é só
// fade + leve translateY. Dispara uma vez só (desliga o observer depois).
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Alterna a cada entrada/saída da viewport (sem disconnect) — assim a
    // transição toca de novo toda vez, inclusive ao descer e subir a barra
    // de rolagem, não só na primeira vez que a seção aparece.
    const obs = new IntersectionObserver(
      ([entry]) => setVisivel(entry.isIntersecting),
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={`ldg-reveal${visivel ? ' ldg-reveal-in' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

const RECURSOS: Array<{ icon: string; titulo: string; desc: string }> = [
  { icon: 'ti-file-text',           titulo: 'RDO digital completo',            desc: 'Mão de obra, equipamentos, clima, atividades e ocorrências — tudo em um só registro diário, sem planilha solta.' },
  { icon: 'ti-list-check',          titulo: 'Lista de tarefas com prazo',      desc: 'Defina data de início e término de cada etapa e acompanhe o progresso real × planejado — o sistema mostra se está adiantado ou atrasado, sem calcular na mão.' },
  { icon: 'ti-writing',             titulo: 'Assinatura digital, Lei 14.063',  desc: 'Cadastre quem pode assinar cada projeto para aprovação — todo o time ou só responsáveis definidos por você — com validade jurídica, sem papel, sem carimbo.' },
  { icon: 'ti-checklist',           titulo: 'Fluxo de aprovação configurável', desc: 'Defina quem aprova cada projeto, acompanhe pendências e corte o vai-e-volta por e-mail.' },
  { icon: 'ti-chart-bar',           titulo: 'Relatórios e dashboards',        desc: 'Desvio planejado × realizado, H/H por categoria, status dos RDOs e ocorrências, sempre atualizados.' },
  { icon: 'ti-download',            titulo: 'Exportação completa do projeto', desc: 'Ao final da obra, baixe tudo em lote: todos os RDOs em PDF e todas as fotos e vídeos do projeto, organizados por data.' },
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
    tipo: 'Starter', resumo: 'Para começar a organizar seus RDOs.',
    itens: ['Até 4 usuários', 'Até 2 projetos', '50 RDOs por mês', 'Exportação em PDF'],
  },
  {
    tipo: 'Pro', resumo: 'Pra equipes que precisam de mais recursos.', destaque: true,
    itens: ['Até 10 usuários', 'Até 10 projetos', 'RDOs ilimitados', 'Relatórios e dashboards completos', 'Exportação em PDF'],
  },
  {
    tipo: 'Enterprise', resumo: 'Pra grandes empresas com necessidades específicas.',
    itens: ['Usuários ilimitados', 'Projetos ilimitados', 'RDOs ilimitados', 'Relatórios e dashboards completos', 'Suporte dedicado'],
  },
]

export default function LandingPage() {
  // html/body globais ficam com overflow:hidden pro layout do app logado
  // (que rola por dentro, via .content) — como esta página não usa esse
  // shell, ela precisa da própria rolagem, senão trava sem dar scroll.
  return (
    <div style={{ background: 'var(--s0)', color: 'var(--tp)', height: '100dvh', overflowY: 'auto', scrollBehavior: 'smooth' }}>
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
            <a href="#na-pratica">Na prática</a>
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
          <a href="#na-pratica" onClick={fecharMenuMobile}>Na prática</a>
          <a href="#planos" onClick={fecharMenuMobile}>Planos</a>
          <a href="#seguranca" onClick={fecharMenuMobile}>Segurança</a>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="ldg-wrap ldg-hero-grid" style={{ position: 'relative', overflow: 'hidden', paddingTop: 64, paddingBottom: 56, display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 48, alignItems: 'center' }}>
        <div className="ldg-hero-glow" aria-hidden="true" />
        <div style={{ animation: 'ldgFadeUp .7s ease both' }}>
          <div className="ldg-badge">
            <i className="ti ti-certificate" />
            Conforme a Lei 14.063 — assinatura digital com validade jurídica
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, lineHeight: 1.15, margin: '16px 0 14px', letterSpacing: '-.02em' }}>
            O diário de obra que as empresas <span style={{ color: 'var(--ta)' }}>levam a sério</span>
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
        <div className="ldg-mock" style={{ animation: 'ldgFadeUp .7s ease .15s both' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 8, marginTop: 16, paddingTop: 14, borderTop: '.5px solid var(--b)' }}>
              {[
                { i: 'ti-file-text', t: '1 RDO' },
                { i: 'ti-list-check', t: '6 atividades' },
                { i: 'ti-photo', t: '9 fotos' },
                { i: 'ti-alert-triangle', t: '2 ocorrências' },
                { i: 'ti-message', t: '5 comentários' },
                { i: 'ti-video', t: '2 vídeos' },
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
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
            <div className="ldg-eyebrow">Recursos</div>
            <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 10px' }}>Tudo que a gestão de obra precisa, num só lugar</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ts)', lineHeight: 1.6 }}>Sem planilha, sem papel perdido, sem WhatsApp como sistema de registro.</p>
          </div>
        </Reveal>
        <div className="ldg-features-grid">
          {RECURSOS.map((r, i) => (
            <Reveal key={r.titulo} delay={(i % 4) * 70}>
              <div className="ldg-card">
                <div className="ldg-icon-box"><i className={`ti ${r.icon}`} /></div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>{r.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.55 }}>{r.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Como funciona ─────────────────────────────────── */}
      <section id="como-funciona" style={{ background: 'var(--s1)', borderTop: '.5px solid var(--b)', borderBottom: '.5px solid var(--b)' }}>
        <div className="ldg-wrap" style={{ padding: '56px 24px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
              <div className="ldg-eyebrow">Como funciona</div>
              <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 0' }}>Do canteiro ao relatório, em quatro passos</h2>
            </div>
          </Reveal>
          <div className="ldg-steps-grid">
            {PASSOS.map((p, i) => (
              <Reveal key={p.n} delay={i * 90}>
                <div style={{ position: 'relative' }}>
                  <div className="ldg-step-n">{p.n}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, margin: '14px 0 5px' }}>{p.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--ts)', lineHeight: 1.55 }}>{p.desc}</div>
                  {i < PASSOS.length - 1 && <div className="ldg-step-line" />}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Na prática (mocks fictícios) ─────────────────────
          Celular simulando o preenchimento do RDO + mini-dashboard de
          Relatórios — nenhum é print real, são réplicas visuais fiéis às
          telas reais (ver app/(app)/rdos/[id]/FormularioRdo.tsx e
          app/(app)/relatorios/page.tsx), só com dados fictícios. */}
      <section id="na-pratica" className="ldg-wrap ldg-showcase-grid" style={{ padding: '56px 24px', display: 'grid', gridTemplateColumns: '.8fr 1.2fr', gap: 48, alignItems: 'center' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="ldg-phone-tilt">
            <div className="ldg-phone">
              <div className="ldg-phone-btn ldg-phone-btn-a" />
              <div className="ldg-phone-btn ldg-phone-btn-b" />
              <div className="ldg-phone-btn ldg-phone-btn-c" />
              <div className="ldg-phone-screen">
                <div className="ldg-ph-status">
                  <span>07:42</span>
                  <span className="ldg-ph-island" />
                  <span className="ldg-ph-sys">
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><rect x="0" y="6" width="2.4" height="4" rx=".6"/><rect x="3.8" y="4" width="2.4" height="6" rx=".6"/><rect x="7.6" y="2" width="2.4" height="8" rx=".6"/><rect x="11.4" y="0" width="2.4" height="10" rx=".6"/></svg>
                    <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 3.4a8 8 0 0 1 11 0M3 5.7a5 5 0 0 1 7 0"/><circle cx="6.5" cy="8.2" r=".9" fill="currentColor" stroke="none"/></svg>
                    <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x=".5" y=".5" width="18" height="9" rx="2.4" stroke="currentColor" opacity=".6"/><rect x="2" y="2" width="12" height="6" rx="1.4" fill="currentColor"/><rect x="19.6" y="3.2" width="1.8" height="3.6" rx=".8" fill="currentColor" opacity=".6"/></svg>
                  </span>
                </div>

                <div className="ldg-ph-appbar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ldg-ph-title">RDO #0024</div>
                    <div className="ldg-ph-sub">Obra Jardim das Flores</div>
                  </div>
                  <span className="ldg-ph-badge">Rascunho</span>
                </div>

                <div className="ldg-ph-body">
                  <div className="ldg-ph-sec first">Dados gerais</div>
                  <div className="ldg-ph-grid">
                    <div className="ldg-ph-field"><label>Data</label><div>24/09/2026</div></div>
                    <div className="ldg-ph-field"><label>Horário</label><div>07:00 – 17:00</div></div>
                    <div className="ldg-ph-field"><label>Intervalo</label><div>1h</div></div>
                    <div className="ldg-ph-field"><label>Total</label><div>9h</div></div>
                  </div>

                  <div className="ldg-ph-sec">Clima</div>
                  <div className="ldg-ph-clima">
                    <div className="ldg-ph-pill on"><span>☀️</span>Manhã · Sol</div>
                    <div className="ldg-ph-pill"><span>⛅</span>Tarde · Nublado</div>
                  </div>

                  <div className="ldg-ph-sec">Mão de obra <b>49 H/H</b></div>
                  {[
                    { n: 'Mestre de obras', d: '1 pessoa · 9h',  hh: '9 H/H',  ind: true },
                    { n: 'Pedreiro',        d: '3 pessoas · 8h', hh: '24 H/H', ind: false },
                    { n: 'Servente',        d: '2 pessoas · 8h', hh: '16 H/H', ind: false },
                  ].map(m => (
                    <div key={m.n} className="ldg-ph-row">
                      <span className={`ldg-ph-dot${m.ind ? ' ind' : ''}`} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ldg-ph-rn">{m.n}</div>
                        <div className="ldg-ph-rd">{m.d}</div>
                      </div>
                      <span className="ldg-ph-hh">{m.hh}</span>
                    </div>
                  ))}

                  <div className="ldg-ph-sec">Equipamentos <b>2</b></div>
                  {[
                    { n: 'Betoneira 400L', d: '1 un · 6h' },
                    { n: 'Vibrador de concreto', d: '2 un · 4h' },
                  ].map(e => (
                    <div key={e.n} className="ldg-ph-row">
                      <span className="ldg-ph-dot eq" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ldg-ph-rn">{e.n}</div>
                        <div className="ldg-ph-rd">{e.d}</div>
                      </div>
                    </div>
                  ))}

                  <div className="ldg-ph-sec">Atividades</div>
                  <div className="ldg-ph-act">
                    <div className="ldg-ph-rn">Concretagem da laje · Bloco B</div>
                    <div className="ldg-ph-bar"><i style={{ width: '60%' }} /></div>
                    <div className="ldg-ph-rd">60% concluído hoje</div>
                  </div>
                  <div className="ldg-ph-act" style={{ marginTop: 5 }}>
                    <div className="ldg-ph-rn">Alvenaria · Pavimento 2</div>
                    <div className="ldg-ph-bar"><i style={{ width: '35%' }} /></div>
                    <div className="ldg-ph-rd">35% concluído hoje</div>
                  </div>

                  <div className="ldg-ph-sec">Ocorrências <b>1</b></div>
                  <div className="ldg-ph-act">
                    <div className="ldg-ph-rn">Atraso na entrega de concreto</div>
                    <div className="ldg-ph-rd">Caminhão chegou 1h30 após o combinado.</div>
                  </div>

                  <div className="ldg-ph-sec">Fotos <b>3</b></div>
                  <div className="ldg-ph-fotos">
                    <span style={{ background: 'linear-gradient(135deg,#7fb3d5,#c9dcea)' }} />
                    <span style={{ background: 'linear-gradient(135deg,#b9a78a,#e1d4bd)' }} />
                    <span style={{ background: 'linear-gradient(135deg,#8fa59a,#cfdcd5)' }} />
                  </div>

                  <div className="ldg-ph-sec">Observações</div>
                  <div className="ldg-ph-field"><div style={{ fontWeight: 500, lineHeight: 1.4 }}>Laje do bloco B concretada sem intercorrências. Cura iniciada às 16h.</div></div>
                  <div style={{ height: 14 }} />
                </div>

                <div className="ldg-ph-actions">
                  <span className="ldg-ph-btn-g">Salvar rascunho</span>
                  <span className="ldg-ph-btn-p">Enviar p/ aprovação</span>
                </div>
                <div className="ldg-ph-home" />
              </div>
            </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div>
            <div className="ldg-eyebrow">Na prática</div>
            <h2 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 700, margin: '8px 0 14px' }}>Do celular no canteiro ao dashboard no escritório</h2>
            <p style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.65, marginBottom: 22 }}>
              Quem está na obra registra tudo em minutos, pelo próprio celular. Quem está gerindo
              acompanha avanço, desvio e ocorrências em relatórios sempre atualizados — sem esperar
              planilha chegar por e-mail.
            </p>

            <div className="ldg-mock">
              <div className="ldg-mock-top">
                <span className="ldg-mock-dot" /><span className="ldg-mock-dot" /><span className="ldg-mock-dot" />
                <span style={{ marginLeft: 8, fontSize: 10.5, color: 'var(--tm)' }}>Relatórios · Obra Jardim das Flores</span>
              </div>
              <div className="ldg-mock-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'center', marginBottom: 18 }}>
                  <div className="ldg-donut" style={{ background: 'conic-gradient(var(--tsu) 0 65%, var(--tw) 65% 85%, var(--ts) 85% 95%, var(--td) 95% 100%)' }}>
                    <div className="ldg-donut-hole" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tp)', marginBottom: 8 }}>Status dos RDOs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { c: 'var(--tsu)', t: 'Aprovado', v: '65%' },
                        { c: 'var(--tw)', t: 'Pendente', v: '20%' },
                        { c: 'var(--ts)', t: 'Rascunho', v: '10%' },
                        { c: 'var(--td)', t: 'Rejeitado', v: '5%' },
                      ].map(l => (
                        <div key={l.t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: 'var(--ts)' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.c, flexShrink: 0 }} />
                          {l.t} <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--tp)' }}>{l.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tp)', marginBottom: 8 }}>H/H por categoria de mão de obra</div>
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: '55%', background: 'var(--ta)' }} />
                  <div style={{ width: '30%', background: 'var(--tpu)' }} />
                  <div style={{ width: '15%', background: 'var(--tsu)' }} />
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[
                    { c: 'var(--ta)', t: 'Direta 55%' },
                    { c: 'var(--tpu)', t: 'Indireta 30%' },
                    { c: 'var(--tsu)', t: 'Terceirizado 15%' },
                  ].map(l => (
                    <div key={l.t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: 'var(--tm)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.c }} />{l.t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Segurança ─────────────────────────────────────── */}
      <section id="seguranca" className="ldg-wrap ldg-seg-grid" style={{ padding: '56px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        <Reveal>
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
        </Reveal>
        <Reveal delay={120}>
          <div className="ldg-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
            <i className="ti ti-shield-lock" style={{ fontSize: 44, color: 'var(--ta)' }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>Lei 14.063</div>
            <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 4 }}>Assinatura eletrônica com validade jurídica</div>
          </div>
        </Reveal>
      </section>

      {/* ── Planos ────────────────────────────────────────── */}
      <section id="planos" style={{ background: 'var(--s1)', borderTop: '.5px solid var(--b)', borderBottom: '.5px solid var(--b)' }}>
        <div className="ldg-wrap" style={{ padding: '56px 24px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
              <div className="ldg-eyebrow">Planos</div>
              <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, margin: '8px 0 10px' }}>Um plano pro tamanho da sua obra</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ts)' }}>Sem fidelidade. Fale com a gente pra achar o plano certo.</p>
            </div>
          </Reveal>
          <div className="ldg-pricing-grid">
            {PLANOS.map((p, i) => (
              <Reveal key={p.tipo} delay={i * 90}>
                <div className="ldg-card ldg-plan" style={p.destaque ? { borderColor: 'var(--ta)', background: 'var(--bga)' } : undefined}>
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────── */}
      <section className="ldg-wrap" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <Reveal>
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
        </Reveal>
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

      {/* Contato via WhatsApp — ícone já no ar, mas sem link/ação até
          definirmos o número oficial de atendimento (pedido explícito:
          deixar visível e sem funcionamento até segunda ordem). */}
      <button
        type="button"
        className="ldg-whatsapp-fab"
        aria-label="WhatsApp (em breve)"
        title="Em breve"
        onClick={e => e.preventDefault()}
      >
        <i className="ti ti-brand-whatsapp" />
      </button>
    </div>
  )
}
