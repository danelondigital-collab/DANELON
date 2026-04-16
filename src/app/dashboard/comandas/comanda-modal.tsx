'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Search, Scissors, ShoppingBag, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Comanda, ComandaItem, Cliente, Profissional, Servico, Produto } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface Props {
  comanda: Comanda | null
  clientes: Cliente[]
  profissionais: Profissional[]
  servicos: Servico[]
  produtos: Produto[]
  unidadeId: string
  onClose: () => void
  onSalva: (c: Comanda) => void
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'misto', label: 'Misto' },
]

export default function ComandaModal({ comanda: comandaInicial, profissionais, servicos, produtos, unidadeId, onClose, onSalva }: Props) {
  const supabase = createClient()
  const isNova = !comandaInicial

  const [comanda, setComanda] = useState<Comanda | null>(comandaInicial)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [clienteBusca, setClienteBusca] = useState(comandaInicial?.cliente?.nome || '')
  const [clienteId, setClienteId] = useState(comandaInicial?.cliente_id || '')
  const [mostrarClientes, setMostrarClientes] = useState(false)
  const [desconto, setDesconto] = useState(comandaInicial?.desconto?.toString() || '0')
  const [formaPagamento, setFormaPagamento] = useState(comandaInicial?.forma_pagamento || '')
  const [adicionandoItem, setAdicionandoItem] = useState(false)
  const [itemEditando, setItemEditando] = useState<ComandaItem | null>(null)
  const [fechando, setFechando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  useEffect(() => {
    if (!clienteBusca.trim() || comanda?.id) { setClientesFiltrados([]); return }
    const t = setTimeout(async () => {
      setBuscandoCliente(true)
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .or(`nome.ilike.%${clienteBusca.trim()}%,telefone.ilike.%${clienteBusca.trim()}%`)
        .order('nome')
        .limit(20)
      setClientesFiltrados((data as Cliente[]) || [])
      setBuscandoCliente(false)
    }, 300)
    return () => clearTimeout(t)
  }, [clienteBusca, comanda?.id, unidadeId])

  const buscarItens = useCallback(async (comandaId: string) => {
    const { data } = await supabase
      .from('comanda_itens')
      .select(`
        *,
        servico:servicos(id, nome, preco),
        produto:produtos(id, nome, preco_venda),
        profissionais:comanda_item_profissionais(
          *, profissional:profissionais(id, nome, cor_agenda)
        )
      `)
      .eq('comanda_id', comandaId)
      .order('created_at')
    setItens((data as unknown as ComandaItem[]) || [])
  }, [supabase])

  useEffect(() => {
    if (comanda?.id) buscarItens(comanda.id)
  }, [comanda?.id, buscarItens])

  const totalBruto = itens.reduce((s, i) => s + i.subtotal, 0)
  const descontoNum = parseFloat(desconto) || 0
  const totalFinal = Math.max(0, totalBruto - descontoNum)
  const isFechada = comanda?.status !== 'aberta' && comanda?.status !== undefined

  async function garantirComanda(): Promise<string | null> {
    if (comanda?.id) return comanda.id
    if (!clienteId) { alert('Selecione o cliente antes de adicionar itens.'); return null }

    setSalvando(true)
    const { data, error } = await supabase
      .from('comandas')
      .insert({ cliente_id: clienteId, unidade_id: unidadeId, status: 'aberta', valor_total: 0, desconto: 0, valor_final: 0 })
      .select('*, cliente:clientes(id, nome, telefone)')
      .single()
    setSalvando(false)

    if (error || !data) { alert(error?.message); return null }
    const novaComanda = data as unknown as Comanda
    setComanda(novaComanda)
    onSalva(novaComanda)
    return novaComanda.id
  }

  async function handleAdicionarItem(item: NovoItem, continuar: boolean) {
    const comandaId = await garantirComanda()
    if (!comandaId) return

    const qtd = item.quantidade
    const preco = item.tipo === 'servico'
      ? servicos.find(s => s.id === item.item_id)?.preco || 0
      : produtos.find(p => p.id === item.item_id)?.preco_venda || 0

    const payload: Record<string, unknown> = {
      comanda_id: comandaId,
      tipo: item.tipo,
      quantidade: qtd,
      preco_unitario: preco,
      subtotal: preco * qtd,
    }
    if (item.tipo === 'servico') payload.servico_id = item.item_id
    else payload.produto_id = item.item_id

    const { data: novoItem, error } = await supabase.from('comanda_itens').insert(payload).select().single()
    if (error || !novoItem) { alert(error?.message); return }

    if (item.tipo === 'servico' && item.profissionais.length > 0) {
      const servico = servicos.find(s => s.id === item.item_id)
      const comissaoServico = servico?.comissao_servico || 0
      const rateios = item.profissionais.filter(p => p.profissional_id).map(p => {
        const prof = profissionais.find(x => x.id === p.profissional_id)
        const valorBase = preco * qtd * (p.participacao / 100)
        const pctComissao = comissaoServico > 0 ? comissaoServico : (prof?.comissao_padrao || 0)
        return {
          comanda_item_id: novoItem.id,
          profissional_id: p.profissional_id,
          percentual_participacao: p.participacao,
          percentual_comissao: pctComissao,
          valor_base: valorBase,
          valor_comissao: valorBase * (pctComissao / 100),
        }
      })
      await supabase.from('comanda_item_profissionais').insert(rateios)
    }

    await atualizarTotaisDb(comandaId)
    buscarItens(comandaId)
    if (!continuar) { setAdicionandoItem(false); setItemEditando(null) }
  }

  async function handleEditarItem(item: NovoItem, continuar: boolean) {
    if (!item.editandoId || !comanda?.id) return
    const qtd = item.quantidade
    const preco = item.tipo === 'servico'
      ? servicos.find(s => s.id === item.item_id)?.preco || 0
      : produtos.find(p => p.id === item.item_id)?.preco_venda || 0

    await supabase.from('comanda_itens').update({
      quantidade: qtd, preco_unitario: preco, subtotal: preco * qtd,
    }).eq('id', item.editandoId)

    await supabase.from('comanda_item_profissionais').delete().eq('comanda_item_id', item.editandoId)

    if (item.tipo === 'servico' && item.profissionais.length > 0) {
      const servico = servicos.find(s => s.id === item.item_id)
      const comissaoServico = servico?.comissao_servico || 0
      const rateios = item.profissionais.filter(p => p.profissional_id).map(p => {
        const prof = profissionais.find(x => x.id === p.profissional_id)
        const valorBase = preco * qtd * (p.participacao / 100)
        const pctComissao = comissaoServico > 0 ? comissaoServico : (prof?.comissao_padrao || 0)
        return {
          comanda_item_id: item.editandoId!,
          profissional_id: p.profissional_id,
          percentual_participacao: p.participacao,
          percentual_comissao: pctComissao,
          valor_base: valorBase,
          valor_comissao: valorBase * (pctComissao / 100),
        }
      })
      await supabase.from('comanda_item_profissionais').insert(rateios)
    }

    await atualizarTotaisDb(comanda.id)
    buscarItens(comanda.id)
    if (!continuar) { setAdicionandoItem(false); setItemEditando(null) }
  }

  async function removerItem(itemId: string) {
    if (!comanda?.id) return
    await supabase.from('comanda_itens').delete().eq('id', itemId)
    await atualizarTotaisDb(comanda.id)
    buscarItens(comanda.id)
  }

  async function atualizarTotaisDb(comandaId: string) {
    const { data } = await supabase.from('comanda_itens').select('subtotal').eq('comanda_id', comandaId)
    const total = (data || []).reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const desc = parseFloat(desconto) || 0
    await supabase.from('comandas').update({
      valor_total: total, desconto: desc, valor_final: Math.max(0, total - desc),
    }).eq('id', comandaId)
  }

  async function handleFechar() {
    if (!comanda?.id) { alert('Adicione pelo menos um item antes de fechar.'); return }
    if (!formaPagamento) { alert('Selecione a forma de pagamento.'); return }
    setFechando(true)
    const desc = parseFloat(desconto) || 0
    const { data } = await supabase.from('comandas')
      .update({ status: 'fechada', data_fechamento: new Date().toISOString(), desconto: desc, valor_total: totalBruto, valor_final: totalFinal, forma_pagamento: formaPagamento })
      .eq('id', comanda.id)
      .select('*, cliente:clientes(id, nome, telefone)').single()
    setFechando(false)
    if (data) { onSalva(data as unknown as Comanda); onClose() }
  }

  async function handleCancelar() {
    if (!comanda?.id) { onClose(); return }
    if (!confirm('Cancelar esta comanda?')) return
    const { data } = await supabase.from('comandas').update({ status: 'cancelada' }).eq('id', comanda.id)
      .select('*, cliente:clientes(id, nome, telefone)').single()
    if (data) onSalva(data as unknown as Comanda)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">
              {isNova ? 'Nova comanda' : `Comanda — ${comanda?.cliente?.nome}`}
            </h2>
            {comanda && (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDateTime(comanda.data_abertura)} ·{' '}
                <span className={`font-medium ${comanda.status === 'aberta' ? 'text-green-600' : comanda.status === 'cancelada' ? 'text-red-600' : 'text-gray-600'}`}>
                  {comanda.status === 'aberta' ? 'Aberta' : comanda.status === 'fechada' ? 'Fechada' : 'Cancelada'}
                </span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Área principal */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Seletor de cliente */}
            {(isNova || comanda) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                {isFechada ? (
                  <p className="text-sm font-medium text-gray-900">{comanda?.cliente?.nome}</p>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text"
                      placeholder="Buscar cliente pelo nome ou telefone..."
                      value={clienteBusca}
                      onChange={e => { setClienteBusca(e.target.value); setClienteId(''); setMostrarClientes(true) }}
                      onFocus={() => setMostrarClientes(true)}
                      disabled={!!comanda?.id}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50 disabled:text-gray-600"
                    />
                    {mostrarClientes && clienteBusca && !comanda?.id && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                        {buscandoCliente ? (
                          <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
                        ) : clientesFiltrados.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-500">Nenhum cliente encontrado</p>
                        ) : clientesFiltrados.map(c => (
                          <button key={c.id}
                            onClick={() => { setClienteId(c.id); setClienteBusca(c.nome); setMostrarClientes(false) }}
                            className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0">
                            <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                            {c.telefone && <p className="text-xs text-gray-500">{c.telefone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Itens da comanda</h3>
                {!isFechada && (
                  <button onClick={() => setAdicionandoItem(true)}
                    className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar item
                  </button>
                )}
              </div>

              {itens.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-400">Nenhum item adicionado</p>
                  {!isFechada && (
                    <button onClick={() => setAdicionandoItem(true)} className="mt-2 text-sm text-amber-700 hover:underline">
                      Adicionar primeiro item
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Descrição</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Profissional</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5">Qtd</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5">Valor unit.</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5">Total</th>
                        {!isFechada && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map(item => {
                        const nome = item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome
                        const profs = item.profissionais || []
                        return (
                          <tr key={item.id} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${item.tipo === 'servico' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>
                                  {item.tipo === 'servico' ? 'S' : 'P'}
                                </span>
                                <span className="text-sm text-gray-900">{nome}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {profs.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {profs.map(p => (
                                    <span key={p.id} className="flex items-center gap-1 text-xs text-gray-600">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.profissional?.cor_agenda || '#6366f1' }} />
                                      {p.profissional?.nome?.split(' ')[0]} ({p.percentual_participacao}%)
                                    </span>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-600 text-right">{item.quantidade}</td>
                            <td className="px-3 py-3 text-sm text-gray-600 text-right">{formatCurrency(item.preco_unitario)}</td>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.subtotal)}</td>
                            {!isFechada && (
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setItemEditando(item); setAdicionandoItem(true) }} className="text-gray-400 hover:text-amber-600 transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => removerItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Resumo lateral */}
          <div className="w-60 flex-shrink-0 border-l border-gray-100 p-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Resumo</h3>

            <div className="space-y-3 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(totalBruto)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Desconto</span>
                {isFechada ? (
                  <span className="text-red-600 font-medium">- {formatCurrency(comanda?.desconto || 0)}</span>
                ) : (
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                    <input type="number" min="0" step="0.01" value={desconto}
                      onChange={e => setDesconto(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-600" />
                  </div>
                )}
              </div>

              <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-3">
                <span>Total</span>
                <span className="text-amber-700 text-base">{formatCurrency(isFechada ? (comanda?.valor_final || 0) : totalFinal)}</span>
              </div>

              {!isFechada && (
                <div className="pt-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pagamento</label>
                  <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                    <option value="">Selecionar...</option>
                    {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              )}

              {isFechada && comanda?.forma_pagamento && (
                <p className="text-xs text-gray-500">
                  Pagamento: <span className="font-medium text-gray-700">
                    {FORMAS_PAGAMENTO.find(f => f.value === comanda.forma_pagamento)?.label}
                  </span>
                </p>
              )}
            </div>

            {!isFechada && (
              <div className="space-y-2 mt-6">
                <button onClick={handleFechar} disabled={fechando}
                  className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  {fechando ? 'Fechando...' : 'Fechar comanda'}
                </button>
                <button onClick={handleCancelar} className="w-full text-sm text-red-500 hover:text-red-700 py-2 transition-colors">
                  Cancelar comanda
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {adicionandoItem && (
        <AdicionarItemModal
          servicos={servicos}
          produtos={produtos}
          profissionais={profissionais}
          itemExistente={itemEditando}
          onClose={() => { setAdicionandoItem(false); setItemEditando(null) }}
          onSalvo={itemEditando ? handleEditarItem : handleAdicionarItem}
        />
      )}

    </div>
  )
}

// ─────────────────────────────────────────────
// Tipos e modal de adicionar item
// ─────────────────────────────────────────────
interface NovoItem {
  tipo: 'servico' | 'produto'
  item_id: string
  quantidade: number
  profissionais: { profissional_id: string; participacao: number }[]
  editandoId?: string
}

function AdicionarItemModal({ servicos, produtos, profissionais, itemExistente, onClose, onSalvo }: {
  servicos: Servico[]
  produtos: Produto[]
  profissionais: Profissional[]
  itemExistente?: ComandaItem | null
  onClose: () => void
  onSalvo: (item: NovoItem, continuar: boolean) => Promise<void> | void
}) {
  const tipoInicial: 'servico' | 'produto' = itemExistente?.tipo ?? 'servico'
  const itemIdInicial = itemExistente?.servico_id || itemExistente?.produto_id || ''
  const profsIniciais = itemExistente?.profissionais?.length
    ? itemExistente.profissionais.map(p => ({ profissional_id: p.profissional_id, participacao: p.percentual_participacao }))
    : [{ profissional_id: profissionais[0]?.id || '', participacao: 100 }]

  const [tipo, setTipo] = useState<'servico' | 'produto'>(tipoInicial)
  const [itemId, setItemId] = useState(itemIdInicial)
  const [quantidade, setQuantidade] = useState(itemExistente?.quantidade ?? 1)
  const [profs, setProfs] = useState(profsIniciais)
  const [salvando, setSalvando] = useState(false)
  const [ultimoAdicionado, setUltimoAdicionado] = useState<string | null>(null)

  const lista = tipo === 'servico' ? servicos : produtos
  const item = lista.find(i => i.id === itemId)
  const servicoSel = tipo === 'servico' ? servicos.find(s => s.id === itemId) : null
  const preco = item ? (tipo === 'servico' ? (item as Servico).preco : (item as Produto).preco_venda) : 0
  const subtotal = preco * quantidade
  const totalPart = profs.reduce((s, p) => s + p.participacao, 0)
  // Prioridade: comissão do serviço (se > 0) > comissão do profissional
  const comissaoServico = servicoSel?.comissao_servico || 0

  function getComissaoProf(profId: string): number {
    if (comissaoServico > 0) return comissaoServico
    return profissionais.find(x => x.id === profId)?.comissao_padrao || 0
  }

  function distribuirIgual(n: number): number[] {
    if (n === 0) return []
    const parte = parseFloat((100 / n).toFixed(2))
    const arr = Array(n).fill(parte)
    const soma = arr.reduce((s: number, v: number) => s + v, 0)
    arr[n - 1] = parseFloat((arr[n - 1] + (100 - soma)).toFixed(2))
    return arr
  }

  function trocarTipo(t: 'servico' | 'produto') {
    setTipo(t)
    setItemId('')
    if (t === 'servico') {
      setProfs([{ profissional_id: profissionais[0]?.id || '', participacao: 100 }])
    } else {
      setProfs([])
    }
  }

  function setProfField(idx: number, field: string, value: string | number) {
    setProfs(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function addProfissional() {
    setProfs(prev => {
      const novo = [...prev, { profissional_id: '', participacao: 0 }]
      const partes = distribuirIgual(novo.length)
      return novo.map((p, i) => ({ ...p, participacao: partes[i] }))
    })
  }

  function removeProf(idx: number) {
    setProfs(prev => {
      const filtrado = prev.filter((_, i) => i !== idx)
      if (filtrado.length === 0) return filtrado
      const partes = distribuirIgual(filtrado.length)
      return filtrado.map((p, i) => ({ ...p, participacao: partes[i] }))
    })
  }

  function resetForm() {
    setItemId('')
    setQuantidade(1)
    setProfs([{ profissional_id: profissionais[0]?.id || '', participacao: 100 }])
  }

  async function handleSalvo(continuar: boolean) {
    if (!itemId) { alert('Selecione um item.'); return }
    if (tipo === 'servico' && profs.length > 0 && Math.abs(totalPart - 100) > 0.01) {
      alert('A soma das participações deve ser 100%.'); return
    }
    setSalvando(true)
    const nomeItem = lista.find(i => i.id === itemId)?.nome || ''
    await onSalvo({ tipo, item_id: itemId, quantidade, profissionais: tipo === 'servico' ? profs : [], editandoId: itemExistente?.id }, continuar)
    setSalvando(false)
    if (continuar) {
      setUltimoAdicionado(nomeItem)
      resetForm()
      setTimeout(() => setUltimoAdicionado(null), 2500)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">{itemExistente ? 'Editar item' : 'Adicionar item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Tipo + seleção na mesma linha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo e item <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {/* Toggle ícone */}
              <button
                onClick={() => trocarTipo(tipo === 'servico' ? 'produto' : 'servico')}
                title={tipo === 'servico' ? 'Clique para Produto' : 'Clique para Serviço'}
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                  tipo === 'servico'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-blue-400 bg-blue-50 text-blue-600'
                }`}>
                {tipo === 'servico' ? <Scissors className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              </button>

              {/* Seleção do item */}
              <select value={itemId} onChange={e => setItemId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
                <option value="">
                  {tipo === 'servico' ? 'Selecionar serviço...' : 'Selecionar produto...'}
                </option>
                {lista.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.nome} — {formatCurrency(tipo === 'servico' ? (i as Servico).preco : (i as Produto).preco_venda)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {tipo === 'servico' ? '✂ Modo serviço' : '🛍 Modo produto'} — clique no ícone para trocar
            </p>
          </div>

          {/* Quantidade + preço */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço unit.</label>
              <div className="px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-600">
                {preco > 0 ? formatCurrency(preco) : '—'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
              <div className={`px-3 py-2 border rounded-lg text-sm font-semibold ${subtotal > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
                {subtotal > 0 ? formatCurrency(subtotal) : '—'}
              </div>
            </div>
          </div>

          {/* Profissionais (só serviço) */}
          {tipo === 'servico' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Profissionais e rateio de comissão</p>
                  <p className="text-xs text-gray-400 mt-0.5">A comissão é calculada sobre o valor proporcional de cada profissional</p>
                </div>
                <button onClick={addProfissional}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 transition-colors flex-shrink-0 ml-4">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {/* Cabeçalho */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
                <div className="col-span-5">Profissional</div>
                <div className="col-span-3 text-center">Participação</div>
                <div className="col-span-3 text-center">Comissão</div>
                <div className="col-span-1" />
              </div>

              <div className="divide-y divide-gray-100">
                {profs.map((p, idx) => {
                  const profSel = profissionais.find(x => x.id === p.profissional_id)
                  const valorBase = subtotal * (p.participacao / 100)
                  const pctComissao = getComissaoProf(p.profissional_id)
                  const valorComissao = valorBase * (pctComissao / 100)
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                      <div className="col-span-5 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: profSel?.cor_agenda || '#d1d5db' }}>
                          {profSel ? profSel.nome.charAt(0) : '?'}
                        </div>
                        <select value={p.profissional_id} onChange={e => setProfField(idx, 'profissional_id', e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-600">
                          <option value="">Selecionar...</option>
                          {profissionais.map(prof => (
                            <option key={prof.id} value={prof.id}>{prof.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <input type="number" min="0" max="100" step="1" value={p.participacao}
                            onChange={e => setProfField(idx, 'participacao', parseFloat(e.target.value) || 0)}
                            className="w-full pr-5 pl-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center bg-white focus:outline-none focus:ring-1 focus:ring-amber-600" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                        {subtotal > 0 && p.participacao > 0 && (
                          <p className="text-xs text-gray-400 text-center mt-0.5">{formatCurrency(valorBase)}</p>
                        )}
                      </div>
                      <div className="col-span-3 text-center">
                        <p className="text-xs font-medium text-gray-700">
                          {p.profissional_id ? `${pctComissao}%` : '—'}
                          {comissaoServico > 0 && p.profissional_id && (
                            <span className="ml-1 text-amber-600 text-xs">(serviço)</span>
                          )}
                        </p>
                        {subtotal > 0 && p.profissional_id && p.participacao > 0 && (
                          <p className="text-xs text-amber-700 font-semibold">{formatCurrency(valorComissao)}</p>
                        )}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {profs.length > 1 && (
                          <button onClick={() => removeProf(idx)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className={`text-xs px-4 py-2 border-t border-gray-100 ${Math.abs(totalPart - 100) > 0.01 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                Total participação: {totalPart}% {Math.abs(totalPart - 100) > 0.01 ? '— deve somar 100%' : '✓'}
              </p>
            </div>
          )}

          {itemId && (
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-100">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-amber-700">{formatCurrency(subtotal)}</span>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {ultimoAdicionado && (
            <p className="text-xs text-green-600 font-medium mb-3 text-center">
              ✓ "{ultimoAdicionado}" adicionado — escolha o próximo item
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Fechar
            </button>
            {!itemExistente && (
              <button onClick={() => handleSalvo(true)} disabled={!itemId || salvando}
                className="px-4 py-2 border border-amber-400 hover:bg-amber-50 disabled:opacity-40 text-amber-800 text-sm font-medium rounded-lg transition-colors">
                + Adicionar outro
              </button>
            )}
            <button onClick={() => handleSalvo(false)} disabled={!itemId || salvando}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
              {salvando ? 'Salvando...' : itemExistente ? 'Salvar alterações' : 'Adicionar e fechar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
