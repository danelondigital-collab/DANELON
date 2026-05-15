'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, BloqueioAgenda, ComissaoProfissionalItem } from '@/types'

interface Props {
  profissional: Profissional | null
  unidadeId: string
  onClose: () => void
  onSalvo: (p: Profissional) => void
}

type Aba = 'cadastro' | 'endereco' | 'comissao' | 'configuracoes' | 'fechamento'

const CORES = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4']

export default function ProfissionalModal({ profissional, unidadeId, onClose, onSalvo }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: profissional?.nome || '',
    telefone: profissional?.telefone || '',
    email: profissional?.email || '',
    cpf: profissional?.cpf || '',
    rg: profissional?.rg || '',
    cnpj: profissional?.cnpj || '',
    data_nascimento: profissional?.data_nascimento || '',
    cep: profissional?.cep || '',
    logradouro: profissional?.logradouro || '',
    numero: profissional?.numero || '',
    complemento: profissional?.complemento || '',
    bairro: profissional?.bairro || '',
    estado: profissional?.estado || '',
    cidade: profissional?.cidade || '',
    comissao_padrao: profissional?.comissao_padrao?.toString() || '0',
    cor_agenda: profissional?.cor_agenda || '#6366f1',
    ativo: profissional?.ativo ?? true,
  })

  const [buscandoCep, setBuscandoCep] = useState(false)

  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm(prev => ({
          ...prev,
          logradouro: dados.logradouro || prev.logradouro,
          bairro: dados.bairro || prev.bairro,
          estado: dados.uf || prev.estado,
          cidade: dados.localidade || prev.cidade,
        }))
      }
    } catch {
      // ignora erro de rede
    } finally {
      setBuscandoCep(false)
    }
  }

  // Comissões específicas por serviço/produto
  const [comissoes, setComissoes] = useState<ComissaoProfissionalItem[]>([])
  const [loadingComissoes, setLoadingComissoes] = useState(false)
  const [servicos, setServicos] = useState<{ id: string; nome: string }[]>([])
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([])
  const [novaComTipo, setNovaComTipo] = useState<'servico' | 'produto'>('servico')
  const [novaComItemId, setNovaComItemId] = useState('')
  const [novaComPercentual, setNovaComPercentual] = useState('0')
  const [salvandoComissao, setSalvandoComissao] = useState(false)
  const [erroComissao, setErroComissao] = useState('')

  // Fechamento de agenda
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])
  const [loadingBloqueios, setLoadingBloqueios] = useState(false)
  const [savingBloqueio, setSavingBloqueio] = useState(false)
  const [editandoBloqueioId, setEditandoBloqueioId] = useState<string | null>(null)
  const [bloqueioForm, setBloqueioForm] = useState({
    data: '',
    hora_inicio: '',
    hora_fim: '',
    motivo: '',
  })

  useEffect(() => {
    if (aba === 'comissao') {
      fetchServicosEProdutos()
      if (profissional) fetchComissoes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, profissional?.id])

  useEffect(() => {
    if (aba === 'fechamento' && profissional) {
      fetchBloqueios()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, profissional?.id])

  async function fetchServicosEProdutos() {
    const [{ data: svcs }, { data: prods }] = await Promise.all([
      supabase.from('servicos').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('produtos').select('id, nome').eq('unidade_id', unidadeId).eq('ativo', true).order('nome'),
    ])
    setServicos(svcs || [])
    setProdutos(prods || [])
  }

  async function fetchComissoes() {
    if (!profissional) return
    setLoadingComissoes(true)
    const { data } = await supabase
      .from('comissoes_profissional_item')
      .select('*, servico:servicos(id, nome), produto:produtos(id, nome)')
      .eq('profissional_id', profissional.id)
      .order('created_at')
    setComissoes((data as ComissaoProfissionalItem[]) || [])
    setLoadingComissoes(false)
  }

  async function adicionarComissao() {
    if (!profissional || !novaComItemId) return
    setErroComissao('')
    const jaExiste = comissoes.some(c =>
      (novaComTipo === 'servico' && c.servico_id === novaComItemId) ||
      (novaComTipo === 'produto' && c.produto_id === novaComItemId)
    )
    if (jaExiste) { setErroComissao('Comissão já cadastrada para este item.'); return }
    setSalvandoComissao(true)
    const payload: Record<string, unknown> = {
      profissional_id: profissional.id,
      tipo: novaComTipo,
      percentual: parseFloat(novaComPercentual) || 0,
    }
    if (novaComTipo === 'servico') payload.servico_id = novaComItemId
    else payload.produto_id = novaComItemId
    const { error } = await supabase.from('comissoes_profissional_item').insert(payload)
    if (error) { setErroComissao(error.message); setSalvandoComissao(false); return }
    setNovaComItemId('')
    setNovaComPercentual('0')
    await fetchComissoes()
    setSalvandoComissao(false)
  }

  async function removerComissao(id: string) {
    await supabase.from('comissoes_profissional_item').delete().eq('id', id)
    setComissoes(prev => prev.filter(c => c.id !== id))
  }

  async function fetchBloqueios() {
    if (!profissional) return
    setLoadingBloqueios(true)
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .eq('profissional_id', profissional.id)
      .gte('data', hoje)
      .order('data')
    setBloqueios((data as BloqueioAgenda[]) || [])
    setLoadingBloqueios(false)
  }

  async function salvarBloqueio() {
    if (!profissional || !bloqueioForm.data) return
    setSavingBloqueio(true)
    const payload = {
      profissional_id: profissional.id,
      unidade_id: unidadeId,
      data: bloqueioForm.data,
      hora_inicio: bloqueioForm.hora_inicio || null,
      hora_fim: bloqueioForm.hora_fim || null,
      motivo: bloqueioForm.motivo || null,
    }
    if (editandoBloqueioId) {
      await supabase.from('bloqueios_agenda').update(payload).eq('id', editandoBloqueioId)
      setEditandoBloqueioId(null)
    } else {
      await supabase.from('bloqueios_agenda').insert(payload)
    }
    setBloqueioForm({ data: '', hora_inicio: '', hora_fim: '', motivo: '' })
    await fetchBloqueios()
    setSavingBloqueio(false)
  }

  function iniciarEdicaoBloqueio(b: BloqueioAgenda) {
    setEditandoBloqueioId(b.id)
    setBloqueioForm({
      data: b.data,
      hora_inicio: b.hora_inicio || '',
      hora_fim: b.hora_fim || '',
      motivo: b.motivo || '',
    })
  }

  function cancelarEdicaoBloqueio() {
    setEditandoBloqueioId(null)
    setBloqueioForm({ data: '', hora_inicio: '', hora_fim: '', motivo: '' })
  }

  async function removerBloqueio(id: string) {
    await supabase.from('bloqueios_agenda').delete().eq('id', id)
    setBloqueios(prev => prev.filter(b => b.id !== id))
  }

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setLoading(true)
    setErro('')

    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      rg: form.rg || null,
      cnpj: form.cnpj || null,
      data_nascimento: form.data_nascimento || null,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      estado: form.estado || null,
      cidade: form.cidade || null,
      comissao_padrao: parseFloat(form.comissao_padrao) || 0,
      cor_agenda: form.cor_agenda,
      ativo: form.ativo,
      unidade_id: unidadeId,
    }

    if (profissional) {
      const { data, error } = await supabase.from('profissionais').update(payload).eq('id', profissional.id).select().single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    } else {
      const { data, error } = await supabase.from('profissionais').insert(payload).select().single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    }
    setLoading(false)
  }

  const abas: [Aba, string][] = [
    ['cadastro', 'Cadastro'],
    ['endereco', 'Endereço'],
    ['comissao', 'Comissão'],
    ['configuracoes', 'Configurações'],
    ['fechamento', 'Fechamento'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{profissional ? 'Editar profissional' : 'Novo profissional'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
            {abas.map(([key, label]) => (
              <button key={key} onClick={() => setAba(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  aba === key ? 'text-amber-700 font-medium border-l-2 border-amber-700 bg-amber-50 rounded-l-none' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            {aba === 'cadastro' && (
              <div className="space-y-4">
                <div className="flex justify-center mb-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: form.cor_agenda }}>
                    {form.nome.charAt(0).toUpperCase() || '?'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Nome completo" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                    <input type="tel" value={form.telefone} onChange={e => set('telefone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="email@exemplo.com" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                    <input type="text" value={form.cpf} onChange={e => set('cpf', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                    <input type="text" value={form.rg} onChange={e => set('rg', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="00.000.000-0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                    <input type="text" value={form.cnpj} onChange={e => set('cnpj', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="00.000.000/0000-00" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                  <input type="date" value={form.data_nascimento} onChange={e => set('data_nascimento', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cor na agenda</label>
                  <div className="flex gap-2 flex-wrap">
                    {CORES.map(cor => (
                      <button key={cor} onClick={() => set('cor_agenda', cor)}
                        className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${form.cor_agenda === cor ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                        style={{ backgroundColor: cor }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {aba === 'endereco' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <div className="relative">
                    <input type="text" value={form.cep}
                      onChange={e => { set('cep', e.target.value); buscarCep(e.target.value) }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 pr-24"
                      placeholder="00000-000" maxLength={9} />
                    {buscandoCep && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                  <input type="text" value={form.logradouro} onChange={e => set('logradouro', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Rua, Avenida, Travessa..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                    <input type="text" value={form.numero} onChange={e => set('numero', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="123" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                    <input type="text" value={form.complemento} onChange={e => set('complemento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="Apto, Sala, Bloco..." />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                    <input type="text" value={form.bairro} onChange={e => set('bairro', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="Bairro" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <input type="text" value={form.estado} onChange={e => set('estado', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="SP" maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="São Paulo" />
                  </div>
                </div>
              </div>
            )}

            {aba === 'comissao' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comissão padrão (%)</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.5" value={form.comissao_padrao}
                      onChange={e => set('comissao_padrao', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Percentual padrão usado quando não há comissão específica cadastrada para o serviço/produto.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Comissões específicas</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Substituem a comissão padrão para o serviço ou produto selecionado na comanda.
                  </p>

                  {!profissional ? (
                    <p className="text-sm text-gray-400 italic">Salve o profissional primeiro para configurar comissões específicas.</p>
                  ) : (
                    <>
                      {/* Formulário de adição */}
                      <div className="flex gap-2 mb-3">
                        <select
                          value={novaComTipo}
                          onChange={e => { setNovaComTipo(e.target.value as 'servico' | 'produto'); setNovaComItemId('') }}
                          className="w-28 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600 flex-shrink-0"
                        >
                          <option value="servico">Serviço</option>
                          <option value="produto">Produto</option>
                        </select>
                        <select
                          value={novaComItemId}
                          onChange={e => setNovaComItemId(e.target.value)}
                          className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
                        >
                          <option value="">Selecionar {novaComTipo === 'servico' ? 'serviço' : 'produto'}...</option>
                          {(novaComTipo === 'servico' ? servicos : produtos).map(i => (
                            <option key={i.id} value={i.id}>{i.nome}</option>
                          ))}
                        </select>
                        <div className="relative flex-shrink-0 w-20">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={novaComPercentual}
                            onChange={e => setNovaComPercentual(e.target.value)}
                            className="w-full px-2 py-2 pr-5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600 text-center"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                        <button
                          onClick={adicionarComissao}
                          disabled={!novaComItemId || salvandoComissao}
                          className="flex-shrink-0 px-3 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {salvandoComissao ? '...' : 'Adicionar'}
                        </button>
                      </div>
                      {erroComissao && <p className="text-xs text-red-500 mb-2">{erroComissao}</p>}

                      {/* Lista de comissões */}
                      {loadingComissoes ? (
                        <p className="text-xs text-gray-400">Carregando...</p>
                      ) : comissoes.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhuma comissão específica cadastrada.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {comissoes.map(c => {
                            const nomeItem = c.tipo === 'servico' ? c.servico?.nome : c.produto?.nome
                            return (
                              <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${c.tipo === 'servico' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                                    {c.tipo === 'servico' ? 'S' : 'P'}
                                  </span>
                                  <span className="text-sm text-gray-800 truncate">{nomeItem ?? '—'}</span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                  <span className="text-sm font-semibold text-amber-700">{c.percentual}%</span>
                                  <button onClick={() => removerComissao(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {aba === 'configuracoes' && (
              <div className="space-y-1">
                {[
                  { field: 'ativo', label: 'Ativo', desc: 'Profissional inativa não aparece em agendamentos e comandas' },
                ].map(item => (
                  <div key={item.field} className="flex items-start justify-between py-3 border-b border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button onClick={() => set(item.field, !(form as Record<string, unknown>)[item.field])}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        (form as Record<string, unknown>)[item.field] ? 'bg-amber-700' : 'bg-gray-200'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        (form as Record<string, unknown>)[item.field] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {aba === 'fechamento' && (
              <div className="space-y-5">
                {!profissional ? (
                  <p className="text-sm text-gray-500">Salve a profissional primeiro para configurar o fechamento de agenda.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-900">{editandoBloqueioId ? 'Editar bloqueio' : 'Adicionar bloqueio'}</h3>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Data <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={bloqueioForm.data}
                          onChange={e => setBloqueioForm(p => ({ ...p, data: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Hora início <span className="text-gray-400">(opcional)</span></label>
                          <input
                            type="time"
                            value={bloqueioForm.hora_inicio}
                            onChange={e => setBloqueioForm(p => ({ ...p, hora_inicio: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Hora fim <span className="text-gray-400">(opcional)</span></label>
                          <input
                            type="time"
                            value={bloqueioForm.hora_fim}
                            onChange={e => setBloqueioForm(p => ({ ...p, hora_fim: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Deixe os horários em branco para bloquear o dia inteiro.</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Motivo <span className="text-gray-400">(opcional)</span></label>
                        <input
                          type="text"
                          value={bloqueioForm.motivo}
                          onChange={e => setBloqueioForm(p => ({ ...p, motivo: e.target.value }))}
                          placeholder="Ex: Folga, Consulta médica, Feriado..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={salvarBloqueio}
                          disabled={!bloqueioForm.data || savingBloqueio}
                          className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {savingBloqueio ? 'Salvando...' : editandoBloqueioId ? 'Atualizar' : 'Adicionar bloqueio'}
                        </button>
                        {editandoBloqueioId && (
                          <button
                            onClick={cancelarEdicaoBloqueio}
                            className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Bloqueios cadastrados</h3>
                      {loadingBloqueios ? (
                        <p className="text-sm text-gray-400">Carregando...</p>
                      ) : bloqueios.length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhum bloqueio futuro cadastrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {bloqueios.map(b => (
                            <div key={b.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {format(parseISO(b.data), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                                  {b.hora_inicio && (
                                    <span className="text-gray-500 font-normal ml-1.5">
                                      · {b.hora_inicio}{b.hora_fim ? ` – ${b.hora_fim}` : ''}
                                    </span>
                                  )}
                                  {!b.hora_inicio && <span className="text-gray-400 font-normal text-xs ml-1.5">dia inteiro</span>}
                                </p>
                                {b.motivo && <p className="text-xs text-gray-500 mt-0.5">{b.motivo}</p>}
                              </div>
                              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                <button
                                  onClick={() => iniciarEdicaoBloqueio(b)}
                                  className="text-gray-400 hover:text-amber-600 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removerBloqueio(b.id)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            {aba !== 'fechamento' && (
              <button onClick={handleSalvar} disabled={loading}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
