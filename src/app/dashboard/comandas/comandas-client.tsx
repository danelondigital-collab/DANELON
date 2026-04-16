'use client'

import { useState } from 'react'
import { Plus, Search, ClipboardList } from 'lucide-react'
import type { Comanda, Cliente, Profissional, Servico, Produto } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import ComandaModal from './comanda-modal'

interface Props {
  comandas: Comanda[]
  clientes: Cliente[]
  profissionais: Profissional[]
  servicos: Servico[]
  produtos: Produto[]
  unidadeId: string
}

const statusLabel: Record<string, string> = { aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada' }
const statusCor: Record<string, string> = {
  aberta: 'bg-green-100 text-green-700',
  fechada: 'bg-gray-100 text-gray-600',
  cancelada: 'bg-red-100 text-red-600',
}

export default function ComandasClient({ comandas: initial, clientes, profissionais, servicos, produtos, unidadeId }: Props) {
  const [comandas, setComandas] = useState(initial)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null)

  const filtradas = comandas.filter(c => {
    const matchBusca = c.cliente?.nome.toLowerCase().includes(busca.toLowerCase()) || String(c.id).includes(busca)
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    return matchBusca && matchStatus
  })

  function abrirNova() {
    setComandaSelecionada(null)
    setModalAberto(true)
  }

  function abrirExistente(comanda: Comanda) {
    setComandaSelecionada(comanda)
    setModalAberto(true)
  }

  function onSalva(comanda: Comanda) {
    setComandas(prev => {
      const existe = prev.find(c => c.id === comanda.id)
      if (existe) return prev.map(c => c.id === comanda.id ? comanda : c)
      return [comanda, ...prev]
    })
  }

  function onFechada() {
    setModalAberto(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comandas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {comandas.filter(c => c.status === 'aberta').length} aberta{comandas.filter(c => c.status === 'aberta').length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={abrirNova}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nova comanda
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por cliente..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600">
            <option value="todos">Todos</option>
            <option value="aberta">Abertas</option>
            <option value="fechada">Fechadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>

        {filtradas.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{busca || filtroStatus !== 'todos' ? 'Nenhuma comanda encontrada' : 'Nenhuma comanda'}</p>
            {!busca && filtroStatus === 'todos' && (
              <button onClick={abrirNova} className="mt-3 text-sm text-amber-700 hover:underline">Abrir primeira comanda</button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Abertura</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => (
                <tr key={c.id} onClick={() => abrirExistente(c)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{c.cliente?.nome || '—'}</p>
                    {c.cliente?.telefone && <p className="text-xs text-gray-500">{c.cliente.telefone}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(c.data_abertura)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCor[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(c.valor_final)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <ComandaModal
          comanda={comandaSelecionada}
          clientes={clientes}
          profissionais={profissionais}
          servicos={servicos}
          produtos={produtos}
          unidadeId={unidadeId}
          onClose={onFechada}
          onSalva={onSalva}
        />
      )}
    </div>
  )
}
