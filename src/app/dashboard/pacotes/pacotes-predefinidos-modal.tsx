'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Pencil, Scissors, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PacotePredefinido, Servico } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  pacotesPredefinidos: PacotePredefinido[]
  servicos: Servico[]
  unidadeId: string
  onClose: () => void
  onChange: (lista: PacotePredefinido[]) => void
}

interface ItemForm {
  servico_id: string
  descricao: string
  quantidade: number
  valor_unitario: number
}

function itemVazio(): ItemForm {
  return { servico_id: '', descricao: '', quantidade: 1, valor_unitario: 0 }
}

export default function PacotesPredefinidosModal({ pacotesPredefinidos: initial, servicos, unidadeId, onClose, onChange }: Props) {
  const supabase = createClient()
  const [lista, setLista] = useState(initial)
  const [editando, setEditando] = useState<PacotePredefinido | null | undefined>(undefined)

  const [nome, setNome] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [itens, setItens] = useState<ItemForm[]>([itemVazio()])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setAtivo(true)
    setItens([itemVazio()])
    setErro('')
  }

  function abrirEdicao(p: PacotePredefinido) {
    setEditando(p)
    setNome(p.nome)
    setAtivo(p.ativo)
    setItens(
      p.itens?.length
        ? p.itens.map(i => ({ servico_id: i.servico_id || '', descricao: i.descricao, quantidade: i.quantidade, valor_unitario: i.valor_unitario }))
        : [itemVazio()]
    )
    setErro('')
  }

  function atualizarItem(index: number, mudancas: Partial<ItemForm>) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, ...mudancas } : it))
  }

  function selecionarServico(index: number, servicoId: string) {
    const servico = servicos.find(s => s.id === servicoId)
    atualizarItem(index, { servico_id: servicoId, descricao: servico?.nome || '', valor_unitario: servico?.preco || 0 })
  }

  function adicionarItem() {
    setItens(prev => [...prev, itemVazio()])
  }

  function removerItem(index: number) {
    setItens(prev => prev.length === 1 ? [itemVazio()] : prev.filter((_, i) => i !== index))
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome do modelo.'); return }
    const itensValidos = itens.filter(i => i.descricao.trim())
    if (itensValidos.length === 0) { setErro('Adicione pelo menos um serviço.'); return }
    setErro('')
    setSalvando(true)

    const payload = { nome: nome.trim(), ativo, unidade_id: unidadeId }
    let salvo: PacotePredefinido

    if (editando?.id) {
      const { data, error } = await supabase.from('pacotes_predefinidos').update(payload).eq('id', editando.id).select().single()
      if (error || !data) { setErro(error?.message || 'Erro ao salvar.'); setSalvando(false); return }
      salvo = data as unknown as PacotePredefinido
    } else {
      const { data, error } = await supabase.from('pacotes_predefinidos').insert(payload).select().single()
      if (error || !data) { setErro(error?.message || 'Erro ao salvar.'); setSalvando(false); return }
      salvo = data as unknown as PacotePredefinido
    }

    await supabase.from('pacotes_predefinidos_itens').delete().eq('pacote_predefinido_id', salvo.id)
    const { data: itensSalvos } = await supabase.from('pacotes_predefinidos_itens').insert(itensValidos.map(i => ({
      pacote_predefinido_id: salvo.id,
      servico_id: i.servico_id || null,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    }))).select()

    salvo.itens = (itensSalvos as PacotePredefinido['itens']) || []

    setLista(prev => {
      const existe = prev.find(p => p.id === salvo.id)
      const nova = existe ? prev.map(p => p.id === salvo.id ? salvo : p) : [salvo, ...prev]
      onChange(nova)
      return nova
    })
    setSalvando(false)
    setEditando(undefined)
  }

  async function remover(p: PacotePredefinido) {
    if (!confirm(`Excluir o modelo "${p.nome}"?`)) return
    await supabase.from('pacotes_predefinidos').delete().eq('id', p.id)
    setLista(prev => {
      const nova = prev.filter(x => x.id !== p.id)
      onChange(nova)
      return nova
    })
  }

  const totalItens = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {editando !== undefined && (
              <button onClick={() => setEditando(undefined)} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-semibold text-gray-900">
              {editando === undefined ? 'Pacotes predefinidos' : editando ? 'Editar modelo' : 'Novo modelo'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {editando === undefined ? (
            <div className="space-y-2">
              <button onClick={abrirNovo} className="mb-3 flex items-center gap-1.5 text-sm text-amber-700 hover:underline">
                <Plus className="w-4 h-4" /> Novo modelo
              </button>
              {lista.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum modelo cadastrado.</p>
              ) : (
                lista.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                      <p className="text-xs text-gray-500">
                        {p.itens?.length || 0} item{(p.itens?.length || 0) !== 1 ? 's' : ''}
                        {!p.ativo && <span className="ml-1.5 text-red-500">· inativo</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(p)} className="text-gray-400 hover:text-amber-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remover(p)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do modelo <span className="text-red-500">*</span></label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                </div>
                <button onClick={() => setAtivo(a => !a)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${ativo ? 'bg-amber-700' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Itens</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Serviço</th>
                        <th className="text-center text-xs font-medium text-gray-500 px-3 py-2 w-20">Qtde.</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-32">Valor unitário</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-28">Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Scissors className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <select value={item.servico_id} onChange={e => selecionarServico(idx, e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white">
                                <option value="">Selecionar serviço...</option>
                                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="1" value={item.quantidade}
                              onChange={e => atualizarItem(idx, { quantidade: parseInt(e.target.value) || 1 })}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-600" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={item.valor_unitario}
                              onChange={e => atualizarItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600" />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.quantidade * item.valor_unitario)}
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => removerItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={adicionarItem} className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 hover:underline">
                  <Plus className="w-4 h-4" /> Adicionar item
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <span className="text-sm text-gray-600">Total do modelo</span>
                <span className="text-base font-bold text-gray-900">{formatCurrency(totalItens)}</span>
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </div>
          )}
        </div>

        {editando !== undefined && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
            <button onClick={() => setEditando(undefined)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
              {salvando ? 'Salvando...' : 'Salvar modelo'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
