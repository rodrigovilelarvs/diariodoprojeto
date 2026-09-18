'use client'
// src/app/(app)/perfil/page.tsx
// "Meu perfil" — dados da conta, empresas vinculadas ao e-mail, troca de
// senha e cadastro da assinatura digital pessoal.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Topbar } from '@/components/layout/Topbar'
import { Secao, Field, Input, Skeleton, Badge } from '@/components/ui'
import { AssinaturaCanvas } from '@/components/perfil/AssinaturaCanvas'
import { useAppAuth } from '@/contexts/AuthContext'
import { mensagemErro } from '@/lib/api'
import {
  useMeuPerfil, useAtualizarPerfil, useAlterarSenha, useEmpresasVinculadas,
} from '@/hooks/useEmpresa'

const PERFIL_LABEL: Record<string, string> = {
  ADMIN: 'Administrador', PERSONALIZADO: 'Personalizado',
}

const STATUS_CONTA_LABEL: Record<string, string> = {
  ATIVO: 'Ativo', INATIVO: 'Inativo', CONVIDADO: 'Convite pendente',
}

const STATUS_TENANT_LABEL: Record<string, string> = {
  ATIVO: 'Ativa', SUSPENSO: 'Suspensa', AGUARDANDO: 'Aguardando ativação',
}

