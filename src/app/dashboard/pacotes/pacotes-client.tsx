'use client'

import { useState } from 'react'
import { Plus, Search, Gift, Settings } from 'lucide-react'
import type { Pacote, Cliente, Servico, PacotePredefinido } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import PacoteModal from './pacote-modal'
import PacotesPredefinidosModal from './pacotes-predefinidos-modal'

interface Props {
  pacotes: Pacote[]
  clientes: Cliente[]
  profissionais: { id: string; nome: string }[]
  servicos: Servico[]
  pacotesPredefinidos: PacotePredefinido[]
  unidadeId: string
}

const statusLabel: Record<string, string> = { aberto: 'Aberto', finalizado: 'Finalizado', cancelado: 'Cancelado' }
const statusCor: Record<string, string> = {
  aberto: 'bg-amber-100 text-amber-700',
  finalizado: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
}

function disponibilidade(p: Pacote): { label: string; cor: string } | null {
  if (p.status !== 'finalizado' || !p.validade) return null
  const vencido = new Date(p.validade) < new Date(new Date().toDateString())
  return vencido
    ? { label: 'Vencido', cor: 'bg-red-100 text-red-600' }
    : { label: 'Ativo', cor: 'bg-green-100 text-green-700' }
}

export default function PacotesClient({ pacotes: initial, clientes, profissionais, servicos, pacotesPredefinidos: predefinidosInicial, unidadeId }: Props) {
  const [pacotes, setPacotes] = useState(initial)
  const [pacotesPredefinidos, setPacotesPredefinidos] = useState(predefinidosInicial)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalPredefinidosAberto, setModalPredefinidosAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Pacote | null>(null)

  const filtrados = pacotes.filter(p =>
    p.cliente?.nome.toLowerCase().includes(busca.toLowerCase()) ||
    String(p.numero).includes(busca.replace('#', ''))
  )

  function abrirNovo() { setSelecionado(null); setModalAberto(true) }
  function abrirExistente(p: Pacote) { setSelecionado(p); setModalAberto(true) }

  function onSalvo(p: Pacote) {
    setPacotes(prev => {
      const existe = prev.find(x => x.id === p.id)
      if (existe) return prev.map(x => x.id === p.id ? p : x)
      return [p, ...prev]
    })
  }

  function onExcluido(id: string) {
    setPacotes(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pacotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pacotes.length} pacote{pacotes.length !== 1 ? 's' : ''} cadastrado{pacotes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={abrirNovo}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Gift className="w-4 h-4" />
            <span className="hidden sm:inline">Nova comanda de pacote</span>
            <span className="sm:hidden">Nova comanda</span>
          </button>
          <button onClick={() => setModalPredefinidosAberto(true)}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Cadastrar pacote</span>
            <span className="sm:hidden">Cadastrar</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar por cliente ou nº do pacote..." value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{busca ? 'Nenhum pacote encontrado' : 'Nenhum pacote cadastrado'}</p>
            {!busca && (
              <button onClick={abrirNovo} className="mt-3 text-sm text-amber-700 hover:underline">Criar primeira comanda de pacote</button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full hidden md:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 w-20">Ticket</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Validade</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Disponibilidade</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const disp = disponibilidade(p)
                  return (
                    <tr key={p.id} onClick={() => abrirExistente(p)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3"><span className="text-xs font-mono font-medium text-amber-700">#{p.numero}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(p.data)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.validade ? formatDate(p.validade) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.cliente?.nome || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCor[p.status]}`}>
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {disp && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${disp.cor}`}>
                            {disp.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(p.valor_final)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="md:hidden divide-y divide-gray-50">
              {filtrados.map(p => {
                const disp = disponibilidade(p)
                return (
                  <div key={p.id} onClick={() => abrirExistente(p)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Gift className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.cliente?.nome || '—'}</p>
                        <span className="text-xs font-mono text-amber-700 flex-shrink-0">#{p.numero}</span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(p.data)}{p.validade ? ` · vence ${formatDate(p.validade)}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                      <span className="text-xs font-medium text-gray-900">{formatCurrency(p.valor_final)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modalAberto && (
        <PacoteModal
          pacote={selecionado}
          clientes={clientes}
          profissionais={profissionais}
          servicos={servicos}
          pacotesPredefinidos={pacotesPredefinidos}
          unidadeId={unidadeId}
          onClose={() => setModalAberto(false)}
          onSalvo={onSalvo}
          onExcluido={onExcluido}
        />
      )}

      {modalPredefinidosAberto && (
        <PacotesPredefinidosModal
          pacotesPredefinidos={pacotesPredefinidos}
          servicos={servicos}
          unidadeId={unidadeId}
          onClose={() => setModalPredefinidosAberto(false)}
          onChange={setPacotesPredefinidos}
        />
      )}
    </div>
  )
}
