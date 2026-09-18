'use client'
// app/admin/empresas/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminProviders } from '@/components/Providers'
import { useTenants, useCriarTenant, useAtivarTenant, useSuspenderTenant, useAtualizarTenant, useMudarPlano } from '@/hooks/useAdmin'
import type { PlanoTipo, Tenant } from '@/lib/types'
import { mensagemErro } from '@/lib/api'

const PLANO_COR: Record<string,string> = { STARTER:'#8B95A8', PRO:'#29B6D8', ENTERPRISE:'#F59E0B' }
const STATUS_COR: Record<string,string> = { ATIVO:'#4CAF7D', AGUARDANDO:'#E6A817', SUSPENSO:'#E05C5C' }
const STATUS_L: Record<string,string>   = { ATIVO:'Ativo', AGUARDANDO:'Aguardando', SUSPENSO:'Suspenso' }

function EmpresasContent() {
  const router = useRouter()
  const { data, isLoading, refetch } = useTenants()
  const criarTenant     = useCriarTenant()
  const ativarTenant    = useAtivarTenant()
  const suspenderTenant = useSuspenderTenant()
  const atualizarTenant = useAtualizarTenant()
  const mudarPlano      = useMudarPlano()
  const [modal, setModal] = useState(false)
  const [nome, setNome]   = useState('')
  const [form, setForm]   = useState({ nome:'', cnpj:'', setor:'Construção civil', cidade:'', uf:'SP', admNome:'', admEmail:'', admTelefone:'', senha:'', plano:'STARTER' as PlanoTipo, obsInterna:'', dataVencimentoPlano:'', ativarImediatamente:false })
  const [erro, setErro]   = useState('')
  const [ok,   setOk]     = useState('')
  const [mostrarSenhaNova, setMostrarSenhaNova] = useState(false)

  const [editando, setEditando] = useState<Tenant | null>(null)
  const [editForm, setEditForm] = useState({ nome:'', cnpj:'', setor:'', cidade:'', uf:'', plano:'STARTER' as PlanoTipo, dataVencimentoPlano:'', admNome:'', admEmail:'', admTelefone:'', admSenha:'' })
  const [editErro, setEditErro] = useState('')
  const [mostrarSenhaEdit, setMostrarSenhaEdit] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('admin_session')
    if (!raw) { router.push('/admin/login'); return }
    try { setNome(JSON.parse(raw).nome ?? '') } catch {}
  }, [router])

  function sair() {
    document.cookie = 'admin_token=; path=/; max-age=0'
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_session')
    router.push('/admin/login')
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setOk('')
    if (!form.nome || !form.admNome || !form.admEmail) { setErro('Preencha nome, responsável e e-mail.'); return }
    if (form.senha && form.senha.length < 8) { setErro('A senha deve ter pelo menos 8 caracteres.'); return }
    try {
      await criarTenant.mutateAsync(form)
      setOk(`"${form.nome}" cadastrada com sucesso!${form.senha ? ' Login já pode ser usado com a senha definida.' : ''}`)
      setModal(false)
      setForm({ nome:'', cnpj:'', setor:'Construção civil', cidade:'', uf:'SP', admNome:'', admEmail:'', admTelefone:'', senha:'', plano:'STARTER', obsInterna:'', dataVencimentoPlano:'', ativarImediatamente:false })
      refetch()
    } catch (err) { setErro(mensagemErro(err, 'Erro ao cadastrar.')) }
  }

  function abrirEdicao(e: Tenant) {
    setEditando(e)
    const responsavel = e.usuarios?.[0]
    setEditForm({
      nome: e.nome ?? '', cnpj: e.cnpj ?? '', setor: e.setor ?? '', cidade: e.cidade ?? '', uf: e.uf ?? '', plano: e.plano,
      dataVencimentoPlano: e.dataVencimentoPlano ? String(e.dataVencimentoPlano).slice(0, 10) : '',
      admNome: responsavel?.nome ?? '', admEmail: responsavel?.email ?? '', admTelefone: responsavel?.telefone ?? '', admSenha: '',
    })
    setMostrarSenhaEdit(false)
    setEditErro('')
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault(); setEditErro('')
    if (!editando) return
    if (!editForm.nome) { setEditErro('Preencha o nome da empresa.'); return }
    if (editForm.admSenha && editForm.admSenha.length < 8) { setEditErro('A nova senha deve ter pelo menos 8 caracteres.'); return }
    try {
      await atualizarTenant.mutateAsync({
        id: editando.id, nome: editForm.nome, cnpj: editForm.cnpj, setor: editForm.setor, cidade: editForm.cidade, uf: editForm.uf,
        dataVencimentoPlano: editForm.dataVencimentoPlano || null,
        admNome: editForm.admNome, admEmail: editForm.admEmail, admTelefone: editForm.admTelefone,
        ...(editForm.admSenha && { admSenha: editForm.admSenha }),
      })
      if (editForm.plano !== editando.plano) {
        await mudarPlano.mutateAsync({ id: editando.id, plano: editForm.plano })
      }
      setOk(`"${editForm.nome}" atualizada com sucesso!${editForm.admSenha ? ' Senha do responsável redefinida.' : ''}`)
      setEditando(null)
      refetch()
    } catch (err) { setEditErro(mensagemErro(err, 'Erro ao salvar.')) }
  }

  const empresas = data?.tenants ?? []
  const r        = data?.resumo

  const NAV = [
    { l:'Dashboard',     p:'/admin/dashboard', i:'📊' },
    { l:'Empresas',      p:'/admin/empresas',  i:'🏢' },
    { l:'Auditoria',     p:'/admin/auditoria', i:'📋' },
    { l:'Uso & Limites', p:'/admin/uso',       i:'📈' },
    { l:'Planos',        p:'/admin/planos',    i:'💳' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', background:'#090C12', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width:200, background:'#0F1520', borderRight:'.5px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'14px', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#F59E0B', letterSpacing:'.08em' }}>DIÁRIO DO PROJETO</div>
          <div style={{ fontSize:9, color:'#4A5568', marginTop:2 }}>Painel do Proprietário</div>
          <div style={{ display:'inline-flex', marginTop:7, background:'rgba(245,158,11,.1)', border:'.5px solid rgba(245,158,11,.3)', borderRadius:20, padding:'2px 8px' }}>
            <span style={{ fontSize:9, fontWeight:600, color:'#F59E0B' }}>👑 Super Admin</span>
          </div>
        </div>
        <nav style={{ padding:7, flex:1 }}>
          {NAV.map(item => (
            <div key={item.l} onClick={() => router.push(item.p)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 9px', borderRadius:8, fontSize:11.5, cursor:'pointer', color: item.l==='Empresas' ? '#F59E0B' : '#8B95A8', background: item.l==='Empresas' ? 'rgba(245,158,11,.08)' : 'transparent', marginBottom:1 }}>
              <span>{item.i}</span>{item.l}
            </div>
          ))}
        </nav>
        <div style={{ padding:'9px 12px', borderTop:'.5px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(245,158,11,.15)', color:'#F59E0B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600 }}>
            {nome.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'#E8EAF0' }}>{nome}</div>
            <button onClick={sair} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'#4A5568', fontFamily:'inherit', padding:0 }}>Sair</button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'#E8EAF0' }}>Empresas clientes</div>
            <div style={{ fontSize:11, color:'#8B95A8' }}>Gerencie clientes, planos e acessos</div>
          </div>
          <button onClick={() => setModal(true)} style={{ padding:'7px 14px', borderRadius:8, background:'#29B6D8', border:'none', color:'#090C12', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            + Nova empresa
          </button>
        </div>

        {ok && <div style={{ background:'rgba(76,175,125,.1)', border:'.5px solid rgba(76,175,125,.3)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#4CAF7D', marginBottom:12 }}>{ok}</div>}

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9, marginBottom:16 }}>
          {[
            { l:'Total',      v: r?.total      ?? 0, cor:'#29B6D8' },
            { l:'Ativas',     v: r?.ativos     ?? 0, cor:'#4CAF7D' },
            { l:'Aguardando', v: r?.aguardando ?? 0, cor:'#E6A817' },
            { l:'MRR',        v: `R$ ${(r?.mrr ?? 0).toLocaleString('pt-BR')}`, cor:'#F59E0B' },
          ].map(k => (
            <div key={k.l} style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, padding:'11px 13px' }}>
              <div style={{ fontSize:22, fontWeight:600, color:k.cor, marginBottom:3 }}>{k.v}</div>
              <div style={{ fontSize:10, color:'#8B95A8' }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.08)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11.5 }}>
            <thead>
              <tr style={{ background:'#161B25' }}>
                {['Empresa','Responsável','Plano','Usuários','Criada em','Status','Ações'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:500, color:'#8B95A8', borderBottom:'.5px solid rgba(255,255,255,.07)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#8B95A8' }}>Carregando...</td></tr>
              ) : empresas.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#4A5568' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🏢</div>
                  <div style={{ fontSize:13, color:'#8B95A8', marginBottom:4 }}>Nenhuma empresa cadastrada</div>
                  <div style={{ fontSize:11 }}>Clique em "+ Nova empresa" para começar</div>
                </td></tr>
              ) : empresas.map((e) => (
                <tr key={e.id} style={{ borderBottom:'.5px solid rgba(255,255,255,.05)' }}>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'#E8EAF0' }}>{e.nome}</div>
                    <div style={{ fontSize:10, color:'#4A5568' }}>{e.cnpj ?? e.setor ?? '—'}</div>
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ fontSize:11, color:'#E8EAF0' }}>{e.usuarios?.[0]?.nome ?? '—'}</div>
                    <div style={{ fontSize:10, color:'#4A5568' }}>{e.usuarios?.[0]?.email ?? ''}</div>
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500, background:`${PLANO_COR[e.plano]}18`, color:PLANO_COR[e.plano], border:`.5px solid ${PLANO_COR[e.plano]}40` }}>{e.plano}</span>
                  </td>
                  <td style={{ padding:'9px 12px', textAlign:'center', fontSize:12, fontWeight:500, color:'#E8EAF0' }}>{e._count?.usuarios ?? 0}</td>
                  <td style={{ padding:'9px 12px', fontSize:11, color:'#8B95A8' }}>{e.criadoEm ? new Date(e.criadoEm).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding:'9px 12px' }}>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:500, background:`${STATUS_COR[e.status]}18`, color:STATUS_COR[e.status], border:`.5px solid ${STATUS_COR[e.status]}40` }}>
                      {STATUS_L[e.status] ?? e.status}
                    </span>
                  </td>
                  <td style={{ padding:'9px 12px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => abrirEdicao(e)}
                        style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:'rgba(41,182,216,.1)', border:'.5px solid rgba(41,182,216,.3)', color:'#29B6D8', cursor:'pointer', fontFamily:'inherit' }}>
                        Editar
                      </button>
                      {(e.status === 'AGUARDANDO' || e.status === 'SUSPENSO') && (
                        <button onClick={() => { ativarTenant.mutate(e.id); refetch() }}
                          style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:'rgba(76,175,125,.15)', border:'.5px solid rgba(76,175,125,.3)', color:'#4CAF7D', cursor:'pointer', fontFamily:'inherit' }}>
                          Ativar
                        </button>
                      )}
                      {e.status === 'ATIVO' && (
                        <button onClick={() => { suspenderTenant.mutate(e.id); refetch() }}
                          style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', color:'#E05C5C', cursor:'pointer', fontFamily:'inherit' }}>
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nova empresa */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.14)', borderRadius:14, width:540, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:500, color:'#29B6D8' }}>🏢 Cadastrar nova empresa</span>
              <button onClick={() => setModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4A5568', fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:18, overflow:'auto', flex:1 }}>
              <form onSubmit={handleCriar}>
                {[
                  { l:'Nome da empresa *', k:'nome', t:'text', p:'Ex: Construtora ABC' },
                  { l:'CNPJ', k:'cnpj', t:'text', p:'00.000.000/0001-00' },
                  { l:'Setor', k:'setor', t:'text', p:'Ex: Construção civil' },
                  { l:'Cidade', k:'cidade', t:'text', p:'Ex: São Paulo' },
                  { l:'UF', k:'uf', t:'text', p:'Ex: SP' },
                  { l:'Nome do responsável *', k:'admNome', t:'text', p:'Nome completo' },
                  { l:'E-mail do responsável *', k:'admEmail', t:'email', p:'admin@empresa.com' },
                  { l:'Telefone / WhatsApp', k:'admTelefone', t:'text', p:'(11) 99999-9999' },
                ].map(f => (
                  <div key={f.k} style={{ marginBottom:12 }}>
                    <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>{f.l}</label>
                    <input type={f.t} placeholder={f.p} value={(form as any)[f.k]}
                      onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                  </div>
                ))}

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Senha inicial (opcional)</label>
                  <div style={{ position:'relative' }}>
                    <input type={mostrarSenhaNova ? 'text' : 'password'} placeholder="Deixe em branco para enviar convite por e-mail"
                      value={form.senha} onChange={e => setForm(prev => ({ ...prev, senha: e.target.value }))}
                      style={{ width:'100%', padding:'7px 38px 7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                    <button type="button" onClick={() => setMostrarSenhaNova(v => !v)}
                      aria-label={mostrarSenhaNova ? 'Ocultar senha' : 'Mostrar senha'}
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#8B95A8', padding:0 }}>
                      <i className={`ti ${mostrarSenhaNova ? 'ti-eye-off' : 'ti-eye'}`} />
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:'#4A5568', marginTop:4 }}>
                    Se preenchida, o responsável já pode logar com essa senha (sem depender do e-mail de convite). Mínimo 8 caracteres — lembre de marcar "Ativar acesso imediatamente" abaixo, senão a empresa fica aguardando ativação mesmo com a senha definida.
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:8 }}>Plano</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[
                      { tipo:'STARTER' as PlanoTipo,   label:'Starter',    preco:'Grátis',     cor:'#8B95A8' },
                      { tipo:'PRO' as PlanoTipo,        label:'Pro',        preco:'R$ 297/mês', cor:'#29B6D8' },
                      { tipo:'ENTERPRISE' as PlanoTipo, label:'Enterprise', preco:'Sob consulta',cor:'#F59E0B' },
                    ].map(p => (
                      <div key={p.tipo} onClick={() => setForm(f=>({...f,plano:p.tipo}))}
                        style={{ border:`.5px solid ${form.plano===p.tipo ? p.cor : 'rgba(255,255,255,.1)'}`, borderRadius:8, padding:'8px 10px', cursor:'pointer', background: form.plano===p.tipo ? `${p.cor}10` : 'transparent' }}>
                        <div style={{ fontSize:11, fontWeight:600, color: form.plano===p.tipo ? p.cor : '#E8EAF0' }}>{p.label}</div>
                        <div style={{ fontSize:10, color:'#8B95A8' }}>{p.preco}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Próximo vencimento do plano (opcional)</label>
                  <input type="date" value={form.dataVencimentoPlano}
                    onChange={e => setForm(prev => ({ ...prev, dataVencimentoPlano: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any, colorScheme:'dark' }} />
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'8px 10px', background:'rgba(41,182,216,.07)', borderRadius:8, border:'.5px solid rgba(41,182,216,.2)' }}>
                  <input type="checkbox" id="ativar" checked={form.ativarImediatamente}
                    onChange={e => setForm(f=>({...f,ativarImediatamente:e.target.checked}))} />
                  <label htmlFor="ativar" style={{ fontSize:12, color:'#29B6D8', cursor:'pointer' }}>
                    Ativar acesso imediatamente
                  </label>
                </div>

                {erro && <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#E05C5C', marginBottom:12 }}>{erro}</div>}

                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setModal(false)}
                    style={{ padding:'7px 14px', borderRadius:8, border:'.5px solid rgba(255,255,255,.14)', background:'transparent', color:'#E8EAF0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={criarTenant.isPending}
                    style={{ padding:'7px 16px', borderRadius:8, background:'#29B6D8', border:'none', color:'#090C12', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    {criarTenant.isPending ? 'Criando...' : '🏢 Criar empresa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar empresa */}
      {editando && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div style={{ background:'#1C2333', border:'.5px solid rgba(255,255,255,.14)', borderRadius:14, width:440, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'.5px solid rgba(255,255,255,.07)', background:'#161B25', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:500, color:'#29B6D8' }}>✏ Editar empresa</span>
              <button onClick={() => setEditando(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4A5568', fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:18, overflow:'auto', flex:1 }}>
              <form onSubmit={handleEditar}>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Nome da empresa *</label>
                  <input type="text" value={editForm.nome}
                    onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>CNPJ</label>
                  <input type="text" placeholder="00.000.000/0001-00" value={editForm.cnpj}
                    onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Setor</label>
                  <input type="text" value={editForm.setor}
                    onChange={e => setEditForm(f => ({ ...f, setor: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:8, marginBottom:14 }}>
                  <div>
                    <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Cidade</label>
                    <input type="text" value={editForm.cidade}
                      onChange={e => setEditForm(f => ({ ...f, cidade: e.target.value }))}
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>UF</label>
                    <input type="text" maxLength={2} value={editForm.uf}
                      onChange={e => setEditForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))}
                      style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                  </div>
                </div>

                <div style={{ marginBottom:14, padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,.03)', border:'.5px solid rgba(255,255,255,.08)' }}>
                  <div style={{ fontSize:10.5, color:'#8B95A8', marginBottom:8 }}>
                    Contato da empresa <span style={{ color:'#4A5568' }}>— preenchido pela própria empresa em &quot;Dados da empresa&quot;, só leitura aqui</span>
                  </div>
                  <div style={{ fontSize:12, color:'#E8EAF0', marginBottom:4 }}>{editando?.contatoNome || '—'}</div>
                  <div style={{ fontSize:11, color:'#8B95A8', marginBottom:4 }}>{editando?.contatoEmail || '—'}</div>
                  <div style={{ fontSize:11, color:'#8B95A8' }}>{editando?.contatoTelefone || '—'}</div>
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Nome do responsável</label>
                  <input type="text" placeholder="Nome completo" value={editForm.admNome}
                    onChange={e => setEditForm(f => ({ ...f, admNome: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>E-mail do responsável</label>
                  <input type="email" placeholder="admin@empresa.com" value={editForm.admEmail}
                    onChange={e => setEditForm(f => ({ ...f, admEmail: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Telefone / WhatsApp</label>
                  <input type="text" placeholder="(11) 99999-9999" value={editForm.admTelefone}
                    onChange={e => setEditForm(f => ({ ...f, admTelefone: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Redefinir senha do responsável (opcional)</label>
                  <div style={{ position:'relative' }}>
                    <input type={mostrarSenhaEdit ? 'text' : 'password'} placeholder="Deixe em branco para manter a senha atual"
                      value={editForm.admSenha} onChange={e => setEditForm(f => ({ ...f, admSenha: e.target.value }))}
                      style={{ width:'100%', padding:'7px 38px 7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any }} />
                    <button type="button" onClick={() => setMostrarSenhaEdit(v => !v)}
                      aria-label={mostrarSenhaEdit ? 'Ocultar senha' : 'Mostrar senha'}
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', width:26, height:26, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', fontSize:14, color:'#8B95A8', padding:0 }}>
                      <i className={`ti ${mostrarSenhaEdit ? 'ti-eye-off' : 'ti-eye'}`} />
                    </button>
                  </div>
                  <div style={{ fontSize:10, color:'#4A5568', marginTop:4 }}>Mínimo 8 caracteres. Também ativa a conta, se ainda estiver com convite pendente.</div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:8 }}>Plano</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[
                      { tipo:'STARTER' as PlanoTipo,   label:'Starter',    preco:'Grátis',     cor:'#8B95A8' },
                      { tipo:'PRO' as PlanoTipo,        label:'Pro',        preco:'R$ 297/mês', cor:'#29B6D8' },
                      { tipo:'ENTERPRISE' as PlanoTipo, label:'Enterprise', preco:'Sob consulta',cor:'#F59E0B' },
                    ].map(p => (
                      <div key={p.tipo} onClick={() => setEditForm(f=>({...f,plano:p.tipo}))}
                        style={{ border:`.5px solid ${editForm.plano===p.tipo ? p.cor : 'rgba(255,255,255,.1)'}`, borderRadius:8, padding:'8px 10px', cursor:'pointer', background: editForm.plano===p.tipo ? `${p.cor}10` : 'transparent' }}>
                        <div style={{ fontSize:11, fontWeight:600, color: editForm.plano===p.tipo ? p.cor : '#E8EAF0' }}>{p.label}</div>
                        <div style={{ fontSize:10, color:'#8B95A8' }}>{p.preco}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:'#8B95A8', display:'block', marginBottom:4 }}>Próximo vencimento do plano</label>
                  <input type="date" value={editForm.dataVencimentoPlano}
                    onChange={e => setEditForm(f => ({ ...f, dataVencimentoPlano: e.target.value }))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'.5px solid rgba(255,255,255,.12)', background:'#161B25', color:'#E8EAF0', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' as any, colorScheme:'dark' }} />
                  <div style={{ fontSize:10, color:'#4A5568', marginTop:4 }}>Exibido para a empresa em "Dados da empresa". Deixe em branco para remover.</div>
                </div>

                {editErro && <div style={{ background:'rgba(224,92,92,.1)', border:'.5px solid rgba(224,92,92,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#E05C5C', marginBottom:12 }}>{editErro}</div>}

                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button type="button" onClick={() => setEditando(null)}
                    style={{ padding:'7px 14px', borderRadius:8, border:'.5px solid rgba(255,255,255,.14)', background:'transparent', color:'#E8EAF0', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={atualizarTenant.isPending || mudarPlano.isPending}
                    style={{ padding:'7px 16px', borderRadius:8, background:'#29B6D8', border:'none', color:'#090C12', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    {(atualizarTenant.isPending || mudarPlano.isPending) ? 'Salvando...' : '💾 Salvar alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmpresasPage() {
  return <AdminProviders><EmpresasContent /></AdminProviders>
}
