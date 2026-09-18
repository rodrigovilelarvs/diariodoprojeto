'use client'
// app/(app)/rdos/[id]/FormularioRdo.tsx
// Formulário RDO completo — 9 seções — conectado ao backend

import {
  useState, useEffect, useCallback, useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRdo, useSalvarRdo, useEnviarRdo, useMinhaAssinatura, useEnviarComentario, useExcluirComentario, useEap, useFuncoes, useCriarFuncao, useEquipamentosCadastro, useCriarEquipamentoCadastro, useOcorrenciaTipos, useCriarOcorrenciaTipo, useExcluirRdo } from '@/hooks/useEmpresa'
import { useAppAuth } from '@/contexts/AuthContext'
import { api, LimitePlanoError, mensagemErro } from '@/lib/api'
import { gerarPdfRdo }   from '@/lib/pdf'
import { numeroRdo, fmtData } from '@/lib/format'
import type {
  MaoDeObraItem, EquipamentoItem, OcorrenciaItem,
  RegistroAtividade, ClimaCondicao, AssinaturaItem, MidiaItem, Rdo,
  MaoDeObraCategoria, EquipamentoTipo,
} from '@/lib/types'
import { UploadZona } from '@/components/rdos/UploadZona'
import {
  CLIMA, CLIMA_NOITE, CLIMA_L, CLIMAS,
  CATEGORIA_L, CATEGORIAS, EQUIPAMENTO_TIPO_L, EQUIPAMENTO_TIPOS,
  calcHH, calcMoHH, calcPrazo, calcOcDur,
} from '@/lib/rdo-display'

// ── Props ──────────────────────────────────────────────────
interface Props { rdoId: string }

// ── Estado local ───────────────────────────────────────────
interface FormState {
  numero:             number
  data:               string
  horaInicio:         string
  horaTermino:        string
  intervaloHoras:     number
  climaManha?:        ClimaCondicao
  climaTarde?:        ClimaCondicao
  climaNoite?:        ClimaCondicao | null
  precipitacaoMm:     number
  climaImpacto:       string
  observacoes:        string
  atividadeRegistros: RegistroAtividade[]
  maoDeObra:          MaoDeObraItem[]
  equipamentos:       EquipamentoItem[]
  ocorrencias:        OcorrenciaItem[]
}

