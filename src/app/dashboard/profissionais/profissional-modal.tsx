'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, BloqueioAgenda } from '@/types'

interface Props {
  profissional: Profissional | null
  unidadeId: string
  onClose: () => void
  onSalvo: (p: Profissional) => void
}

type Aba = 'cadastro' | 'comissao' | 'configuracoes' | 'fechamento'

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
    comissao_padrao: profissional?.comissao_padrao?.toString() || '0',
    cor_agenda: profissional?.cor_agenda || '#6366f1',
    ativo: profissional?.ativo ?? true,
  })

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
    if (aba === 'fechamento' && profissional) {
      fetchBloqueios()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, profissional?.id])

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

            {aba === 'comissao' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comissão padrão (%)</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.5" value={form.comissao_padrao}
                      onChange={e => set('comissao_padrao', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Este percentual será usado como padrão ao adicionar essa profissional em itens da comanda.
                  </p>
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
