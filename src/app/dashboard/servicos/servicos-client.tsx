'use client'

import { useState } from 'react'
import { Plus, Search, Scissors } from 'lucide-react'
import type { Servico, CategoriaServico } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ServicoModal from './servico-modal'

interface Props {
  servicos: Servico[]
  categorias: CategoriaServico[]
}

export default function ServicosClient({ servicos: initial, categorias }: Props) {
  const [servicos, setServicos] = useState(initial)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Servico | null>(null)

  const filtrados = servicos.filter(s =>
    s.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function onSalvo(s: Servico) {
    setServicos(prev => {
      const existe = prev.find(x => x.id === s.id)
      if (existe) return prev.map(x => x.id === s.id ? s : x)
      return [s, ...prev].sort((a, b) => a.nome.localeCompare(b.nome))
    })
    setModalAberto(false)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500 mt-0.5">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''} cadastrado{servicos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setSelecionado(null); setModalAberto(true) }}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo serviço</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar serviço..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Scissors className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{busca ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}</p>
          </div>
        ) : (
          <>
            {/* Tabela desktop */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Categoria</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Duração</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Preço</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Comissão</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(s => (
                  <tr key={s.id} onClick={() => { setSelecionado(s); setModalAberto(true) }}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.categoria?.nome || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.duracao_minutos} min</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatCurrency(s.preco)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.comissao_servico}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cards mobile */}
            <div className="md:hidden divide-y divide-gray-50">
              {filtrados.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setSelecionado(s); setModalAberto(true) }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.nome}</p>
                    <p className="text-xs text-gray-500">{s.duracao_minutos} min · {formatCurrency(s.preco)}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${s.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modalAberto && (
        <ServicoModal servico={selecionado} categorias={categorias} onClose={() => setModalAberto(false)} onSalvo={onSalvo} />
      )}
    </div>
  )
}
