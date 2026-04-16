'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Produto } from '@/types'

interface Props { produto: Produto | null; unidadeId: string; onClose: () => void; onSalvo: (p: Produto) => void }

type Aba = 'cadastro' | 'estoque'

export default function ProdutoModal({ produto, unidadeId, onClose, onSalvo }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: produto?.nome || '',
    marca: produto?.marca || '',
    descricao: produto?.descricao || '',
    preco_custo: produto?.preco_custo?.toString() || '0',
    preco_venda: produto?.preco_venda?.toString() || '0',
    estoque: produto?.estoque?.toString() || '0',
    ativo: produto?.ativo ?? true,
  })

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSalvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setLoading(true); setErro('')

    const payload = {
      nome: form.nome.trim(),
      marca: form.marca || null,
      descricao: form.descricao || null,
      preco_custo: parseFloat(form.preco_custo) || 0,
      preco_venda: parseFloat(form.preco_venda) || 0,
      estoque: parseInt(form.estoque) || 0,
      ativo: form.ativo,
      unidade_id: unidadeId,
    }

    if (produto) {
      const { data, error } = await supabase.from('produtos').update(payload).eq('id', produto.id).select().single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    } else {
      const { data, error } = await supabase.from('produtos').insert(payload).select().single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{produto ? 'Editar produto' : 'Novo produto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
            {([['cadastro', 'Cadastro'], ['estoque', 'Estoque']] as [Aba, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setAba(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${aba === key ? 'text-amber-700 font-medium border-l-2 border-amber-700 bg-amber-50 rounded-l-none' : 'text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-6">
            {aba === 'cadastro' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" placeholder="Nome do produto" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <input type="text" value={form.marca} onChange={e => set('marca', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" placeholder="Marca" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço de venda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" min="0" step="0.01" value={form.preco_venda} onChange={e => set('preco_venda', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custo de compra</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" min="0" step="0.01" value={form.preco_custo} onChange={e => set('preco_custo', e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                    placeholder="Descrição do produto..." />
                </div>
              </div>
            )}

            {aba === 'estoque' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estoque atual</label>
                  <input type="number" min="0" value={form.estoque} onChange={e => set('estoque', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                </div>
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Produto inativo não aparece para seleção em comandas</p>
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
