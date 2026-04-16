'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types'

interface Props {
  cliente: Cliente | null
  unidadeId: string
  onClose: () => void
  onSalvo: (cliente: Cliente) => void
}

type Aba = 'cadastro' | 'configuracoes'

export default function ClienteModal({ cliente, unidadeId, onClose, onSalvo }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    cpf: cliente?.cpf || '',
    data_nascimento: cliente?.data_nascimento || '',
    observacoes: cliente?.observacoes || '',
    ativo: cliente?.ativo ?? true,
  })

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    setLoading(true)
    setErro('')

    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
      unidade_id: unidadeId,
    }

    if (cliente) {
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', cliente.id)
        .select()
        .single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert(payload)
        .select()
        .single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{cliente ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar abas */}
          <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
            {([['cadastro', 'Cadastro'], ['configuracoes', 'Configurações']] as [Aba, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  aba === key
                    ? 'text-amber-700 font-medium border-l-2 border-amber-700 bg-amber-50 rounded-l-none'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-6">
            {aba === 'cadastro' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => set('nome', e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                    <input
                      type="tel"
                      value={form.telefone}
                      onChange={e => set('telefone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={form.cpf}
                      onChange={e => set('cpf', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aniversário</label>
                    <input
                      type="date"
                      value={form.data_nascimento}
                      onChange={e => set('data_nascimento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={form.observacoes}
                    onChange={e => set('observacoes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                    placeholder="Anotações sobre o cliente..."
                  />
                </div>
              </div>
            )}

            {aba === 'configuracoes' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cliente inativo não aparece em agendamentos e comandas</p>
                  </div>
                  <button
                    onClick={() => set('ativo', !form.ativo)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.ativo ? 'bg-amber-700' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.ativo ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={loading}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
