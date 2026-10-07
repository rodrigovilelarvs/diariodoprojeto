'use client'
// Manual do usuário — passo a passo, com capturas de tela (dados fictícios).
// Conteúdo em ./conteudo.ts; imagens em public/ajuda/.

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { SECOES, type Bloco, type Secao } from './conteudo'

// **negrito** → <strong>
function Texto({ x }: { x: string }) {
  const partes = x.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function textoDoBloco(b: Bloco): string {
  switch (b.t) {
    case 'p': case 'h': case 'dica': case 'aviso': return b.x
    case 'passos': case 'lista': return b.x.join(' ')
    case 'img': return `${b.alt} ${b.legenda ?? ''}`
    case 'celulares': return b.itens.map(i => i.legenda).join(' ')
    case 'tabela': return [...b.cab, ...b.linhas.flat()].join(' ')
    case 'faq': return b.itens.map(i => `${i.q} ${i.a}`).join(' ')
  }
}
const textoDaSecao = (s: Secao) => semAcento([s.titulo, s.resumo, s.quem ?? '', ...s.blocos.map(textoDoBloco)].join(' ').replace(/\*\*/g, ''))

function BlocoView({ b, ampliar }: { b: Bloco; ampliar: (src: string, alt: string) => void }) {
  switch (b.t) {
    case 'p': return <p className="aj-p"><Texto x={b.x} /></p>
    case 'h': return <h3 className="aj-h3">{b.x}</h3>
    case 'passos':
      return <ol className="aj-passos">{b.x.map((x, i) => <li key={i}><Texto x={x} /></li>)}</ol>
    case 'lista':
      return <ul className="aj-lista">{b.x.map((x, i) => <li key={i}><Texto x={x} /></li>)}</ul>
    case 'img':
      return (
        <figure className="aj-fig">
          <button type="button" className="aj-fig-btn" onClick={() => ampliar(b.src, b.alt)} aria-label={`Ampliar: ${b.alt}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.alt} loading="lazy" />
            <span className="aj-zoom"><i className="ti ti-zoom-in" /> Ampliar</span>
          </button>
          {b.legenda && <figcaption>{b.legenda}</figcaption>}
        </figure>
      )
    case 'celulares':
      return (
        <div className="aj-cels">
          {b.itens.map(i => (
            <figure key={i.src} className="aj-cel">
              <button type="button" className="aj-cel-btn" onClick={() => ampliar(i.src, i.alt)} aria-label={`Ampliar: ${i.alt}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.src} alt={i.alt} loading="lazy" />
              </button>
              <figcaption>{i.legenda}</figcaption>
            </figure>
          ))}
        </div>
      )
    case 'dica':
      return <div className="aj-nota aj-dica"><i className="ti ti-bulb" /><div><Texto x={b.x} /></div></div>
    case 'aviso':
      return <div className="aj-nota aj-aviso"><i className="ti ti-alert-circle" /><div><Texto x={b.x} /></div></div>
    case 'tabela':
      return (
        <div className="aj-tab-wrap">
          <table className="aj-tab">
            <thead><tr>{b.cab.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {b.linhas.map((l, i) => (
                <tr key={i}>{l.map((c, j) => <td key={j}>{j === 0 ? <strong>{c}</strong> : <Texto x={c} />}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'faq':
      return (
        <div className="aj-faq">
          {b.itens.map(i => (
            <details key={i.q}>
              <summary>{i.q}</summary>
              <p><Texto x={i.a} /></p>
            </details>
          ))}
        </div>
      )
  }
}

export default function AjudaPage() {
  const [busca, setBusca] = useState('')
  const [ativa, setAtiva] = useState(SECOES[0].id)
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)

  const indice = useMemo(() => SECOES.map(s => ({ s, texto: textoDaSecao(s) })), [])
  const termo = semAcento(busca.trim())
  const visiveis = useMemo(
    () => (termo ? indice.filter(i => i.texto.includes(termo)).map(i => i.s) : SECOES),
    [indice, termo],
  )

  // Destaca no índice a seção que está na tela
  useEffect(() => {
    const els = visiveis.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      entries => {
        const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setAtiva(vis[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [visiveis])

  // Ao buscar, volta ao topo da tela para mostrar os resultados
  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }, [termo])

  useEffect(() => {
    if (!zoom) return
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null) }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [zoom])

  function irPara(id: string) {
    setAtiva(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="main aj-main">
      <Topbar
        titulo="Central de ajuda"
        subtitulo="Manual do usuário — passo a passo, com telas do sistema"
        acoes={
          <button className="btn btn-sm aj-print" onClick={() => window.print()}>
            <i className="ti ti-printer" /> Imprimir / salvar PDF
          </button>
        }
      />
      <div className="content">
        <div className="aj-layout">
          <nav className="aj-toc" aria-label="Índice do manual">
            <div className="aj-busca">
              <i className="ti ti-search" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar no manual..."
                aria-label="Buscar no manual"
              />
              {busca && (
                <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="aj-busca-x">
                  <i className="ti ti-x" />
                </button>
              )}
            </div>
            <div className="aj-toc-lista">
              {visiveis.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => irPara(s.id)}
                  className={`aj-toc-item${ativa === s.id ? ' on' : ''}`}
                >
                  <i className={`ti ${s.icone}`} />
                  <span>{termo ? s.titulo : `${i + 1}. ${s.titulo}`}</span>
                </button>
              ))}
              {visiveis.length === 0 && <div className="aj-vazio-toc">Nada encontrado.</div>}
            </div>
          </nav>

          <div className="aj-corpo">
            {visiveis.length === 0 ? (
              <div className="aj-vazio">
                <i className="ti ti-search-off" />
                <div>Nenhum assunto encontrado para <strong>“{busca}”</strong>.</div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>Tente outra palavra, como “RDO”, “assinatura” ou “permissão”.</div>
              </div>
            ) : (
              <>
                {!termo && (
                  <div className="aj-intro">
                    <div className="aj-intro-t">Bem-vindo ao Diário do Projeto</div>
                    <p>
                      Este manual explica, passo a passo, como usar o sistema no computador e no celular.
                      Use o índice para ir direto ao assunto, ou digite uma palavra na busca. Os exemplos usam dados fictícios.
                    </p>
                  </div>
                )}
                {visiveis.map(s => (
                  <section key={s.id} id={s.id} className="aj-sec">
                    <header className="aj-sec-h">
                      <span className="aj-sec-ic"><i className={`ti ${s.icone}`} /></span>
                      <div>
                        <h2>{s.titulo}</h2>
                        <div className="aj-sec-r">{s.resumo}</div>
                      </div>
                    </header>
                    {s.quem && (
                      <div className="aj-quem"><i className="ti ti-lock" /> <span>{s.quem}</span></div>
                    )}
                    {s.blocos.map((b, i) => <BlocoView key={i} b={b} ampliar={(src, alt) => setZoom({ src, alt })} />)}
                  </section>
                ))}
                <div className="aj-fim">
                  Não encontrou o que procurava? Escreva para{' '}
                  <a href="mailto:suportediariodoprojeto@gmail.com">suportediariodoprojeto@gmail.com</a>.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {zoom && (
        <div className="aj-lightbox" role="dialog" aria-modal="true" aria-label={zoom.alt} onClick={() => setZoom(null)}>
          <button type="button" className="aj-lb-x" onClick={() => setZoom(null)} aria-label="Fechar"><i className="ti ti-x" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.alt} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