function estadoInicial(rdo: NonNullable<ReturnType<typeof useRdo>['data']>): FormState {
  return {
    numero:             rdo.numero,
    data:               new Date(rdo.data).toISOString().slice(0, 10),
    horaInicio:         rdo.horaInicio     ?? '07:00',
    horaTermino:        rdo.horaTermino    ?? '17:00',
    intervaloHoras:     Number(rdo.intervaloHoras ?? 1),
    climaManha:         rdo.climaManha,
    climaTarde:         rdo.climaTarde,
    climaNoite:         rdo.climaNoite ?? null,
    precipitacaoMm:     Number(rdo.precipitacaoMm ?? 0),
    climaImpacto:       rdo.climaImpacto   ?? 'NENHUM',
    observacoes:        rdo.observacoes    ?? '',
    // Os arrays podem vir ausentes quando o RDO é lido do cache logo após
    // ser criado (a resposta do POST não traz todas as relações) — o form
    // precisa sempre ter arrays pra não quebrar a renderização.
    atividadeRegistros: (rdo.atividadeRegistros ?? []).map((r) => ({
      id:          r.id,
      atividadeId: r.atividadeId,
      pctAnterior: r.pctAnterior,
      pctAtual:    r.pctAtual,
      deltaHoje:   r.deltaHoje,
      avulsa:      r.avulsa,
      avulsaEtapa: r.avulsaEtapa,
      avulsaNome:  r.avulsaNome,
      atividade:   r.atividade,
    })),
    maoDeObra:    (rdo.maoDeObra ?? []).map((mo) => ({
      ...mo,
      totalHH: calcMoHH(mo.horaEntrada, mo.horaSaida, Number(rdo.intervaloHoras ?? 1), mo.quantidade),
    })),
    equipamentos: rdo.equipamentos ?? [],
    ocorrencias:  rdo.ocorrencias ?? [],
  }
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export function FormularioRdo({ rdoId }: Props) {
  const router     = useRouter()
  const { pode, session } = useAppAuth()
  const { data: rdo, isLoading, isError } = useRdo(rdoId)
  const salvar     = useSalvarRdo()
  const enviar     = useEnviarRdo()
  const excluirRdo = useExcluirRdo()
  const { data: minhaAssinaturaData } = useMinhaAssinatura()
  const enviarComentario = useEnviarComentario()
  const excluirComentario = useExcluirComentario()
  const { data: eap } = useEap(rdo?.projeto.id ?? '')
  const { data: funcoes } = useFuncoes()
  const criarFuncao = useCriarFuncao()
  const { data: equipamentosCadastro } = useEquipamentosCadastro()
  const criarEquipamentoCadastro = useCriarEquipamentoCadastro()
  const { data: ocorrenciaTipos } = useOcorrenciaTipos()
  const criarOcorrenciaTipo = useCriarOcorrenciaTipo()

  const [form, setForm]       = useState<FormState | null>(null)
  const [dirty, setDirty]     = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [noiteAtiva, setNoiteAtiva] = useState(false)
  const [modalAtividade, setModalAtividade] = useState(false)
  const [novaAvulsa, setNovaAvulsa] = useState(false)
  const [novaAtividadeId, setNovaAtividadeId] = useState('')
  const [novaEtapaTexto, setNovaEtapaTexto] = useState('')
  const [novaNomeTexto, setNovaNomeTexto] = useState('')
  const [modalFuncao, setModalFuncao] = useState(false)
  const [funcaoMoIndex, setFuncaoMoIndex] = useState<number | null>(null)
  const [novaFuncaoNome, setNovaFuncaoNome] = useState('')
  const [novaFuncaoCategoria, setNovaFuncaoCategoria] = useState<MaoDeObraCategoria>('DIRETA')
  const [modalEquipamento, setModalEquipamento] = useState(false)
  const [equipamentoEqIndex, setEquipamentoEqIndex] = useState<number | null>(null)
  const [novoEquipamentoNome, setNovoEquipamentoNome] = useState('')
  const [novoEquipamentoTipo, setNovoEquipamentoTipo] = useState<EquipamentoTipo>('PROPRIO')
  const [modalOcorrenciaTipo, setModalOcorrenciaTipo] = useState(false)
  const [ocorrenciaTipoOcIndex, setOcorrenciaTipoOcIndex] = useState<number | null>(null)
  const [novoOcorrenciaTipoNome, setNovoOcorrenciaTipoNome] = useState('')
  const autoSaveTimer         = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Inicializa form quando RDO carrega
  useEffect(() => {
    if (rdo && !form) {
      setForm(estadoInicial(rdo))
      if (rdo.climaNoite) setNoiteAtiva(true)
    }
  }, [rdo, form])

  // Auto-save 30s
  const agendarAutoSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (dirty && form) handleSalvar(form, false)
    }, 30_000)
  }, [dirty, form])

  useEffect(() => {
    if (dirty) agendarAutoSave()
    return () => clearTimeout(autoSaveTimer.current)
  }, [dirty, agendarAutoSave])

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm(f => f ? { ...f, [campo]: valor } : f)
    setDirty(true)
  }

  // O intervalo é um input direto da fórmula de H/H de TODA a mão de obra já
  // lançada (diferente de horaInicio/horaTermino, que só servem de valor
  // inicial pra novas linhas) — por isso precisa recalcular tudo ao mudar,
  // senão o totalHH salvo fica obsoleto (bug identificado em produção).
  function setIntervalo(valor: number) {
    setForm(f => {
      if (!f) return f
      const maoDeObra = f.maoDeObra.map(m => ({
        ...m,
        totalHH: calcMoHH(m.horaEntrada, m.horaSaida, valor, m.quantidade),
      }))
      return { ...f, intervaloHoras: valor, maoDeObra }
    })
    setDirty(true)
  }

  function setPct(index: number, pctAtual: number) {
    setForm(f => {
      if (!f) return f
      return {
        ...f,
        atividadeRegistros: f.atividadeRegistros.map((r, i) =>
          i === index
            ? { ...r, pctAtual, deltaHoje: pctAtual - r.pctAnterior }
            : r,
        ),
      }
    })
    setDirty(true)
  }

  function abrirModalAtividade() {
    setNovaAvulsa(false)
    setNovaAtividadeId('')
    setNovaEtapaTexto('')
    setNovaNomeTexto('')
    setModalAtividade(true)
  }

  function addAtividade() {
    if (novaAvulsa) {
      if (!novaEtapaTexto.trim() || !novaNomeTexto.trim()) {
        toast.error('Informe a etapa e o nome da atividade avulsa.')
        return
      }
      setForm(f => f ? {
        ...f,
        atividadeRegistros: [...f.atividadeRegistros, {
          pctAnterior: 0, pctAtual: 0, deltaHoje: 0,
          avulsa: true, avulsaEtapa: novaEtapaTexto.trim(), avulsaNome: novaNomeTexto.trim(),
        }],
      } : f)
    } else {
      if (!novaAtividadeId) { toast.error('Selecione uma atividade.'); return }
      const atividade = eap?.etapas.flatMap(e => e.atividades.map(a => ({ ...a, etapa: e }))).find(a => a.id === novaAtividadeId)
      if (!atividade) return
      setForm(f => f ? {
        ...f,
        atividadeRegistros: [...f.atividadeRegistros, {
          atividadeId: atividade.id,
          pctAnterior: atividade.pctAcumulado, pctAtual: atividade.pctAcumulado, deltaHoje: 0,
          atividade: atividade as any,
        }],
      } : f)
    }
    setDirty(true)
    setModalAtividade(false)
  }

  function removeAtividade(index: number) {
    setForm(f => f ? { ...f, atividadeRegistros: f.atividadeRegistros.filter((_, i) => i !== index) } : f)
    setDirty(true)
  }

  async function handleSalvar(estado: FormState, showToast = true) {
    if (!rdo || rdo.status === 'APROVADO') return
    try {
      await salvar.mutateAsync({ id: rdoId, ...estado })
      setDirty(false)
      // Atividades avulsas recém-criadas ainda não têm id local — busca o RDO
      // atualizado e sincroniza os ids para evitar duplicar no próximo auto-save
      if (estado.atividadeRegistros.some(r => r.avulsa && !r.id)) {
        const fresco = await api.get<Rdo>(`/api/app/rdos/${rdoId}`)
        setForm(f => f ? {
          ...f,
          atividadeRegistros: fresco.atividadeRegistros.map(r => ({
            id: r.id, atividadeId: r.atividadeId, pctAnterior: r.pctAnterior,
            pctAtual: r.pctAtual, deltaHoje: r.deltaHoje, avulsa: r.avulsa,
            avulsaEtapa: r.avulsaEtapa, avulsaNome: r.avulsaNome, atividade: r.atividade,
          })),
        } : f)
      }
      if (showToast) toast.success('Rascunho salvo!')
    } catch { if (showToast) toast.error('Erro ao salvar.') }
  }

  async function handleEnviar() {
    if (!form) return
    try {
      await salvar.mutateAsync({ id: rdoId, ...form })
      const res = await enviar.mutateAsync(rdoId)
      toast.success(`RDO #${numeroRdo(rdo?.numero ?? 0)} enviado para ${res.aprovadores} aprovador(es)!`)
      router.push('/rdos')
    } catch (err) {
      if (err instanceof LimitePlanoError) toast.error(err.message)
      else toast.error('Erro ao enviar RDO.')
    }
  }

  async function handleExcluir() {
    if (!rdo) return
    if (!window.confirm(`Excluir o RDO #${numeroRdo(rdo.numero)}? Essa ação não pode ser desfeita.`)) return
    try {
      await excluirRdo.mutateAsync(rdoId)
      toast.success('RDO excluído.')
      router.push('/rdos')
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao excluir RDO.'))
    }
  }

  // ── MO helpers ─────────────────────────────────────────
  function addMO() {
    setForm(f => {
      if (!f) return f
      const horaEntrada = f.horaInicio ?? '07:00'
      const horaSaida   = f.horaTermino ?? '17:00'
      return { ...f, maoDeObra: [...f.maoDeObra, {
        funcaoNome: '', categoria: 'DIRETA', quantidade: 1,
        horaEntrada, horaSaida,
        totalHH: calcMoHH(horaEntrada, horaSaida, f.intervaloHoras, 1),
      }] }
    })
    setDirty(true)
  }
  function updMO(idx: number, campo: keyof MaoDeObraItem, val: string | number) {
    setForm(f => {
      if (!f) return f
      const mo = [...f.maoDeObra]
      mo[idx] = { ...mo[idx], [campo]: val }
      mo[idx].totalHH = calcMoHH(mo[idx].horaEntrada, mo[idx].horaSaida, f.intervaloHoras, mo[idx].quantidade)
      return { ...f, maoDeObra: mo }
    })
    setDirty(true)
  }
  function selecionarFuncao(idx: number, funcaoCadastroId: string) {
    if (funcaoCadastroId === '__nova__') {
      setFuncaoMoIndex(idx)
      setNovaFuncaoNome('')
      setNovaFuncaoCategoria('DIRETA')
      setModalFuncao(true)
      return
    }
    const funcao = funcoes?.find(fn => fn.id === funcaoCadastroId)
    if (!funcao) return
    setForm(f => {
      if (!f) return f
      const mo = [...f.maoDeObra]
      mo[idx] = { ...mo[idx], funcaoCadastroId: funcao.id, funcaoNome: funcao.nome, categoria: funcao.categoria }
      return { ...f, maoDeObra: mo }
    })
    setDirty(true)
  }
  async function criarNovaFuncao() {
    const nome = novaFuncaoNome.trim()
    if (!nome) { toast.error('Informe o nome da função.'); return }
    try {
      const funcao = await criarFuncao.mutateAsync({ nome, categoria: novaFuncaoCategoria })
      if (funcaoMoIndex !== null) {
        setForm(f => {
          if (!f) return f
          const mo = [...f.maoDeObra]
          mo[funcaoMoIndex] = { ...mo[funcaoMoIndex], funcaoCadastroId: funcao.id, funcaoNome: funcao.nome, categoria: funcao.categoria }
          return { ...f, maoDeObra: mo }
        })
        setDirty(true)
      }
      setModalFuncao(false)
    } catch {
      toast.error('Erro ao criar função.')
    }
  }
  function removeMO(idx: number) {
    setForm(f => f ? { ...f, maoDeObra: f.maoDeObra.filter((_,i)=>i!==idx) } : f)
    setDirty(true)
  }
  const totalHH = (form?.maoDeObra ?? []).reduce((s,m) => s + Number(m.totalHH), 0)
  const hhPorCategoriaMO = CATEGORIAS.map(cat => ({
    categoria: cat,
    totalHH:   (form?.maoDeObra ?? []).filter(m => (m.categoria ?? 'DIRETA') === cat).reduce((s,m) => s + Number(m.totalHH), 0),
    totalPessoas: (form?.maoDeObra ?? []).filter(m => (m.categoria ?? 'DIRETA') === cat).reduce((s,m) => s + Number(m.quantidade), 0),
  })).filter(c => c.totalPessoas > 0)
  const totalEQ = (form?.equipamentos ?? []).reduce((s,e) => s + Number(e.quantidade), 0)

  // ── EQ helpers ─────────────────────────────────────────
  function addEQ() {
    setForm(f => f ? { ...f, equipamentos: [...f.equipamentos, {
      equipamentoNome: '', quantidade: 1,
    }] } : f)
    setDirty(true)
  }
  function selecionarEquipamento(idx: number, equipamentoCadastroId: string) {
    if (equipamentoCadastroId === '__novo__') {
      setEquipamentoEqIndex(idx)
      setNovoEquipamentoNome('')
      setNovoEquipamentoTipo('PROPRIO')
      setModalEquipamento(true)
      return
    }
    const equipamento = equipamentosCadastro?.find(eq => eq.id === equipamentoCadastroId)
    if (!equipamento) return
    setForm(f => {
      if (!f) return f
      const eq = [...f.equipamentos]
      eq[idx] = { ...eq[idx], equipamentoCadastroId: equipamento.id, equipamentoNome: equipamento.nome }
      return { ...f, equipamentos: eq }
    })
    setDirty(true)
  }
  async function criarNovoEquipamento() {
    const nome = novoEquipamentoNome.trim()
    if (!nome) { toast.error('Informe o nome do equipamento.'); return }
    try {
      const equipamento = await criarEquipamentoCadastro.mutateAsync({ nome, tipo: novoEquipamentoTipo })
      if (equipamentoEqIndex !== null) {
        setForm(f => {
          if (!f) return f
          const eq = [...f.equipamentos]
          eq[equipamentoEqIndex] = { ...eq[equipamentoEqIndex], equipamentoCadastroId: equipamento.id, equipamentoNome: equipamento.nome }
          return { ...f, equipamentos: eq }
        })
        setDirty(true)
      }
      setModalEquipamento(false)
    } catch {
      toast.error('Erro ao criar equipamento.')
    }
  }
  function updEQ(idx: number, campo: keyof EquipamentoItem, val: string | number) {
    setForm(f => {
      if (!f) return f
      const eq = [...f.equipamentos]
      eq[idx] = { ...eq[idx], [campo]: val }
      return { ...f, equipamentos: eq }
    })
    setDirty(true)
  }
  function removeEQ(idx: number) {
    setForm(f => f ? { ...f, equipamentos: f.equipamentos.filter((_,i)=>i!==idx) } : f)
    setDirty(true)
  }

  // ── OC helpers ─────────────────────────────────────────
  function addOC() {
    setForm(f => f ? { ...f, ocorrencias: [...f.ocorrencias, {
      tipo: '',
      descricao: '',
    }] } : f)
    setDirty(true)
  }
  function selecionarOcorrenciaTipo(idx: number, valor: string) {
    if (valor === '__novo__') {
      setOcorrenciaTipoOcIndex(idx)
      setNovoOcorrenciaTipoNome('')
      setModalOcorrenciaTipo(true)
      return
    }
    updOC(idx, 'tipo', valor)
  }
  async function criarNovoOcorrenciaTipo() {
    const nome = novoOcorrenciaTipoNome.trim()
    if (!nome) { toast.error('Informe o nome do tipo de ocorrência.'); return }
    try {
      const tipo = await criarOcorrenciaTipo.mutateAsync({ nome })
      if (ocorrenciaTipoOcIndex !== null) updOC(ocorrenciaTipoOcIndex, 'tipo', tipo.nome)
      setModalOcorrenciaTipo(false)
    } catch {
      toast.error('Erro ao criar tipo de ocorrência.')
    }
  }
  function updOC(idx: number, campo: keyof OcorrenciaItem, val: string) {
    setForm(f => {
      if (!f) return f
      const oc = [...f.ocorrencias]
      oc[idx] = { ...oc[idx], [campo]: val }
      if (campo === 'horaInicio' || campo === 'horaTermino') {
        const i = oc[idx].horaInicio ?? '', fi = oc[idx].horaTermino ?? ''
        if (i && fi) {
          const [ih,im]=i.split(':').map(Number), [fh,fm]=fi.split(':').map(Number)
          let m=(fh*60+fm)-(ih*60+im); if(m<0)m+=1440
          oc[idx].duracaoMin = m
        }
      }
      return { ...f, ocorrencias: oc }
    })
    setDirty(true)
  }
  function removeOC(idx: number) {
    setForm(f => f ? { ...f, ocorrencias: f.ocorrencias.filter((_,i)=>i!==idx) } : f)
    setDirty(true)
  }


  // ── Comentários ────────────────────────────────────────
  const cmtRef = useRef<HTMLTextAreaElement>(null)

  async function enviarCmt() {
    const txt = cmtRef.current?.value.trim()
    if (!txt) return
    try {
      await enviarComentario.mutateAsync({ rdoId, texto: txt })
      toast.success('Comentário enviado!')
      if (cmtRef.current) cmtRef.current.value = ''
    } catch {
      toast.error('Erro ao enviar comentário.')
    }
  }

  async function handleExcluirComentario(comentarioId: string) {
    if (!window.confirm('Excluir este comentário?')) return
    try {
      await excluirComentario.mutateAsync({ rdoId, comentarioId })
    } catch {
      toast.error('Erro ao excluir comentário.')
    }
  }

  // ── Render guards ──────────────────────────────────────
  if (isLoading) return <div className="content" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ts)'}}>Carregando RDO...</div>
  if (isError || !rdo) return <div className="content" style={{color:'var(--td)'}}>RDO não encontrado.</div>
  if (!form) return null

  const somenteLeitura = rdo.status === 'APROVADO'
  const midiasIniciais: MidiaItem[] = rdo.midias ?? []
  const podeSalvar     = pode('emitir_rdo') && !somenteLeitura
  const podeEnviar     = pode('emitir_rdo') && rdo.status === 'RASCUNHO'
  const prazo          = calcPrazo(rdo.projeto.dataInicioContrato, rdo.projeto.dataFimContrato, rdo.data)
  const totalTrabalho  = calcHH(form.horaInicio, form.horaTermino, form.intervaloHoras)

  const minhaSigSalva = minhaAssinaturaData?.assinatura?.imagemUrl

  // Enquanto o RDO ainda é rascunho, ninguém assina — inclusive o emissor. As
  // assinaturas só existem de fato (registros por aprovador) depois do envio
  // para aprovação (ver app/api/app/rdos/[id]/enviar/route.ts). Antes disso,
  // mostramos apenas os campos vazios conforme a configuração do projeto.
  const enviado = rdo.status !== 'RASCUNHO'

  let signatarios: {
    id: string; nome: string; cargo: string
    meu: boolean; signed: boolean
    imagemPadrao?: string | null
    bloqueado: boolean
  }[]
  let avisoPreEnvio: string | null = null

  if (enviado) {
    signatarios = (rdo.assinaturas ?? []).map((a: AssinaturaItem) => {
      const meu = a.usuario.id === session?.usuario.id
      return {
        id: a.id, nome: a.usuario.nome, cargo: a.cargo,
        meu, signed: a.status === 'ASSINADO',
        imagemPadrao: meu ? minhaSigSalva : a.assinaturaDigital?.imagemUrl,
        bloqueado: false,
      }
    })
  } else if (rdo.projeto.assinaturaModo === 'DEFINIDA') {
    const definidos = [rdo.projeto.assinante1, rdo.projeto.assinante2, rdo.projeto.assinante3]
      .filter((a): a is NonNullable<typeof a> => !!a)
    signatarios = definidos.map((a, i) => ({
      id: `pre-${i}`, nome: a.nome, cargo: 'Aprovador', meu: false, signed: false, imagemPadrao: null, bloqueado: true,
    }))
    if (definidos.length === 0) {
      avisoPreEnvio = 'Nenhum aprovador definido para este projeto. Configure em Configurações do projeto → Assinaturas.'
    }
  } else {
    signatarios = []
    avisoPreEnvio = 'Aprovação aberta — qualquer aprovador da empresa poderá assinar após o envio deste RDO.'
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* ── Voltar à pasta do projeto ── */}
      <div style={{ padding:'8px 16px', borderBottom:'.5px solid var(--b)', flexShrink:0 }}>
        <button className="btn btn-sm" onClick={() => router.push(`/projetos/${rdo.projeto.id}`)}>
          <i className="ti ti-folder" /> Voltar à pasta do projeto
        </button>
      </div>

      {/* ── Banner aprovado ── */}
      {somenteLeitura && (
        <div style={{ background:'rgba(76,175,125,.1)', border:'.5px solid rgba(76,175,125,.3)', padding:'8px 16px', fontSize:11, color:'var(--tsu)', display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
          <i className="ti ti-circle-check" /> RDO aprovado — somente leitura
        </div>
      )}

      <div className="content">

        {/* ── Banner cópia ── */}
        {rdo.status === 'RASCUNHO' && rdo.atividadeRegistros.length > 0 && (
          <div style={{ background:'var(--bga)', border:'.5px solid var(--ba)', borderRadius:12, padding:'12px 14px', marginBottom:10, display:'flex', gap:11 }}>
            <i className="ti ti-copy" style={{ fontSize:20, color:'var(--ta)', flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--ta)', marginBottom:3 }}>
                Dados do RDO anterior carregados
              </div>
              <div style={{ fontSize:11, color:'var(--ts)' }}>
                Atividades concluídas removidas · % acumulado mantido · Revise antes de enviar
              </div>
            </div>
          </div>
        )}

        {/* ══ SEC 1 — Identificação ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">1</span>
            <span className="sec-title">Identificação</span>
          </div>
          <div className="sec-body">
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <div className="fr" style={{ flex:'0 0 84px' }}>
                <label className="fl">Nº do RDO</label>
                {podeSalvar ? (
                  <input className="fi" type="number" min={1} value={form.numero}
                    style={{ fontWeight:600 }}
                    onChange={e => set('numero', Number(e.target.value))} />
                ) : (
                  <div className="fi" style={{ background:'var(--s2)', color:'var(--ta)', fontWeight:600, cursor:'default' }}>
                    #{numeroRdo(rdo.numero)}
                  </div>
                )}
              </div>
              <div className="fr" style={{ flex:'0 0 150px' }}>
                <label className="fl">Data</label>
                {podeSalvar ? (
                  <>
                    <input className="fi" type="date" value={form.data}
                      onChange={e => set('data', e.target.value)} />
                    <div style={{ fontSize:10, color:'var(--tm)', marginTop:3 }}>
                      {form.data && fmtData(form.data, { weekday: 'long' })}
                    </div>
                  </>
                ) : (
                  <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                    {fmtData(rdo.data)} · {fmtData(rdo.data, { weekday: 'long' })}
                  </div>
                )}
              </div>
              <div className="fr" style={{ flex:'1 1 auto', minWidth:0 }}>
                <label className="fl">Projeto</label>
                <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default', whiteSpace:'normal', wordBreak:'break-word', lineHeight:1.35 }}>
                  {rdo.projeto.nome}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              {rdo.projeto.pedidoCompraContrato && (
                <div className="fr" style={{ flex:'1 1 200px' }}>
                  <label className="fl">Pedido de compra ou contrato</label>
                  <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                    {rdo.projeto.pedidoCompraContrato}
                  </div>
                </div>
              )}
              {rdo.projeto.empresaContratada && (
                <div className="fr" style={{ flex:'1 1 200px' }}>
                  <label className="fl">Empresa contratada</label>
                  <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                    {rdo.projeto.empresaContratada}
                  </div>
                </div>
              )}
              <div className="fr" style={{ flex:'1 1 200px' }}>
                <label className="fl">Gestor do Projeto</label>
                <div className="fi" style={{ background:'var(--s2)', color:'var(--ts)', cursor:'default' }}>
                  {rdo.emissor.nome}
                </div>
              </div>
              {prazo && (
                <div style={{ flex:'2 1 340px', background:'var(--bga)', border:'.5px solid var(--ba)', borderRadius:'var(--r)', padding:'8px 12px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Prazo contratual</div>
                    <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.inicio} a {prazo.fim}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Decorridos</div>
                    <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.decorridos}d ({prazo.pctDecorrido}%)</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:'var(--ta)', marginBottom:2 }}>Restantes</div>
                    <div style={{ fontSize:11, fontWeight:500, color:'var(--ta)' }}>{prazo.restantes}d</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ SEC 2 — Clima ══ */}
        <div className="sec">
          <div className="sec-h"><span className="sec-num">2</span><span className="sec-title">Condições climáticas</span></div>
          <div className="sec-body">
            <div className="g2">
              {(['Manhã','Tarde'] as const).map((p, pi) => {
                const campo = pi === 0 ? 'climaManha' : 'climaTarde'
                return (
                  <div key={p}>
                    <label className="fl">{p}</label>
                    <div className="cg4">
                      {CLIMAS.map(c => (
                        <button key={c} disabled={!podeSalvar}
                          className={`cb ${form[campo] === c ? 'on' : ''}`}
                          onClick={() => set(campo, c as ClimaCondicao)}
                        >
                          <span style={{ fontSize:18 }}>{CLIMA[c]}</span>
                          <span>{CLIMA_L[c]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {noiteAtiva ? (
              <div style={{ marginTop:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <label className="fl">Noite</label>
                  {podeSalvar && (
                    <button type="button" onClick={() => { setNoiteAtiva(false); set('climaNoite', null) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:10, display:'flex', alignItems:'center', gap:3 }}>
                      <i className="ti ti-x" /> Remover turno da noite
                    </button>
                  )}
                </div>
                <div className="cg4">
                  {CLIMAS.map(c => (
                    <button key={c} disabled={!podeSalvar}
                      className={`cb ${form.climaNoite === c ? 'on' : ''}`}
                      onClick={() => set('climaNoite', c as ClimaCondicao)}
                    >
                      <span style={{ fontSize:18 }}>{CLIMA_NOITE[c]}</span>
                      <span>{CLIMA_L[c]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : podeSalvar && (
              <button type="button" className="btn btn-sm" style={{ marginTop:8 }} onClick={() => setNoiteAtiva(true)}>
                <i className="ti ti-plus" /> Adicionar turno da noite
              </button>
            )}

            <div className="g2" style={{ marginTop:8 }}>
              <div className="fr">
                <label className="fl">Precipitação (mm)</label>
                <input className="fi" type="number" min={0} step={0.1}
                  value={form.precipitacaoMm} disabled={!podeSalvar}
                  onChange={e => set('precipitacaoMm', Number(e.target.value))} />
              </div>
              <div className="fr">
                <label className="fl">Impacto no serviço</label>
                <select className="fi" value={form.climaImpacto} disabled={!podeSalvar}
                  onChange={e => set('climaImpacto', e.target.value)}>
                  <option value="NENHUM">Nenhum</option>
                  <option value="PARCIAL">Parcial</option>
                  <option value="TOTAL">Total — paralisado</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ══ SEC 3 — Atividade, horários e % ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">3</span>
            <span className="sec-title">Atividade, horários e progresso</span>
            {form.atividadeRegistros.length > 0 && (
              <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                {form.atividadeRegistros.length} atividade{form.atividadeRegistros.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="sec-body">
            <div className="g4">
              {[
                { l:'Início', k:'horaInicio' }, { l:'Término', k:'horaTermino' },
              ].map(({ l, k }) => (
                <div className="fr" key={k}>
                  <label className="fl">{l}</label>
                  <input className="fi" type="time" value={form[k as 'horaInicio']}
                    disabled={!podeSalvar}
                    onChange={e => set(k as 'horaInicio', e.target.value)} />
                </div>
              ))}
              <div className="fr">
                <label className="fl">Intervalo (h)</label>
                <input className="fi" type="number" min={0} step={0.5}
                  value={form.intervaloHoras} disabled={!podeSalvar}
                  onChange={e => setIntervalo(Number(e.target.value))} />
              </div>
              <div className="fr">
                <label className="fl">Total trabalhado</label>
                <div className="fi" style={{ background:'var(--bga)', color:'var(--ta)', fontWeight:600, cursor:'default' }}>
                  {totalTrabalho}
                </div>
              </div>
            </div>

            {/* % Acumulado por atividade */}
            {form.atividadeRegistros.map((reg, ri) => {
              const ativ = reg.atividade
              const pct  = reg.pctAtual
              const cor  = pct >= 90 ? 'var(--fsu)' : pct >= 60 ? 'var(--fa)' : pct > 0 ? 'var(--fw)' : 'var(--tm)'
              const etapaLabel = reg.avulsa
                ? (reg.avulsaEtapa ?? 'Avulsa')
                : ativ?.etapa ? `${ativ.etapa.numero} · ${ativ.etapa.nome}` : ''
              const atividadeLabel = reg.avulsa
                ? (reg.avulsaNome ?? '')
                : ativ ? `${ativ.numero} · ${ativ.nome}` : `Atividade ${ri+1}`

              return (
                <div key={reg.atividadeId ?? ri} className="acb">
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:'50%', display:'flex', flexDirection:'column', gap:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5, minWidth:0 }}>
                        <i className="ti ti-trending-up" style={{ color:'var(--ta)', flexShrink:0, fontSize:11 }} />
                        <span style={{ fontSize:10, color:'var(--tm)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{etapaLabel}</span>
                      </div>
                      <span style={{ fontSize:11, color:'var(--ts)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingLeft:16 }}>{atividadeLabel}</span>
                    </div>
                    <div style={{ flex:1, minWidth:120 }}>
                      <div className="pt-bg">
                        <div className="pt-f" style={{ width:`${pct}%`, background: cor }} />
                      </div>
                      <input type="range" className="pct-range" style={{ marginBottom:0 }}
                        min={reg.pctAnterior} max={100} value={pct}
                        disabled={!podeSalvar}
                        onChange={e => setPct(ri, Number(e.target.value))} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
                      <div style={{ fontSize:10, color:'var(--tm)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 8px', whiteSpace:'nowrap' }}>
                        Anterior: <strong>{reg.pctAnterior}%</strong>
                      </div>
                      <div className="pct-big" style={{ color: cor }}>{pct}%</div>
                      <div>
                        <div style={{ fontSize:10, color:'var(--tm)', marginBottom:2 }}>Ajuste fino</div>
                        <input type="number" className="fi" min={reg.pctAnterior} max={100} value={pct}
                          disabled={!podeSalvar}
                          style={{ width:68, textAlign:'center', fontSize:13, fontWeight:500 }}
                          onChange={e => setPct(ri, Math.max(reg.pctAnterior, Math.min(100, Number(e.target.value))))} />
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:10, color:'var(--tm)', marginBottom:2 }}>Avanço hoje</div>
                        <div className={`dp ${reg.deltaHoje > 0 ? 'dp-p' : 'dp-z'}`}>
                          {reg.deltaHoje >= 0 ? '+' : ''}{reg.deltaHoje}%
                        </div>
                      </div>
                      {podeSalvar && (
                        <button onClick={() => removeAtividade(ri)} title="Remover atividade deste RDO"
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:12 }}>✕</button>
                      )}
                    </div>
                  </div>

                  {/* Histórico acordeão */}
                  {(ativ?.registrosRdo?.length ?? 0) > 0 && (
                    <div style={{ marginTop:8 }}>
                      <button className={`ht-btn ${histOpen ? 'open' : ''}`}
                        onClick={() => setHistOpen(h => !h)}>
                        <i className="ti ti-history" style={{ fontSize:14, color: histOpen ? 'var(--ta)' : 'var(--tm)' }} />
                        <span className="ht-lbl">Histórico de avanço</span>
                        <div style={{ display:'flex', gap:3 }}>
                          {(ativ?.registrosRdo ?? []).slice(0,5).map((h: any, i: number) => (
                            <div key={i} className="hbw" style={{ width:34 }}>
                              <div className="hbf" style={{ width:`${h.pctAtual}%` }} />
                            </div>
                          ))}
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)' }}>{pct}%</span>
                        </div>
                        <i className="ti ti-chevron-down hch" style={{ transform: histOpen ? 'rotate(180deg)' : '' }} />
                      </button>
                      <div className={`hp ${histOpen ? 'open' : ''}`}>
                        <div className="hh"><div>Data</div><div>Progresso</div><div style={{ textAlign:'right' }}>%</div><div style={{ textAlign:'right' }}>Δ dia</div></div>
                        {(ativ?.registrosRdo ?? []).map((h: any) => (
                          <div key={h.rdo.numero} className="hr">
                            <div style={{ fontSize:11, color:'var(--ts)' }}>
                              {fmtData(h.rdo.data, {day:'2-digit',month:'2-digit'})}
                            </div>
                            <div><div className="hbw"><div className="hbf" style={{ width:`${h.pctAtual}%` }} /></div></div>
                            <div style={{ textAlign:'right', fontSize:11, fontWeight:600, color:'var(--ta)' }}>{h.pctAtual}%</div>
                            <div style={{ textAlign:'right', fontSize:10, color:'var(--tsu)' }}>+{h.deltaHoje}%</div>
                          </div>
                        ))}
                        <div className="hr hj">
                          <div style={{ fontSize:11, color:'var(--ta)', fontWeight:500 }}>Hoje</div>
                          <div><div className="hbw"><div className="hbf" style={{ width:`${pct}%`, background:'var(--fa)' }} /></div></div>
                          <div style={{ textAlign:'right', fontSize:11, fontWeight:600, color:'var(--ta)' }}>{pct}%</div>
                          <div style={{ textAlign:'right', fontSize:10, color: reg.deltaHoje > 0 ? 'var(--tsu)' : 'var(--tm)' }}>
                            {reg.deltaHoje >= 0 ? '+' : ''}{reg.deltaHoje}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {podeSalvar && (
              <button type="button" className="btn btn-sm" style={{ marginBottom:12 }} onClick={abrirModalAtividade}>
                <i className="ti ti-plus" /> Adicionar atividade
              </button>
            )}

            <div className="fr">
              <label className="fl">Observações</label>
              <textarea className="fi" rows={3} value={form.observacoes}
                disabled={!podeSalvar} placeholder="Descreva o que foi executado hoje..."
                onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ══ SEC 4 — Mão de obra ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">4</span>
            <span className="sec-title">Mão de obra</span>
            <span style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
              Total: {totalHH} H/H
            </span>
            {hhPorCategoriaMO.map(c => (
              <span key={c.categoria} style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
                {CATEGORIA_L[c.categoria]}: {c.totalPessoas}p · {c.totalHH}H/H
              </span>
            ))}
          </div>
          <div className="sec-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:10 }}>
              {form.maoDeObra.map((mo, i) => (
                <div key={i} style={{ position:'relative', border:'.5px solid var(--b)', borderRadius:'var(--r)', padding:8, background:'var(--s1)' }}>
                  {podeSalvar && (
                    <button onClick={() => removeMO(i)}
                      style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:11 }}>✕</button>
                  )}
                  <select className="mf" value={mo.funcaoCadastroId ?? ''} disabled={!podeSalvar}
                    style={{ marginBottom:6 }}
                    onChange={e => selecionarFuncao(i, e.target.value)}>
                    <option value="">{mo.funcaoNome || 'Selecione...'}</option>
                    {CATEGORIAS.map(cat => {
                      const lista = (funcoes ?? []).filter(fn => fn.categoria === cat)
                      if (!lista.length) return null
                      return (
                        <optgroup key={cat} label={CATEGORIA_L[cat]}>
                          {lista.map(fn => (
                            <option key={fn.id} value={fn.id}>{fn.nome}</option>
                          ))}
                        </optgroup>
                      )
                    })}
                    <option value="__nova__">+ Nova função...</option>
                  </select>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                    {mo.categoria ? (
                      <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>
                        {CATEGORIA_L[mo.categoria]}
                      </span>
                    ) : <span />}
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>
                      {mo.totalHH} H/H
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                      <label style={{ fontSize:10, color:'var(--tm)' }}>Qtd.</label>
                      <input className="mf" type="number" min={1} value={mo.quantidade}
                        style={{ width:38, textAlign:'center' }} disabled={!podeSalvar}
                        onChange={e => updMO(i,'quantidade',Number(e.target.value))} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:3, flex:1 }}>
                      <label style={{ fontSize:10, color:'var(--tm)' }}>Ent.</label>
                      <input className="mf" type="time" value={mo.horaEntrada} disabled={!podeSalvar}
                        style={{ width:'100%' }}
                        onChange={e => updMO(i,'horaEntrada',e.target.value)} />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:3, flex:1 }}>
                      <label style={{ fontSize:10, color:'var(--tm)' }}>Saí.</label>
                      <input className="mf" type="time" value={mo.horaSaida} disabled={!podeSalvar}
                        style={{ width:'100%' }}
                        onChange={e => updMO(i,'horaSaida',e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {podeSalvar && (
              <button className="btn btn-sm" onClick={addMO}>
                <i className="ti ti-plus" /> Adicionar mão de obra
              </button>
            )}
          </div>
        </div>

        {/* ══ SEC 5 — Equipamentos ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">5</span>
            <span className="sec-title">Equipamentos</span>
            {form.equipamentos.length > 0 && (
              <>
                <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                  {form.equipamentos.length} equipamento{form.equipamentos.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize:10, color:'var(--ta)', background:'var(--bga)', padding:'2px 7px', borderRadius:20, border:'.5px solid var(--ba)' }}>
                  Total: {totalEQ} un.
                </span>
              </>
            )}
          </div>
          <div className="sec-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:10 }}>
              {form.equipamentos.map((eq, i) => {
                const equipamentoSel = equipamentosCadastro?.find(ec => ec.id === eq.equipamentoCadastroId)
                return (
                  <div key={i} style={{ position:'relative', border:'.5px solid var(--b)', borderRadius:'var(--r)', padding:8, background:'var(--s1)' }}>
                    {podeSalvar && (
                      <button onClick={() => removeEQ(i)}
                        style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:11 }}>✕</button>
                    )}
                    <select className="mf" value={eq.equipamentoCadastroId ?? ''} disabled={!podeSalvar}
                      style={{ marginBottom:6 }}
                      onChange={e => selecionarEquipamento(i, e.target.value)}>
                      <option value="">{eq.equipamentoNome || 'Selecione...'}</option>
                      {EQUIPAMENTO_TIPOS.map(tipo => {
                        const lista = (equipamentosCadastro ?? []).filter(ec => ec.tipo === tipo)
                        if (!lista.length) return null
                        return (
                          <optgroup key={tipo} label={EQUIPAMENTO_TIPO_L[tipo]}>
                            {lista.map(ec => (
                              <option key={ec.id} value={ec.id}>{ec.nome}</option>
                            ))}
                          </optgroup>
                        )
                      })}
                      <option value="__novo__">+ Novo equipamento...</option>
                    </select>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                      {equipamentoSel ? (
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--ta)', background:'var(--bga)', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>
                          {EQUIPAMENTO_TIPO_L[equipamentoSel.tipo]}
                        </span>
                      ) : <span />}
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <label style={{ fontSize:10, color:'var(--tm)' }}>Qtd.</label>
                        <input className="mf" type="number" min={1} value={eq.quantidade}
                          style={{ width:50, textAlign:'center' }} disabled={!podeSalvar}
                          onChange={e => updEQ(i,'quantidade',Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {podeSalvar && (
              <button className="btn btn-sm" onClick={addEQ}>
                <i className="ti ti-plus" /> Adicionar equipamento
              </button>
            )}
          </div>
        </div>

        {/* ══ SEC 6 — Ocorrências ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">6</span>
            <span className="sec-title">Ocorrências</span>
            {form.ocorrencias.length > 0 && (
              <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                {form.ocorrencias.length} ocorrência{form.ocorrencias.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="sec-body">
            {form.ocorrencias.map((oc, i) => {
              const dur = oc.horaInicio && oc.horaTermino ? calcOcDur(oc.horaInicio, oc.horaTermino) : '—'
              const durMin = oc.duracaoMin ?? 0
              const durCor = durMin > 120 ? 'var(--td)' : durMin > 30 ? 'var(--tw)' : 'var(--ta)'
              return (
                <div key={i} className="oc-card">
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, padding:'8px 10px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--ta)', paddingBottom:5 }}>#{i+1}</span>
                    <div style={{ flex:'1 1 150px', minWidth:0 }}>
                      <select className="mf" value={oc.tipo || ''} disabled={!podeSalvar}
                        style={{ background:'transparent', border:'none', color:'var(--ta)', fontWeight:500, fontSize:12 }}
                        onChange={e => selecionarOcorrenciaTipo(i, e.target.value)}>
                        <option value="">{oc.tipo || 'Selecione...'}</option>
                        {(ocorrenciaTipos ?? []).map(t => (
                          <option key={t.id} value={t.nome}>{t.nome}</option>
                        ))}
                        <option value="__novo__">+ Novo tipo...</option>
                      </select>
                    </div>
                    <div style={{ flex:'0 0 100px' }}>
                      <label className="fl" style={{ marginBottom:2 }}>Início</label>
                      <input className="mf" type="time" value={oc.horaInicio ?? ''} disabled={!podeSalvar}
                        onChange={e => updOC(i,'horaInicio',e.target.value)} />
                    </div>
                    <div style={{ flex:'0 0 100px' }}>
                      <label className="fl" style={{ marginBottom:2 }}>Término</label>
                      <input className="mf" type="time" value={oc.horaTermino ?? ''} disabled={!podeSalvar}
                        onChange={e => updOC(i,'horaTermino',e.target.value)} />
                    </div>
                    <span style={{ fontSize:10, fontWeight:600, color: durCor, background:'var(--s2)', border:`.5px solid ${durCor}40`, borderRadius:20, padding:'4px 8px', whiteSpace:'nowrap', marginBottom:2 }}>
                      {dur}
                    </span>
                    {podeSalvar && (
                      <button onClick={() => removeOC(i)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:13, flexShrink:0, padding:'2px 6px 6px' }}>✕</button>
                    )}
                  </div>
                  <div style={{ padding:'0 10px 8px' }}>
                    <label className="fl">Descrição</label>
                    <textarea className="mf" rows={2} value={oc.descricao} disabled={!podeSalvar}
                      placeholder="Descreva o ocorrido..." onChange={e => updOC(i,'descricao',e.target.value)} />
                  </div>
                </div>
              )
            })}
            {podeSalvar && (
              <button className="btn btn-sm" onClick={addOC}>
                <i className="ti ti-plus" /> Registrar ocorrência
              </button>
            )}
          </div>
        </div>

        {/* ══ SEC 7 — Mídias ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">7</span>
            <span className="sec-title">Fotos, vídeos e arquivos</span>
            {(rdo.midias?.length ?? 0) > 0 && (
              <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                {rdo.midias.length} item{rdo.midias.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="sec-body">
            <UploadZona
              rdoId={rdoId}
              midiasIniciais={midiasIniciais}
              somenteLeitura={!podeSalvar}
            />
          </div>
        </div>

        {/* ══ SEC 8 — Comentários ══ */}
        <div className="sec">
          <div className="sec-h">
            <span className="sec-num">8</span>
            <span className="sec-title">Comentários</span>
            {(rdo.comentarios?.length ?? 0) > 0 && (
              <span style={{ fontSize:10, color:'var(--ts)', background:'var(--s2)', border:'.5px solid var(--b)', borderRadius:20, padding:'2px 7px' }}>
                {rdo.comentarios.length}
              </span>
            )}
          </div>
          <div className="sec-body">
            {(rdo.comentarios ?? []).map((c: any) => (
              <div key={c.id} className="cmt-item">
                <div className="av" style={{ width:28, height:28, fontSize:10, background:'var(--bga)', color:'var(--ta)' }}>
                  {c.autor.nome.split(' ').slice(0,2).map((n: string) => n[0]).join('')}
                </div>
                <div className="cmt-bubble">
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:500 }}>{c.autor.nome}</span>
                    <span style={{ fontSize:10, color:'var(--tm)' }}>·</span>
                    <span style={{ fontSize:10, color:'var(--tm)' }}>
                      {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
                    </span>
                    {session?.usuario.perfil === 'ADMIN' && (
                      <button title="Excluir comentário" onClick={() => handleExcluirComentario(c.id)}
                        style={{ marginLeft:'auto', background:'rgba(224,92,92,.1)', border:'1px solid rgba(224,92,92,.5)', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--td)', fontSize:11, fontWeight:700, lineHeight:1, flexShrink:0 }}>
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize:12, lineHeight:1.5 }}>{c.texto}</div>
                  <div style={{ marginTop:5 }}>
                    <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'var(--tm)', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:3 }}
                      onClick={() => { if (cmtRef.current) { cmtRef.current.value = `@${c.autor.nome} `; cmtRef.current.focus() } }}>
                      <i className="ti ti-corner-down-right" /> Responder
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginTop:4 }}>
              <div className="av" style={{ width:28, height:28, fontSize:10, background:'var(--bga)', color:'var(--ta)', marginTop:2 }}>
                {rdo.emissor.nome.split(' ').slice(0,2).map((n: string) => n[0]).join('')}
              </div>
              <div style={{ flex:1 }}>
                <textarea ref={cmtRef} className="cmt-ta" rows={2}
                  placeholder="Escrever comentário... (Ctrl+Enter para enviar)"
                  onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') enviarCmt() }} />
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:4 }}>
                  <button className="btn btn-p btn-sm" onClick={enviarCmt}>
                    <i className="ti ti-send" /> Enviar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ SEC 9 — Assinaturas ══ */}
        <div className="sec">
          <div className="sec-h"><span className="sec-num">9</span><span className="sec-title">Assinaturas digitais</span></div>
          <div className="sec-body">
            {!enviado && (
              <div style={{ padding:'8px 11px', marginBottom:10, background:'var(--s1)', borderRadius:'var(--r)', border:'.5px solid var(--b)', display:'flex', alignItems:'center', gap:7 }}>
                <i className="ti ti-lock" style={{ fontSize:15, color:'var(--tm)', flexShrink:0 }} />
                <div style={{ fontSize:10.5, color:'var(--ts)', lineHeight:1.5 }}>
                  As assinaturas ficam bloqueadas enquanto o RDO é rascunho. Envie para aprovação para liberar a assinatura dos aprovadores.
                </div>
              </div>
            )}
            {signatarios.length > 0 && (
              <div className="sig-grid">
                {signatarios.map(s => {
                  const temImagem = !s.bloqueado && !!s.imagemPadrao
                  return (
                    <div key={s.id} className={`sig-card ${s.signed ? 'signed' : ''}`}>
                      <div className="sig-area" id={`sa-${s.id}`}>
                        {temImagem
                          ? <img src={s.imagemPadrao as string} style={{ width:'100%', height:'100%', objectFit:'contain', padding:4 }} alt="" />
                          : <span className="sig-hint">_ _ _ _ _ _ _</span>
                        }
                        <div className="sig-base" />
                      </div>
                      <div style={{ padding:'8px 9px' }}>
                        <div style={{ fontSize:12, fontWeight:500 }}>{s.nome}</div>
                        <div style={{ fontSize:10, color:'var(--ts)' }}>{s.cargo}</div>
                        <div style={{ fontSize:10, marginTop:4 }}>
                          {s.signed
                            ? <span className="badge b-ok">✔ Assinado</span>
                            : <span className="badge b-gray">⏳ {s.bloqueado ? 'Aguardando envio' : 'Aguardando'}</span>
                          }
                        </div>
                      </div>
                      <div style={{ padding:'0 9px 9px' }}>
                        {s.bloqueado ? (
                          <button className="btn btn-sm" style={{ width:'100%', color:'var(--tm)', cursor:'not-allowed', justifyContent:'center' }} disabled>
                            <i className="ti ti-lock" /> Aguardando envio
                          </button>
                        ) : s.meu && !temImagem ? (
                          <button className="btn btn-p btn-sm" style={{ width:'100%', justifyContent:'center' }}
                            onClick={() => router.push('/perfil')}>
                            <i className="ti ti-writing" /> Cadastrar em Meu perfil
                          </button>
                        ) : (
                          <button className="btn btn-sm" style={{ width:'100%', color:'var(--tm)', cursor:'not-allowed', justifyContent:'center' }} disabled>
                            <i className="ti ti-lock" /> {s.meu ? 'Assinado' : 'Aguardando'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {avisoPreEnvio && (
              <div style={{ padding:'8px 11px', marginTop: signatarios.length > 0 ? 10 : 0, background:'var(--s1)', borderRadius:'var(--r)', border:'.5px solid var(--b)', display:'flex', alignItems:'center', gap:7 }}>
                <i className="ti ti-info-circle" style={{ fontSize:15, color:'var(--ta)', flexShrink:0 }} />
                <div style={{ fontSize:10.5, color:'var(--ts)', lineHeight:1.5 }}>{avisoPreEnvio}</div>
              </div>
            )}
            <div style={{ padding:'8px 11px', marginTop:10, background:'var(--s1)', borderRadius:'var(--r)', border:'.5px solid var(--b)', display:'flex', alignItems:'center', gap:7 }}>
              <i className="ti ti-shield-check" style={{ fontSize:15, color:'var(--ta)', flexShrink:0 }} />
              <div style={{ fontSize:10, color:'var(--ts)', lineHeight:1.5 }}>
                Assinaturas em conformidade com a <strong style={{ color:'var(--tp)' }}>Lei nº 14.063/2020</strong>.
              </div>
            </div>
          </div>
        </div>

      </div>{/* fim content */}

      {/* ── Action bar ── */}
      {podeSalvar && (
        <div className="ab">
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-sm" onClick={() => router.push('/rdos')}>
              <i className="ti ti-arrow-left" /> Cancelar
            </button>
            {(rdo.status === 'RASCUNHO' || pode('aprovar_rdo')) && (
              <button className="btn btn-sm" style={{ color:'var(--td)', borderColor:'rgba(224,92,92,.35)' }}
                disabled={excluirRdo.isPending}
                onClick={handleExcluir}>
                <i className="ti ti-trash" /> Excluir RDO
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-sm" disabled={salvar.isPending || !dirty}
              onClick={() => form && handleSalvar(form)}>
              <i className="ti ti-device-floppy" /> {salvar.isPending ? 'Salvando...' : 'Rascunho'}
            </button>
            <button className="btn btn-sm" disabled={pdfLoading}
              onClick={async () => {
                if (!rdo) return
                setPdfLoading(true)
                try { await gerarPdfRdo(rdo, session?.tenantNome); toast.success('PDF gerado!') }
                catch { toast.error('Erro ao gerar PDF.') }
                finally { setPdfLoading(false) }
              }}>
              <i className={`ti ${pdfLoading ? 'ti-loader' : 'ti-file-export'}`}
                style={pdfLoading ? {animation:'spin 1s linear infinite'} : {}} />
              {pdfLoading ? 'Gerando...' : 'Gerar PDF'}
            </button>
            {podeEnviar && (
              <button className="btn btn-p btn-sm" disabled={enviar.isPending} onClick={handleEnviar}>
                <i className="ti ti-send" /> {enviar.isPending ? 'Enviando...' : 'Enviar para aprovação'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal adicionar atividade ── */}
      {modalAtividade && form && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModalAtividade(false)}>
          <div className="modal" style={{ width:440 }}>
            <div className="mh">
              <div className="mh-t"><i className="ti ti-list-check" /> Adicionar atividade</div>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:17 }}
                onClick={() => setModalAtividade(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="mb">
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
                <input type="checkbox" id="novaAvulsa" checked={novaAvulsa}
                  onChange={e => setNovaAvulsa(e.target.checked)} />
                <label htmlFor="novaAvulsa" style={{ fontSize:12, color:'var(--ts)', cursor:'pointer' }}>
                  Atividade avulsa (fora da lista de tarefas)
                </label>
              </div>

              {novaAvulsa ? (
                <>
                  <label className="fl">Etapa</label>
                  <input className="fi" value={novaEtapaTexto} style={{ marginBottom:8 }}
                    placeholder="Ex: Serviços extras" onChange={e => setNovaEtapaTexto(e.target.value)} />
                  <label className="fl">Nome da atividade</label>
                  <input className="fi" value={novaNomeTexto}
                    placeholder="Descreva a atividade" onChange={e => setNovaNomeTexto(e.target.value)} />
                </>
              ) : (
                <>
                  <label className="fl">Atividade da lista de tarefas</label>
                  <select className="fi" value={novaAtividadeId} onChange={e => setNovaAtividadeId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {(eap?.etapas ?? []).map(etapa => (
                      <optgroup key={etapa.id} label={`${etapa.numero} · ${etapa.nome}`}>
                        {etapa.atividades
                          .filter(a => !form.atividadeRegistros.some(r => r.atividadeId === a.id))
                          .map(a => (
                            <option key={a.id} value={a.id}>{a.numero} · {a.nome} ({a.pctAcumulado}%)</option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  {eap && eap.etapas.every(e => e.atividades.every(a => form.atividadeRegistros.some(r => r.atividadeId === a.id))) && (
                    <div style={{ fontSize:11, color:'var(--tm)', marginTop:6 }}>
                      Todas as atividades da lista de tarefas já foram adicionadas a este RDO.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mf2">
              <button className="btn" onClick={() => setModalAtividade(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={addAtividade}>
                <i className="ti ti-plus" /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nova função ── */}
      {modalFuncao && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModalFuncao(false)}>
          <div className="modal" style={{ width:400 }}>
            <div className="mh">
              <div className="mh-t"><i className="ti ti-user-plus" /> Nova função</div>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:17 }}
                onClick={() => setModalFuncao(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="mb">
              <label className="fl">Nome da função</label>
              <input className="fi" value={novaFuncaoNome} style={{ marginBottom:8 }}
                placeholder="Ex: Soldador" onChange={e => setNovaFuncaoNome(e.target.value)} />
              <label className="fl">Categoria</label>
              <select className="fi" value={novaFuncaoCategoria}
                onChange={e => setNovaFuncaoCategoria(e.target.value as MaoDeObraCategoria)}>
                {CATEGORIAS.map(cat => (
                  <option key={cat} value={cat}>{CATEGORIA_L[cat]}</option>
                ))}
              </select>
            </div>
            <div className="mf2">
              <button className="btn" onClick={() => setModalFuncao(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={criarNovaFuncao} disabled={criarFuncao.isPending}>
                <i className="ti ti-plus" /> Criar e usar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal novo equipamento ── */}
      {modalEquipamento && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModalEquipamento(false)}>
          <div className="modal" style={{ width:400 }}>
            <div className="mh">
              <div className="mh-t"><i className="ti ti-tool" /> Novo equipamento</div>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:17 }}
                onClick={() => setModalEquipamento(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="mb">
              <label className="fl">Nome do equipamento</label>
              <input className="fi" value={novoEquipamentoNome} style={{ marginBottom:8 }}
                placeholder="Ex: Betoneira 400L" onChange={e => setNovoEquipamentoNome(e.target.value)} />
              <label className="fl">Tipo</label>
              <select className="fi" value={novoEquipamentoTipo}
                onChange={e => setNovoEquipamentoTipo(e.target.value as EquipamentoTipo)}>
                {EQUIPAMENTO_TIPOS.map(tipo => (
                  <option key={tipo} value={tipo}>{EQUIPAMENTO_TIPO_L[tipo]}</option>
                ))}
              </select>
            </div>
            <div className="mf2">
              <button className="btn" onClick={() => setModalEquipamento(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={criarNovoEquipamento} disabled={criarEquipamentoCadastro.isPending}>
                <i className="ti ti-plus" /> Criar e usar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal novo tipo de ocorrência ── */}
      {modalOcorrenciaTipo && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModalOcorrenciaTipo(false)}>
          <div className="modal" style={{ width:400 }}>
            <div className="mh">
              <div className="mh-t"><i className="ti ti-alert-triangle" /> Novo tipo de ocorrência</div>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tm)', fontSize:17 }}
                onClick={() => setModalOcorrenciaTipo(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="mb">
              <label className="fl">Nome do tipo</label>
              <input className="fi" value={novoOcorrenciaTipoNome}
                placeholder="Ex: Falha de equipamento" onChange={e => setNovoOcorrenciaTipoNome(e.target.value)} />
            </div>
            <div className="mf2">
              <button className="btn" onClick={() => setModalOcorrenciaTipo(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={criarNovoOcorrenciaTipo} disabled={criarOcorrenciaTipo.isPending}>
                <i className="ti ti-plus" /> Criar e usar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
