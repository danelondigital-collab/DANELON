'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profissional } from '@/types'

interface Props {
  profissional: Profissional | null
  unidadeId: string
  onClose: () => void
  onSalvo: (p: Profissional) => void
}

type Aba = 'cadastro' | 'comissao' | 'configuracoes'

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

  const abas: [Aba, string][] = [['cadastro', 'Cadastro'], ['comissao', 'Comissão'], ['configuracoes', 'Configurações']]

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
                {/* Avatar com cor */}
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
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            <button onClick={handleSalvar} disabled={loading}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
