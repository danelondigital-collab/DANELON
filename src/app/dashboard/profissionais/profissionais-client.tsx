'use client'

import { useState } from 'react'
import { Plus, Search, UserCog } from 'lucide-react'
import type { Profissional } from '@/types'
import { formatPhone } from '@/lib/utils'
import ProfissionalModal from './profissional-modal'

interface Props {
  profissionais: Profissional[]
  unidadeId: string
}

export default function ProfissionaisClient({ profissionais: initial, unidadeId }: Props) {
  const [profissionais, setProfissionais] = useState(initial)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Profissional | null>(null)

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.telefone?.includes(busca)
  )

  function abrirNovo() { setSelecionado(null); setModalAberto(true) }
  function abrirEdicao(p: Profissional) { setSelecionado(p); setModalAberto(true) }

  function onSalvo(p: Profissional) {
    setProfissionais(prev => {
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
          <h1 className="text-xl font-bold text-gray-900">Profissionais</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profissionais.length} profissional{profissionais.length !== 1 ? 'is' : ''} cadastrado{profissionais.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo profissional
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar profissional..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {busca ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'}
            </p>
            {!busca && (
              <button onClick={abrirNovo} className="mt-3 text-sm text-amber-700 hover:underline">
                Cadastrar primeiro profissional
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Telefone</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Comissão</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr
                  key={p.id}
                  onClick={() => abrirEdicao(p)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-medium"
                        style={{ backgroundColor: p.cor_agenda }}
                      >
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{p.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.telefone ? formatPhone(p.telefone) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.comissao_padrao}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
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
        <ProfissionalModal
          profissional={selecionado}
          unidadeId={unidadeId}
          onClose={() => setModalAberto(false)}
          onSalvo={onSalvo}
        />
      )}
    </div>
  )
}
