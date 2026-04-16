'use client'

import { useState } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import type { Produto } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ProdutoModal from './produto-modal'

interface Props { produtos: Produto[]; unidadeId: string }

export default function ProdutosClient({ produtos: initial, unidadeId }: Props) {
  const [produtos, setProdutos] = useState(initial)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)

  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.marca?.toLowerCase().includes(busca.toLowerCase()))

  function onSalvo(p: Produto) {
    setProdutos(prev => {
      const existe = prev.find(x => x.id === p.id)
      if (existe) return prev.map(x => x.id === p.id ? p : x)
      return [p, ...prev].sort((a, b) => a.nome.localeCompare(b.nome))
    })
    setModalAberto(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setSelecionado(null); setModalAberto(true) }}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Novo produto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por nome ou marca..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{busca ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Marca</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Preço venda</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Estoque</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} onClick={() => { setSelecionado(p); setModalAberto(true) }}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nome}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.marca || '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(p.preco_venda)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.estoque} un.</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <ProdutoModal produto={selecionado} unidadeId={unidadeId} onClose={() => setModalAberto(false)} onSalvo={onSalvo} />
      )}
    </div>
  )
}
