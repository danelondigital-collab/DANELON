'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Servico, CategoriaServico } from '@/types'

interface Props {
  servico: Servico | null
  categorias: CategoriaServico[]
  onClose: () => void
  onSalvo: (s: Servico) => void
}

type Aba = 'cadastro' | 'configuracoes'

export default function ServicoModal({ servico, categorias, onClose, onSalvo }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: servico?.nome || '',
    descricao: servico?.descricao || '',
    categoria_id: servico?.categoria_id || '',
    duracao_minutos: servico?.duracao_minutos?.toString() || '60',
    preco: servico?.preco?.toString() || '0',
    comissao_servico: servico?.comissao_servico?.toString() || '0',
    ativo: servico?.ativo ?? true,
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
      descricao: form.descricao || null,
      categoria_id: form.categoria_id || null,
      duracao_minutos: parseInt(form.duracao_minutos) || 60,
      preco: parseFloat(form.preco) || 0,
      comissao_servico: parseFloat(form.comissao_servico) || 0,
      ativo: form.ativo,
    }

    if (servico) {
      const { data, error } = await supabase.from('servicos').update(payload).eq('id', servico.id).select('*, categoria:categorias_servico(*)').single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    } else {
      const { data, error } = await supabase.from('servicos').insert(payload).select('*, categoria:categorias_servico(*)').single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    }
    setLoading(false)
  }

  const duracoes = [15, 30, 45, 60, 90, 120, 150, 180, 240]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{servico ? 'Editar serviço' : 'Novo serviço'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
            {([['cadastro', 'Cadastro'], ['configuracoes', 'Configurações']] as [Aba, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setAba(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  aba === key ? 'text-amber-700 font-medium border-l-2 border-amber-700 bg-amber-50 rounded-l-none' : 'text-gray-600 hover:bg-gray-50'
                }`}>{label}</button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            {aba === 'cadastro' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Nome do serviço" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
                      <option value="">Sem categoria</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duração</label>
                    <select value={form.duracao_minutos} onChange={e => set('duracao_minutos', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
                      {duracoes.map(d => (
                        <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60}h${d % 60 ? ` ${d % 60}min` : ''}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço de venda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" min="0" step="0.01" value={form.preco} onChange={e => set('preco', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comissão</label>
                    <div className="relative">
                      <input type="number" min="0" max="100" step="0.5" value={form.comissao_servico} onChange={e => set('comissao_servico', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                    placeholder="Descrição do serviço..." />
                </div>
              </div>
            )}

            {aba === 'configuracoes' && (
              <div className="space-y-1">
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Serviço inativo não aparece para seleção em comandas</p>
                  </div>
                  <button onClick={() => set('ativo', !form.ativo)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.ativo ? 'bg-amber-700' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
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
