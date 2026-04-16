'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Plus, Search, User } from 'lucide-react'
import type { Cliente } from '@/types'
import { formatDate, formatPhone } from '@/lib/utils'
import ClienteModal from './cliente-modal'

interface Props {
  clientes: Cliente[]
  unidadeId: string
  busca: string
}

export default function ClientesClient({ clientes: initial, unidadeId, busca: buscaInicial }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [clientes, setClientes] = useState(initial)
  const [busca, setBusca] = useState(buscaInicial)
  const [modalAberto, setModalAberto] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setClientes(initial) }, [initial])

  function handleBusca(valor: string) {
    setBusca(valor)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (valor.trim()) params.set('q', valor.trim())
      router.push(`${pathname}${params.toString() ? '?' + params.toString() : ''}`)
    }, 400)
  }

  const filtrados = clientes

  function abrirNovo() {
    setClienteSelecionado(null)
    setModalAberto(true)
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteSelecionado(cliente)
    setModalAberto(true)
  }

  function onSalvo(cliente: Cliente) {
    setClientes(prev => {
      const existe = prev.find(c => c.id === cliente.id)
      if (existe) return prev.map(c => c.id === cliente.id ? cliente : c)
      return [cliente, ...prev].sort((a, b) => a.nome.localeCompare(b.nome))
    })
    setModalAberto(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {busca ? `${filtrados.length} resultado${filtrados.length !== 1 ? 's' : ''} para "${busca}"` : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} (primeiros 100)`}
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={busca}
              onChange={e => handleBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {busca ? `Nenhum cliente encontrado para "${busca}"` : 'Nenhum cliente cadastrado'}
            </p>
            {!busca && (
              <button onClick={abrirNovo} className="mt-3 text-sm text-amber-700 hover:underline">
                Cadastrar primeiro cliente
              </button>
            )}
            {busca && (
              <button onClick={() => handleBusca('')} className="mt-3 text-sm text-amber-700 hover:underline">
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Telefone</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Aniversário</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(cliente => (
                <tr
                  key={cliente.id}
                  onClick={() => abrirEdicao(cliente)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-amber-700">
                          {cliente.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{cliente.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {cliente.telefone ? formatPhone(cliente.telefone) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{cliente.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {cliente.data_nascimento ? formatDate(cliente.data_nascimento) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      cliente.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <ClienteModal
          cliente={clienteSelecionado}
          unidadeId={unidadeId}
          onClose={() => setModalAberto(false)}
          onSalvo={onSalvo}
        />
      )}
    </div>
  )
}
