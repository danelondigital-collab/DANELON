'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Scissors } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Pacote, Cliente, Servico, PacotePredefinido } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  pacote: Pacote | null
  clientes: Cliente[]
  profissionais: { id: string; nome: string }[]
  servicos: Servico[]
  pacotesPredefinidos: PacotePredefinido[]
  unidadeId: string
  onClose: () => void
  onSalvo: (p: Pacote) => void
  onExcluido: (id: string) => void
}

interface ItemForm {
  servico_id: string
  descricao: string
  quantidade: number
  valor_unitario: number
  desconto: number
}

function itemVazio(): ItemForm {
  return { servico_id: '', descricao: '', quantidade: 1, valor_unitario: 0, desconto: 0 }
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'misto', label: 'Misto' },
]

export default function PacoteModal({ pacote, clientes, profissionais, servicos, pacotesPredefinidos, unidadeId, onClose, onSalvo, onExcluido }: Props) {
  const supabase = createClient()
  const isNovo = !pacote
  const travado = pacote?.status === 'finalizado' || pacote?.status === 'cancelado'

  const [clienteBusca, setClienteBusca] = useState(pacote?.cliente?.nome || '')
  const [clienteId, setClienteId] = useState(pacote?.cliente_id || '')
  const [mostrarClientes, setMostrarClientes] = useState(false)
  const [data, setData] = useState(pacote?.data || hoje())
  const [validade, setValidade] = useState(pacote?.validade || '')
  const [vendedorId, setVendedorId] = useState(pacote?.vendedor_id || '')
  const [predefinidoId, setPredefinidoId] = useState('')
  const [itens, setItens] = useState<ItemForm[]>(
    pacote?.itens?.length
      ? pacote.itens.map(i => ({ servico_id: i.servico_id || '', descricao: i.descricao, quantidade: i.quantidade, valor_unitario: i.valor_unitario, desconto: i.desconto }))
      : [itemVazio()]
  )
  const [descontoGeral, setDescontoGeral] = useState(pacote?.desconto?.toString() || '0')
  const [cashback, setCashback] = useState(pacote?.cashback?.toString() || '0')
  const [formaPagamento, setFormaPagamento] = useState(pacote?.forma_pagamento || '')
  const [creditoAplicado, setCreditoAplicado] = useState(pacote?.credito_utilizado || 0)
  const [saldoCredito, setSaldoCredito] = useState(0)
  const [observacao, setObservacao] = useState(pacote?.observacao || '')
  const [salvando, setSalvando] = useState(false)
  const [faturando, setFaturando] = useState(false)
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  const clientesFiltrados = clienteBusca.trim() && !clienteId
    ? clientes.filter(c => c.nome.toLowerCase().includes(clienteBusca.toLowerCase())).slice(0, 20)
    : []

  useEffect(() => {
    if (!clienteId) { setSaldoCredito(0); return }
    supabase.from('creditos_clientes').select('tipo, valor').eq('cliente_id', clienteId).then(({ data }) => {
      if (!data) return
      const saldo = data.reduce((s, r) => r.tipo === 'entrada' ? s + r.valor : s - r.valor, 0)
      setSaldoCredito(Math.max(0, parseFloat(saldo.toFixed(2))))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const totalItens = itens.reduce((s, i) => s + Math.max(0, i.quantidade * i.valor_unitario - i.desconto), 0)
  const descontoGeralNum = parseFloat(descontoGeral) || 0
  const cashbackNum = parseFloat(cashback) || 0
  const totalFinal = Math.max(0, totalItens - descontoGeralNum - creditoAplicado)

  function selecionarCliente(c: Cliente) {
    setClienteId(c.id)
    setClienteBusca(c.nome)
    setMostrarClientes(false)
  }

  function atualizarItem(index: number, mudancas: Partial<ItemForm>) {
    setItens(prev => prev.map((it, i) => i === index ? { ...it, ...mudancas } : it))
  }

  function selecionarServico(index: number, servicoId: string) {
    const servico = servicos.find(s => s.id === servicoId)
    atualizarItem(index, {
      servico_id: servicoId,
      descricao: servico?.nome || '',
      valor_unitario: servico?.preco || 0,
    })
  }

  function aplicarPredefinido(id: string) {
    setPredefinidoId(id)
    if (!id) return
    const predefinido = pacotesPredefinidos.find(p => p.id === id)
    if (!predefinido?.itens?.length) return
    setItens(predefinido.itens.map(i => ({
      servico_id: i.servico_id || '',
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: 0,
    })))
  }

  function adicionarItem() {
    setItens(prev => [...prev, itemVazio()])
  }

  function removerItem(index: number) {
    setItens(prev => prev.length === 1 ? [itemVazio()] : prev.filter((_, i) => i !== index))
  }

  async function persistir(novoStatus?: 'finalizado'): Promise<Pacote | null> {
    if (!clienteId) { setErro('Selecione o cliente.'); return null }
    const itensValidos = itens.filter(i => i.descricao.trim())
    if (itensValidos.length === 0) { setErro('Adicione pelo menos um serviço ao pacote.'); return null }
    if (creditoAplicado > saldoCredito + 0.01) { setErro('Crédito aplicado maior que o saldo disponível do cliente.'); return null }
    if (novoStatus === 'finalizado' && !formaPagamento) { setErro('Selecione a forma de pagamento antes de faturar.'); return null }
    setErro('')

    const payload: Record<string, unknown> = {
      cliente_id: clienteId,
      unidade_id: unidadeId,
      vendedor_id: vendedorId || null,
      data,
      validade: validade || null,
      desconto: descontoGeralNum,
      credito_utilizado: creditoAplicado,
      cashback: cashbackNum,
      forma_pagamento: formaPagamento || null,
      valor_total: totalItens,
      valor_final: totalFinal,
      observacao: observacao || null,
    }
    if (novoStatus) payload.status = novoStatus

    let pacoteSalvo: Pacote
    if (pacote?.id) {
      const { data: atualizado, error } = await supabase.from('pacotes').update(payload).eq('id', pacote.id)
        .select('*, cliente:clientes(id, nome, telefone), vendedor:profissionais(id, nome)').single()
      if (error || !atualizado) { setErro(error?.message || 'Erro ao salvar.'); return null }
      pacoteSalvo = atualizado as unknown as Pacote
    } else {
      const { data: criado, error } = await supabase.from('pacotes').insert(payload)
        .select('*, cliente:clientes(id, nome, telefone), vendedor:profissionais(id, nome)').single()
      if (error || !criado) { setErro(error?.message || 'Erro ao salvar.'); return null }
      pacoteSalvo = criado as unknown as Pacote
    }

    await supabase.from('pacote_itens').delete().eq('pacote_id', pacoteSalvo.id)
    await supabase.from('pacote_itens').insert(itensValidos.map(i => ({
      pacote_id: pacoteSalvo.id,
      servico_id: i.servico_id || null,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      desconto: i.desconto,
      total: Math.max(0, i.quantidade * i.valor_unitario - i.desconto),
    })))

    return pacoteSalvo
  }

  async function handleSalvar() {
    setSalvando(true)
    const salvo = await persistir()
    setSalvando(false)
    if (salvo) { onSalvo(salvo); onClose() }
  }

  async function handleFaturar() {
    setFaturando(true)
    const salvo = await persistir('finalizado')
    if (!salvo) { setFaturando(false); return }

    if (creditoAplicado > 0) {
      await supabase.from('creditos_clientes').insert({
        cliente_id: salvo.cliente_id,
        tipo: 'saida',
        valor: creditoAplicado,
        descricao: `Crédito utilizado no pacote #${salvo.numero}`,
      })
    }
    if (cashbackNum > 0) {
      await supabase.from('creditos_clientes').insert({
        cliente_id: salvo.cliente_id,
        tipo: 'entrada',
        valor: cashbackNum,
        descricao: `Cashback do pacote #${salvo.numero}`,
      })
    }

    setFaturando(false)
    onSalvo(salvo)
    onClose()
  }

  async function handleExcluir() {
    if (!pacote?.id) return
    if (!confirm(`Excluir o pacote #${pacote.numero}? Essa ação não pode ser desfeita.`)) return
    setExcluindo(true)
    const { error } = await supabase.from('pacotes').delete().eq('id', pacote.id)
    setExcluindo(false)
    if (error) {
      alert(
        error.code === '23503'
          ? 'Não é possível excluir: este pacote já tem itens usados em comandas.'
          : error.message
      )
      return
    }
    onExcluido(pacote.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">
            {isNovo ? 'Nova comanda de pacote' : `Comanda de pacote #${pacote?.numero}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
              <input
                type="text" value={clienteBusca} disabled={travado}
                onChange={e => { setClienteBusca(e.target.value); setClienteId(''); setMostrarClientes(true) }}
                onFocus={() => setMostrarClientes(true)}
                placeholder="Busque por um cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50"
              />
              {mostrarClientes && clientesFiltrados.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientesFiltrados.map(c => (
                    <button key={c.id} type="button" onClick={() => selecionarCliente(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      {c.nome} {c.telefone && <span className="text-gray-400">· {c.telefone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={data} disabled={travado} onChange={e => setData(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
              <input type="date" value={validade} disabled={travado} onChange={e => setValidade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pacote Predefinido</label>
              <select value={predefinidoId} disabled={travado} onChange={e => aplicarPredefinido(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white disabled:bg-gray-50">
                <option value="">Selecione um pacote predefinido</option>
                {pacotesPredefinidos.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendedor</label>
              <select value={vendedorId} disabled={travado} onChange={e => setVendedorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white disabled:bg-gray-50">
                <option value="">Selecione um vendedor</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
              <select value={formaPagamento} disabled={travado} onChange={e => setFormaPagamento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white disabled:bg-gray-50">
                <option value="">Selecionar...</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Itens do pacote</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">Descrição</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-3 py-2 w-20">Qtde.</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-32">Valor unitário</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 py-2 w-28">Desconto</th>
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
                          <select value={item.servico_id} disabled={travado} onChange={e => selecionarServico(idx, e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white disabled:bg-gray-50">
                            <option value="">Selecionar serviço...</option>
                            {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" value={item.quantidade} disabled={travado}
                          onChange={e => atualizarItem(idx, { quantidade: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={item.valor_unitario} disabled={travado}
                          onChange={e => atualizarItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={item.desconto} disabled={travado}
                          onChange={e => atualizarItem(idx, { desconto: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(Math.max(0, item.quantidade * item.valor_unitario - item.desconto))}
                      </td>
                      <td className="px-2 py-2">
                        {!travado && (
                          <button onClick={() => removerItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!travado && (
              <button onClick={adicionarItem} className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 hover:underline">
                <Plus className="w-4 h-4" /> Adicionar item
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <textarea value={observacao} disabled={travado} onChange={e => setObservacao(e.target.value)} rows={4}
                placeholder="Escreva aqui"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
            </div>

            <div className="w-full md:w-72 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-gray-600">Desconto</label>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input type="number" min="0" step="0.01" value={descontoGeral} disabled={travado}
                    onChange={e => setDescontoGeral(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-gray-600">Crédito <span className="text-xs text-gray-400">(saldo {formatCurrency(saldoCredito)})</span></label>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input type="number" min="0" step="0.01" max={saldoCredito} value={creditoAplicado} disabled={travado}
                    onChange={e => setCreditoAplicado(Math.min(parseFloat(e.target.value) || 0, saldoCredito))}
                    className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-gray-600">Cashback</label>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <input type="number" min="0" step="0.01" value={cashback} disabled={travado}
                    onChange={e => setCashback(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:bg-gray-50" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <label className="text-sm font-semibold text-gray-900">Total</label>
                <span className="text-base font-bold text-gray-900">{formatCurrency(totalFinal)}</span>
              </div>
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          {pacote?.id ? (
            <button onClick={handleExcluir} disabled={excluindo}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 font-medium">
              {excluindo ? 'Excluindo...' : 'Excluir pacote'}
            </button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            {!travado && (
              <>
                <button onClick={handleSalvar} disabled={salvando || faturando}
                  className="px-4 py-2 border border-amber-700 text-amber-700 hover:bg-amber-50 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={handleFaturar} disabled={salvando || faturando}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
                  {faturando ? 'Faturando...' : 'Faturar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