export default function PerfilPage() {
  const { session, atualizarUsuarioSessao } = useAppAuth()
  const { data: perfil, isLoading } = useMeuPerfil()
  const atualizarPerfil = useAtualizarPerfil()
  const { data: empresasData, isLoading: carregandoEmpresas } = useEmpresasVinculadas()
  const alterarSenha = useAlterarSenha()

  // ── Dados pessoais ──────────────────────────────────────────
  const [nome, setNome] = useState('')
  const [foto, setFoto] = useState<{ file: File | null; preview: string }>({ file: null, preview: '' })
  const [salvandoDados, setSalvandoDados] = useState(false)

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome)
      setFoto({ file: null, preview: perfil.avatarUrl ?? '' })
    }
  }, [perfil])

  function onSelecionarFoto(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter até 5MB.'); return }
    setFoto({ file, preview: URL.createObjectURL(file) })
  }

  async function handleSalvarDados(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { toast.error('Nome é obrigatório.'); return }
    setSalvandoDados(true)
    try {
      let avatarUrl = perfil?.avatarUrl
      if (foto.file && session?.tenantId && perfil?.id) {
        const { uploadAvatar } = await import('@/lib/storage')
        const up = await uploadAvatar({ tenantId: session.tenantId, usuarioId: perfil.id, file: foto.file })
        avatarUrl = up.url
      }
      const atualizado = await atualizarPerfil.mutateAsync({ nome: nome.trim(), avatarUrl })
      atualizarUsuarioSessao({ nome: atualizado.nome, avatarUrl: atualizado.avatarUrl })
      setFoto(f => ({ file: null, preview: atualizado.avatarUrl ?? f.preview }))
      toast.success('Dados atualizados!')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao salvar dados.'))
    } finally {
      setSalvandoDados(false)
    }
  }

  // ── Segurança / senha ───────────────────────────────────────
  const [senhaAtual, setSenhaAtual]     = useState('')
  const [novaSenha, setNovaSenha]       = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!senhaAtual || !novaSenha) { toast.error('Preencha a senha atual e a nova senha.'); return }
    if (novaSenha.length < 8) { toast.error('A nova senha deve ter pelo menos 8 caracteres.'); return }
    if (novaSenha !== confirmarSenha) { toast.error('A confirmação não confere com a nova senha.'); return }
    try {
      await alterarSenha.mutateAsync({ senhaAtual, novaSenha })
      toast.success('Senha alterada!')
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao alterar senha.'))
    }
  }

  const empresas = empresasData?.empresas ?? []

  return (
    <div className="main">
      <Topbar titulo="Meu perfil" subtitulo="Seus dados, empresas vinculadas, senha e assinatura digital" />
      <div className="content">

        {/* ══ Dados pessoais ══ */}
        <Secao numero={1} titulo="Dados pessoais">
          {isLoading ? <Skeleton h={90} /> : (
            <form onSubmit={handleSalvarDados}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <label style={{ cursor: 'pointer', position: 'relative' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: 'var(--bga)', color: 'var(--ta)', border: '.5px solid var(--bs)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600,
                  }}>
                    {foto.preview
                      ? <img src={foto.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (nome.split(' ').slice(0, 2).map(n => n[0]).join('') || 'U')}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--ta)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, border: '2px solid var(--s2)',
                  }}>
                    <i className="ti ti-camera" />
                  </div>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onSelecionarFoto(f) }} />
                </label>
                <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                  Clique na foto para trocar. JPG ou PNG, até 5MB.
                </div>
              </div>

              <div className="g3">
                <Field label="Nome">
                  <Input value={nome} onChange={e => setNome(e.target.value)} />
                </Field>
                <Field label="E-mail">
                  <Input value={perfil?.email ?? ''} disabled />
                </Field>
                <Field label="Função">
                  <Input value={perfil?.funcao || '—'} disabled title="Definida pelo administrador em Usuários" />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-p btn-sm" type="submit" disabled={salvandoDados}>
                  <i className={`ti ${salvandoDados ? 'ti-loader' : 'ti-device-floppy'}`}
                    style={salvandoDados ? { animation: 'spin 1s linear infinite' } : {}} />
                  {salvandoDados ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}
        </Secao>

        {/* ══ Empresas vinculadas ══ */}
        <Secao numero={2} titulo="Empresas vinculadas">
          {carregandoEmpresas ? <Skeleton h={60} /> : empresas.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ts)' }}>Nenhuma empresa encontrada para este e-mail.</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 10, lineHeight: 1.6 }}>
                Empresas onde existe uma conta com o e-mail <strong style={{ color: 'var(--tp)' }}>{perfil?.email}</strong>.
                Cada uma tem seu próprio perfil de acesso e senha.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {empresas.map(emp => (
                  <div key={emp.tenantId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '9px 12px', borderRadius: 'var(--r)', background: 'var(--s1)',
                    border: emp.atual ? '.5px solid var(--ba)' : '.5px solid var(--b)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 'var(--r)', flexShrink: 0,
                        background: 'var(--bga)', color: 'var(--ta)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                      }}>
                        <i className="ti ti-building-skyscraper" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {emp.nome}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ts)' }}>
                          {PERFIL_LABEL[emp.perfil] ?? emp.perfil} · {STATUS_CONTA_LABEL[emp.statusConta] ?? emp.statusConta}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {emp.tenantStatus !== 'ATIVO' && (
                        <Badge variant="warn">{STATUS_TENANT_LABEL[emp.tenantStatus] ?? emp.tenantStatus}</Badge>
                      )}
                      {emp.atual && <Badge variant="blue">Empresa atual</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Secao>

        {/* ══ Segurança ══ */}
        <Secao numero={3} titulo="Segurança">
          <form onSubmit={handleAlterarSenha}>
            <div className="g3">
              <Field label="Senha atual">
                <Input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="Nova senha">
                <Input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field label="Confirmar nova senha">
                <Input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--tm)', marginBottom: 10 }}>Mínimo de 8 caracteres.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-p btn-sm" type="submit" disabled={alterarSenha.isPending}>
                <i className={`ti ${alterarSenha.isPending ? 'ti-loader' : 'ti-lock'}`}
                  style={alterarSenha.isPending ? { animation: 'spin 1s linear infinite' } : {}} />
                {alterarSenha.isPending ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </Secao>

        {/* ══ Assinatura digital ══ */}
        <Secao numero={4} titulo="Assinatura digital">
          <AssinaturaCanvas />
        </Secao>

      </div>
    </div>
  )
}
