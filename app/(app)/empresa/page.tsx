'use client'
// src/app/(app)/empresa/page.tsx
// "Dados da empresa" — cadastro, contato, plano contratado e uso vs. limites.
// Edição restrita a quem gerencia usuários; leitura liberada a todos da empresa.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Topbar } from '@/components/layout/Topbar'
import { Secao, Field, Input, Skeleton, Badge } from '@/components/ui'
import { useEmpresaInfo, useAtualizarEmpresaInfo } from '@/hooks/useEmpresa'
import { mensagemErro } from '@/lib/api'

const PLANO_LABEL: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' }
const PLANO_COR:   Record<string, string> = { STARTER: '#8B95A8', PRO: '#29B6D8', ENTERPRISE: '#F59E0B' }
const STATUS_LABEL: Record<string, string> = { ATIVO: 'Ativa', SUSPENSO: 'Suspensa', AGUARDANDO: 'Aguardando ativação' }
const STATUS_VARIANT: Record<string, 'ok' | 'warn' | 'gray'> = { ATIVO: 'ok', SUSPENSO: 'warn', AGUARDANDO: 'gray' }

function fmtData(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function fmtMoeda(v?: number) {
  if (v == null) return '—'
  if (v === 0) return 'Grátis'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function BarraUso({ label, atual, limite }: { label: string; atual: number; limite: number }) {
  const ilimitado = limite === 0
  const pct = ilimitado ? 0 : Math.min(100, Math.round((atual / limite) * 100))
  const cor = pct >= 100 ? 'var(--td)' : pct >= 80 ? 'var(--tw)' : 'var(--fa)'
  return (
    <div className="pbar">
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--tm)' }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{atual} {ilimitado ? '' : `/ ${limite}`}{ilimitado && <span style={{ color: 'var(--tm)', fontWeight: 400 }}> (ilimitado)</span>}</span>
      </div>
      <div className="pb-t"><div className="pb-f" style={{ width: `${ilimitado ? 6 : pct}%`, background: cor }} /></div>
    </div>
  )
}

export default function EmpresaPage() {
  const { data: empresa, isLoading } = useEmpresaInfo()
  const atualizar = useAtualizarEmpresaInfo()

  const [form, setForm] = useState({
    nome: '', cnpj: '', setor: '', cidade: '', uf: '',
    contatoNome: '', contatoEmail: '', contatoTelefone: '',
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (empresa) {
      setForm({
        nome: empresa.nome, cnpj: empresa.cnpj ?? '', setor: empresa.setor ?? '',
        cidade: empresa.cidade ?? '', uf: empresa.uf ?? '',
        contatoNome: empresa.contatoNome ?? '', contatoEmail: empresa.contatoEmail ?? '',
        contatoTelefone: empresa.contatoTelefone ?? '',
      })
    }
  }, [empresa])

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { toast.error('Nome da empresa é obrigatório.'); return }
    setSalvando(true)
    try {
      await atualizar.mutateAsync(form)
      toast.success('Dados da empresa atualizados!')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar dados da empresa.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="main">
      <Topbar titulo="Dados da empresa" subtitulo="Cadastro, contato, plano contratado e uso" />
      <div className="content">

        {/* ══ Dados gerais ══ */}
        <Secao numero={1} titulo="Dados gerais">
          {isLoading ? <Skeleton h={110} /> : (
            <form onSubmit={handleSalvar}>
              <div className="g2">
                <Field label="Nome da empresa">
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}/>
                </Field>
                <Field label="CNPJ">
                  <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </Field>
              </div>
              <div className="g3">
                <Field label="Setor">
                  <Input value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} placeholder="Ex.: Construção civil" />
                </Field>
                <Field label="Cidade">
                  <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}/>
                </Field>
                <Field label="UF">
                  <Input value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} />
                </Field>
              </div>

              <div style={{ fontSize: 10.5, color: 'var(--tm)', margin: '2px 0 12px' }}>
                Cadastrada em {fmtData(empresa?.criadoEm)}{empresa?.ativadoEm && <> · Ativa desde {fmtData(empresa.ativadoEm)}</>}
              </div>

              <div style={{ borderTop: '.5px solid var(--b)', margin: '4px 0 14px' }} />

              <div className="g3">
                <Field label="Nome do contato">
                  <Input value={form.contatoNome} onChange={e => setForm(f => ({ ...f, contatoNome: e.target.value }))}/>
                </Field>
                <Field label="E-mail do contato">
                  <Input type="email" value={form.contatoEmail} onChange={e => setForm(f => ({ ...f, contatoEmail: e.target.value }))}/>
                </Field>
                <Field label="Telefone do contato">
                  <Input value={form.contatoTelefone} onChange={e => setForm(f => ({ ...f, contatoTelefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-p btn-sm" type="submit" disabled={salvando}>
                  <i className={`ti ${salvando ? 'ti-loader' : 'ti-device-floppy'}`}
                    style={salvando ? { animation: 'spin 1s linear infinite' } : {}} />
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}
        </Secao>

        {/* ══ Plano e cobrança ══ */}
        <Secao numero={2} titulo="Plano e cobrança">
          {isLoading ? <Skeleton h={90} /> : empresa && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--r)',
                  background: `${PLANO_COR[empresa.plano]}1a`, color: PLANO_COR[empresa.plano], fontSize: 12, fontWeight: 700,
                }}>
                  <i className="ti ti-crown" /> {PLANO_LABEL[empresa.plano] ?? empresa.plano}
                </div>
                <Badge variant={STATUS_VARIANT[empresa.status] ?? 'gray'}>{STATUS_LABEL[empresa.status] ?? empresa.status}</Badge>
                {empresa.planoConfig && (
                  <span style={{ fontSize: 12, color: 'var(--ts)' }}>{fmtMoeda(empresa.planoConfig.precoMensal)}/mês</span>
                )}
              </div>

              <div className="g2">
                <Field label="Próximo vencimento">
                  <Input value={fmtData(empresa.dataVencimentoPlano)} disabled />
                </Field>
                <Field label="Cliente desde">
                  <Input value={fmtData(empresa.ativadoEm ?? empresa.criadoEm)} disabled />
                </Field>
              </div>

              {empresa.planoConfig && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {[
                    { ok: true, label: 'Emissão de RDOs' },
                    { ok: empresa.planoConfig.temExportPdf, label: 'Exportação em PDF' },
                    { ok: empresa.planoConfig.temRelatorios, label: 'Relatórios avançados' },
                    { ok: empresa.planoConfig.temApi, label: 'Acesso via API' },
                    { ok: empresa.planoConfig.temSuporteDedicado, label: 'Suporte dedicado' },
                  ].map(f => (
                    <div key={f.label} style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                      color: f.ok ? 'var(--tp)' : 'var(--tm)', opacity: f.ok ? 1 : 0.55,
                    }}>
                      <i className={`ti ${f.ok ? 'ti-circle-check-filled' : 'ti-circle-dashed'}`}
                        style={{ color: f.ok ? 'var(--fa)' : 'var(--tm)' }} />
                      {f.label}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 12 }}>
                Para alterar de plano ou os dados de cobrança, fale com o suporte.
              </div>
            </>
          )}
        </Secao>

        {/* ══ Uso do plano ══ */}
        <Secao numero={3} titulo="Uso do plano">
          {isLoading ? <Skeleton h={90} /> : empresa && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BarraUso label="Usuários ativos" atual={empresa.uso.usuarios} limite={empresa.limites.usuarios} />
              <BarraUso label="Projetos" atual={empresa.uso.projetos} limite={empresa.limites.projetos} />
              <BarraUso label="RDOs neste mês" atual={empresa.uso.rdosMes} limite={empresa.limites.rdosMes} />
            </div>
          )}
        </Secao>

      </div>
    </div>
  )
}
