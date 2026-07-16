'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Search, Scissors, ShoppingBag, Pencil, Wallet, Gift, MessageCircle, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Comanda, ComandaItem, Cliente, Profissional, Servico, Produto, ComissaoProfissionalItem, Pacote } from '@/types'
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils'
import HistoricoLog from '@/components/ui/historico-log'
import HistoricoClienteDrawer from '@/components/ui/historico-cliente-drawer'

interface Props {
  comanda: Comanda | null
  clientes: Cliente[]
  profissionais: Profissional[]
  servicos: Servico[]
  produtos: Produto[]
  comissoesProfissional: ComissaoProfissionalItem[]
  unidadeId: string
  perfil: string
  onClose: () => void
  onSalva: (c: Comanda) => void
  onExcluida: (id: string) => void
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'misto', label: 'Misto' },
]

export default function ComandaModal({ comanda: comandaInicial, profissionais, servicos, produtos, comissoesProfissional, unidadeId, perfil, onClose, onSalva, onExcluida }: Props) {
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
  const [excluindo, setExcluindo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [saldoCredito, setSaldoCredito] = useState(0)
  const [creditoAplicado, setCreditoAplicado] = useState(comandaInicial?.credito_utilizado || 0)
  const [sinalComanda, setSinalComanda] = useState(comandaInicial?.sinal || 0)
  const [valorRecebido, setValorRecebido] = useState('')
  const [observacoes, setObservacoes] = useState(comandaInicial?.observacoes || '')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [pacotesCliente, setPacotesCliente] = useState<Pacote[]>([])
  const [usandoItemPacote, setUsandoItemPacote] = useState<string | null>(null)
  const [profissionalPacotePorItem, setProfissionalPacotePorItem] = useState<Record<string, string>>({})
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(comandaInicial?.cliente || null)
  const [comandasAbertasCount, setComandasAbertasCount] = useState(0)

  useEffect(() => {
    if (!clienteBusca.trim() || comanda?.id) { setClientesFiltrados([]); return }
    const termo = clienteBusca.trim()
    const t = setTimeout(async () => {
      setBuscandoCliente(true)
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone, data_nascimento')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
        .order('nome')
        .limit(100)
      const termoLower = termo.toLowerCase()
      const ordenados = ((data as Cliente[]) || []).sort((a, b) => {
        const aComeca = a.nome.toLowerCase().startsWith(termoLower) ? 0 : 1
        const bComeca = b.nome.toLowerCase().startsWith(termoLower) ? 0 : 1
        if (aComeca !== bComeca) return aComeca - bComeca
        return a.nome.localeCompare(b.nome)
      })
      setClientesFiltrados(ordenados.slice(0, 20))
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

  useEffect(() => {
    const cId = comanda?.cliente_id || clienteId
    if (cId) {
      buscarSaldoCredito(cId)
      buscarPacotesCliente(cId)
      buscarComandasAbertas(cId)
    } else {
      setPacotesCliente([])
      setComandasAbertasCount(0)
    }
  }, [comanda?.cliente_id, clienteId])

  const totalBruto = itens.reduce((s, i) => s + i.subtotal, 0)
  const descontoItensNum = itens.reduce((s, i) => s + Math.max(0, i.preco_unitario * i.quantidade - i.subtotal), 0)
  const descontoNum = parseFloat(desconto) || 0
  const totalFinal = Math.max(0, totalBruto - descontoNum - creditoAplicado - sinalComanda)
  const valorRecebidoNum = parseFloat(valorRecebido) || 0
  const creditoGerado = valorRecebidoNum > totalFinal ? parseFloat((valorRecebidoNum - totalFinal).toFixed(2)) : 0
  const isFechada = comanda?.status !== 'aberta' && comanda?.status !== undefined
  const clienteExibido = comanda?.cliente || clienteSelecionado

  async function buscarSaldoCredito(cId: string) {
    const { data } = await supabase
      .from('creditos_clientes')
      .select('tipo, valor')
      .eq('cliente_id', cId)
    if (!data) return
    const saldo = data.reduce((s, r) => r.tipo === 'entrada' ? s + r.valor : s - r.valor, 0)
    setSaldoCredito(Math.max(0, parseFloat(saldo.toFixed(2))))
  }

  async function buscarPacotesCliente(cId: string) {
    const hoje = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('pacotes')
      .select('*, itens:pacote_itens(*, servico:servicos(id, nome, preco))')
      .eq('cliente_id', cId)
      .eq('status', 'finalizado')
      .or(`validade.is.null,validade.gte.${hoje}`)
      .order('numero', { ascending: false })
    setPacotesCliente((data as unknown as Pacote[]) || [])
  }

  async function buscarComandasAbertas(cId: string) {
    const { count } = await supabase
      .from('comandas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', cId)
      .eq('status', 'aberta')
    setComandasAbertasCount(count || 0)
  }

  async function usarItemPacote(pacote: Pacote, item: NonNullable<Pacote['itens']>[number]) {
    const profissionalId = profissionalPacotePorItem[item.id]
    if (!profissionalId) { alert('Selecione o profissional que irá realizar o serviço.'); return }

    const comandaId = await garantirComanda()
    if (!comandaId) return
    setUsandoItemPacote(item.id)

    const { data: novoItem, error } = await supabase.from('comanda_itens').insert({
      comanda_id: comandaId,
      tipo: 'servico',
      servico_id: item.servico_id,
      quantidade: 1,
      preco_unitario: item.valor_unitario,
      desconto_percentual: 100,
      subtotal: 0,
      pacote_item_id: item.id,
    }).select().single()

    if (error || !novoItem) { alert(error?.message || 'Erro ao usar item do pacote.'); setUsandoItemPacote(null); return }

    const servico = servicos.find(s => s.id === item.servico_id)
    const comissaoServico = servico?.comissao_servico || 0
    const especifica = comissoesProfissional.find(c =>
      c.profissional_id === profissionalId && c.tipo === 'servico' && c.servico_id === item.servico_id
    )
    const pctComissao = especifica ? especifica.percentual : comissaoServico
    const valorBase = item.valor_unitario

    await supabase.from('comanda_item_profissionais').insert({
      comanda_item_id: novoItem.id,
      profissional_id: profissionalId,
      percentual_participacao: 100,
      percentual_comissao: pctComissao,
      valor_base: valorBase,
      valor_comissao: valorBase * (pctComissao / 100),
    })

    await supabase.from('pacote_itens').update({ quantidade_usada: item.quantidade_usada + 1 }).eq('id', item.id)

    setPacotesCliente(prev => prev.map(p => p.id !== pacote.id ? p : {
      ...p,
      itens: p.itens?.map(i => i.id === item.id ? { ...i, quantidade_usada: i.quantidade_usada + 1 } : i),
    }))
    setProfissionalPacotePorItem(prev => { const next = { ...prev }; delete next[item.id]; return next })

    await atualizarTotaisDb(comandaId)
    await buscarItens(comandaId)
    setUsandoItemPacote(null)
  }

  async function garantirComanda(): Promise<string | null> {
    if (comanda?.id) return comanda.id
    if (!clienteId) { alert('Selecione o cliente antes de adicionar itens.'); return null }

    setSalvando(true)
    const { data, error } = await supabase
      .from('comandas')
      .insert({ cliente_id: clienteId, unidade_id: unidadeId, status: 'aberta', valor_total: 0, desconto: 0, valor_final: 0 })
      .select('*, cliente:clientes(id, nome, telefone, data_nascimento)')
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
    const subtotalComDesconto = preco * qtd * (1 - item.desconto_percentual / 100)

    const payload: Record<string, unknown> = {
      comanda_id: comandaId,
      tipo: item.tipo,
      quantidade: qtd,
      preco_unitario: preco,
      desconto_percentual: item.desconto_percentual,
      subtotal: subtotalComDesconto,
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
        const valorBase = subtotalComDesconto * (p.participacao / 100)
        const especifica = comissoesProfissional.find(c =>
          c.profissional_id === p.profissional_id && c.tipo === 'servico' && c.servico_id === item.item_id
        )
        const pctComissao = especifica ? especifica.percentual : (comissaoServico > 0 ? comissaoServico : 0)
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
    const subtotalComDesconto = preco * qtd * (1 - item.desconto_percentual / 100)

    await supabase.from('comanda_itens').update({
      quantidade: qtd, preco_unitario: preco, desconto_percentual: item.desconto_percentual, subtotal: subtotalComDesconto,
    }).eq('id', item.editandoId)

    await supabase.from('comanda_item_profissionais').delete().eq('comanda_item_id', item.editandoId)

    if (item.tipo === 'servico' && item.profissionais.length > 0) {
      const servico = servicos.find(s => s.id === item.item_id)
      const comissaoServico = servico?.comissao_servico || 0
      const rateios = item.profissionais.filter(p => p.profissional_id).map(p => {
        const prof = profissionais.find(x => x.id === p.profissional_id)
        const valorBase = subtotalComDesconto * (p.participacao / 100)
        const especifica = comissoesProfissional.find(c =>
          c.profissional_id === p.profissional_id && c.tipo === 'servico' && c.servico_id === item.item_id
        )
        const pctComissao = especifica ? especifica.percentual : (comissaoServico > 0 ? comissaoServico : 0)
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
    const item = itens.find(i => i.id === itemId)
    await supabase.from('comanda_itens').delete().eq('id', itemId)

    if (item?.pacote_item_id) {
      const pacoteItemId = item.pacote_item_id
      const pacote = pacotesCliente.find(p => p.itens?.some(i => i.id === pacoteItemId))
      const pacoteItem = pacote?.itens?.find(i => i.id === pacoteItemId)
      if (pacoteItem) {
        const novaQtdUsada = Math.max(0, pacoteItem.quantidade_usada - item.quantidade)
        await supabase.from('pacote_itens').update({ quantidade_usada: novaQtdUsada }).eq('id', pacoteItemId)
        setPacotesCliente(prev => prev.map(p => p.id !== pacote!.id ? p : {
          ...p,
          itens: p.itens?.map(i => i.id === pacoteItemId ? { ...i, quantidade_usada: novaQtdUsada } : i),
        }))
      }
    }

    await atualizarTotaisDb(comanda.id)
    buscarItens(comanda.id)
  }

  async function atualizarTotaisDb(comandaId: string) {
    const { data } = await supabase.from('comanda_itens').select('subtotal').eq('comanda_id', comandaId)
    const total = (data || []).reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const desc = parseFloat(desconto) || 0
    await supabase.from('comandas').update({
      valor_total: total, desconto: desc, credito_utilizado: creditoAplicado,
      sinal: sinalComanda,
      valor_final: Math.max(0, total - desc - creditoAplicado - sinalComanda),
    }).eq('id', comandaId)
  }

  async function handleFechar() {
    if (!comanda?.id) { alert('Adicione pelo menos um item antes de fechar.'); return }
    if (!formaPagamento) { alert('Selecione a forma de pagamento.'); return }
    if (creditoAplicado > saldoCredito + 0.01) { alert('Crédito aplicado maior que o saldo disponível.'); return }
    setFechando(true)
    const desc = parseFloat(desconto) || 0
    const { data } = await supabase.from('comandas')
      .update({
        status: 'fechada',
        data_fechamento: new Date().toISOString(),
        desconto: desc,
        credito_utilizado: creditoAplicado,
        sinal: sinalComanda,
        valor_total: totalBruto,
        valor_final: totalFinal,
        forma_pagamento: formaPagamento,
      })
      .eq('id', comanda.id)
      .select('*, cliente:clientes(id, nome, telefone, data_nascimento)').single()

    if (creditoAplicado > 0) {
      await supabase.from('creditos_clientes').insert({
        cliente_id: comanda.cliente_id,
        comanda_id: comanda.id,
        tipo: 'saida',
        valor: creditoAplicado,
        descricao: `Crédito utilizado na comanda`,
      })
    }

    if (creditoGerado > 0) {
      await supabase.from('creditos_clientes').insert({
        cliente_id: comanda.cliente_id,
        comanda_id: comanda.id,
        tipo: 'entrada',
        valor: creditoGerado,
        descricao: `Crédito gerado por excesso de pagamento`,
      })
    }

    setFechando(false)
    if (data) { onSalva(data as unknown as Comanda); onClose() }
  }

  async function salvarObservacoes() {
    if (isFechada) return
    if (!comanda?.id && !observacoes.trim()) return
    setSalvandoObs(true)
    const comandaId = await garantirComanda()
    if (comandaId) {
      await supabase.from('comandas').update({ observacoes: observacoes || null }).eq('id', comandaId)
    }
    setSalvandoObs(false)
  }

  async function handleCancelar() {
    if (!comanda?.id) { onClose(); return }
    if (!confirm('Cancelar esta comanda?')) return
    const { data } = await supabase.from('comandas').update({ status: 'cancelada' }).eq('id', comanda.id)
      .select('*, cliente:clientes(id, nome, telefone, data_nascimento)').single()
    if (data) onSalva(data as unknown as Comanda)
    onClose()
  }

  async function handleExcluir() {
    if (!comanda?.id) { onClose(); return }
    if (!confirm('Excluir esta comanda e todos os itens dela? Essa ação não pode ser desfeita.')) return
    setExcluindo(true)
    const { error } = await supabase.from('comandas').delete().eq('id', comanda.id)
    setExcluindo(false)
    if (error) { alert(error.message); return }
    onExcluida(comanda.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl mx-4 flex flex-col max-h-[92vh]">

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
          {/* Painel da cliente */}
          {clienteExibido && (
            <div className="w-64 flex-shrink-0 border-r border-gray-100 p-5 overflow-y-auto space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-xl font-semibold text-gray-400">
                  {clienteExibido.nome.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-2">{clienteExibido.nome}</p>
                {clienteExibido.telefone && <p className="text-xs text-gray-500">{clienteExibido.telefone}</p>}
                {clienteExibido.telefone && (
                  <a
                    href={`https://wa.me/55${clienteExibido.telefone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" /> Conversar
                  </a>
                )}
              </div>

              <div className="space-y-2.5 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Gift className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{clienteExibido.data_nascimento ? `Aniversário: ${formatDate(clienteExibido.data_nascimento)}` : 'Aniversário não definido'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Wallet className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{formatCurrency(saldoCredito)} em crédito</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <ShoppingBag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{comandasAbertasCount} comanda{comandasAbertasCount !== 1 ? 's' : ''} em aberto</span>
                </div>
                <button
                  onClick={() => setHistoricoAberto(true)}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> Histórico da cliente
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Pacotes</p>
                {pacotesCliente.length === 0 ? (
                  <p className="text-xs text-gray-400">Não há pacotes disponíveis</p>
                ) : (
                  <div className="space-y-2">
                    {pacotesCliente.map(pacote => {
                      const itensComSaldo = (pacote.itens || []).filter(i => i.quantidade_usada < i.quantidade)
                      if (itensComSaldo.length === 0) return null
                      return (
                        <div key={pacote.id} className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                          <p className="text-xs font-medium text-amber-800 mb-1.5">
                            Pacote #{pacote.numero}{pacote.validade ? ` · até ${formatDate(pacote.validade)}` : ''}
                          </p>
                          <div className="space-y-2">
                            {itensComSaldo.map(item => (
                              <div key={item.id} className="space-y-1">
                                <span className="text-xs text-gray-600 leading-tight">
                                  {item.descricao}
                                  <span className="text-gray-400"> ({item.quantidade - item.quantidade_usada}/{item.quantidade})</span>
                                </span>
                                {!isFechada && (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={profissionalPacotePorItem[item.id] || ''}
                                      onChange={e => setProfissionalPacotePorItem(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      className="flex-1 min-w-0 px-1.5 py-1 border border-amber-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-600"
                                    >
                                      <option value="">Profissional...</option>
                                      {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                    <button
                                      onClick={() => usarItemPacote(pacote, item)}
                                      disabled={usandoItemPacote === item.id || !profissionalPacotePorItem[item.id]}
                                      className="flex-shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50 hover:underline"
                                    >
                                      {usandoItemPacote === item.id ? '...' : 'Usar'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                      onChange={e => { setClienteBusca(e.target.value); setClienteId(''); setClienteSelecionado(null); setMostrarClientes(true) }}
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
                            onClick={() => { setClienteId(c.id); setClienteBusca(c.nome); setClienteSelecionado(c); setMostrarClientes(false) }}
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
                        <th className="text-right text-xs font-medium text-gray-500 px-3 py-2.5">Desc.</th>
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
                                {item.pacote_item_id && (
                                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 flex-shrink-0">
                                    <Gift className="w-3 h-3" /> Pacote
                                  </span>
                                )}
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
                            <td className="px-3 py-3 text-sm text-right">
                              {item.desconto_percentual > 0
                                ? <span className="text-orange-600 font-medium">{item.desconto_percentual}%</span>
                                : <span className="text-gray-400">—</span>}
                            </td>
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

            {/* Observações/descrição da comanda */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Observação</label>
                {salvandoObs && <span className="text-xs text-gray-400">Salvando...</span>}
              </div>
              {isFechada ? (
                <p className="text-sm text-gray-600">{observacoes || '—'}</p>
              ) : (
                <textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  onBlur={salvarObservacoes}
                  rows={2}
                  placeholder="Anotações sobre esta comanda..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                />
              )}
            </div>

            {/* Histórico de alterações — apenas admin */}
            {comanda && perfil === 'admin' && (
              <HistoricoLog tabela="comanda" registroId={comanda.id} />
            )}
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

              {/* Desconto por item */}
              {descontoItensNum > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 text-xs pl-2 border-l-2 border-red-200">↳ por item</span>
                  <span className="text-red-500 font-medium text-xs">- {formatCurrency(descontoItensNum)}</span>
                </div>
              )}

              {/* Crédito */}
              {!isFechada && saldoCredito > 0 && (
                <div className="border border-green-200 rounded-lg p-2.5 bg-green-50 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-700">Crédito disponível: {formatCurrency(saldoCredito)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Usar:</span>
                    <div className="relative flex-1">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <input type="number" min="0" max={Math.min(saldoCredito, Math.max(0, totalBruto - descontoNum))} step="0.01"
                        value={creditoAplicado || ''}
                        onChange={e => setCreditoAplicado(Math.min(saldoCredito, Math.max(0, parseFloat(e.target.value) || 0)))}
                        placeholder="0,00"
                        className="w-full pl-6 pr-2 py-1 border border-green-200 rounded text-xs text-right bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                    </div>
                    <button onClick={() => setCreditoAplicado(Math.min(saldoCredito, Math.max(0, totalBruto - descontoNum)))}
                      className="text-xs text-green-700 font-medium hover:underline whitespace-nowrap">
                      Tudo
                    </button>
                  </div>
                </div>
              )}

              {isFechada && (comanda?.credito_utilizado || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1"><Wallet className="w-3 h-3" /> Crédito usado</span>
                  <span className="text-green-600 font-medium">- {formatCurrency(comanda?.credito_utilizado || 0)}</span>
                </div>
              )}

              {!isFechada && creditoAplicado > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Crédito usado</span>
                  <span className="text-green-600 font-medium">- {formatCurrency(creditoAplicado)}</span>
                </div>
              )}

              {/* Sinal */}
              {isFechada ? (
                (comanda?.sinal || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sinal</span>
                    <span className="text-amber-600 font-medium">- {formatCurrency(comanda?.sinal || 0)}</span>
                  </div>
                )
              ) : (
                <div className="border border-amber-200 rounded-lg p-2.5 bg-amber-50 space-y-1.5">
                  <span className="text-xs font-medium text-amber-700">Sinal (valor pago antecipado)</span>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={sinalComanda || ''}
                        onChange={e => setSinalComanda(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0,00"
                        className="w-full pl-6 pr-2 py-1 border border-amber-200 rounded text-xs text-right bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    {sinalComanda > 0 && (
                      <button onClick={() => setSinalComanda(0)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    )}
                  </div>
                  {sinalComanda > 0 && (
                    <p className="text-xs text-amber-700">- {formatCurrency(sinalComanda)} abatido do total</p>
                  )}
                </div>
              )}

              <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-3">
                <span>Total</span>
                <span className="text-amber-700 text-base">{formatCurrency(isFechada ? (comanda?.valor_final || 0) : totalFinal)}</span>
              </div>

              {!isFechada && (
                <>
                  <div className="pt-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pagamento</label>
                    <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                      <option value="">Selecionar...</option>
                      {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Valor recebido</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <input type="number" min="0" step="0.01" value={valorRecebido}
                        onChange={e => setValorRecebido(e.target.value)}
                        placeholder={totalFinal.toFixed(2)}
                        className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-600" />
                    </div>
                    {creditoGerado > 0 && (
                      <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Gera {formatCurrency(creditoGerado)} de crédito
                      </p>
                    )}
                  </div>
                </>
              )}

              {isFechada && comanda?.forma_pagamento && (
                <p className="text-xs text-gray-500">
                  Pagamento: <span className="font-medium text-gray-700">
                    {FORMAS_PAGAMENTO.find(f => f.value === comanda.forma_pagamento)?.label}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2 mt-6">
              {!isFechada && (
                <>
                  <button onClick={handleFechar} disabled={fechando}
                    className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                    {fechando ? 'Fechando...' : 'Fechar comanda'}
                  </button>
                  <button onClick={handleCancelar} className="w-full text-sm text-red-500 hover:text-red-700 py-2 transition-colors">
                    Cancelar comanda
                  </button>
                </>
              )}
              {comanda?.id && (
                <button onClick={handleExcluir} disabled={excluindo}
                  className="w-full text-sm text-red-600 hover:text-red-800 disabled:opacity-50 py-2 transition-colors font-medium">
                  {excluindo ? 'Excluindo...' : 'Excluir comanda'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {adicionandoItem && (
        <AdicionarItemModal
          servicos={servicos}
          produtos={produtos}
          profissionais={profissionais}
          comissoesProfissional={comissoesProfissional}
          itemExistente={itemEditando}
          onClose={() => { setAdicionandoItem(false); setItemEditando(null) }}
          onSalvo={itemEditando ? handleEditarItem : handleAdicionarItem}
        />
      )}

      {historicoAberto && clienteExibido && (
        <HistoricoClienteDrawer
          clienteId={clienteExibido.id}
          clienteNome={clienteExibido.nome}
          unidadeId={unidadeId}
          onClose={() => setHistoricoAberto(false)}
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
  desconto_percentual: number
  profissionais: { profissional_id: string; participacao: number }[]
  editandoId?: string
}

function AdicionarItemModal({ servicos, produtos, profissionais, comissoesProfissional, itemExistente, onClose, onSalvo }: {
  servicos: Servico[]
  produtos: Produto[]
  profissionais: Profissional[]
  comissoesProfissional: ComissaoProfissionalItem[]
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
  const [descontoPercentual, setDescontoPercentual] = useState(itemExistente?.desconto_percentual ?? 0)
  const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'reais'>('percentual')
  const [descontoReais, setDescontoReais] = useState(0)
  const [profs, setProfs] = useState(profsIniciais)
  const [salvando, setSalvando] = useState(false)
  const [ultimoAdicionado, setUltimoAdicionado] = useState<string | null>(null)

  const lista = tipo === 'servico' ? servicos : produtos
  const item = lista.find(i => i.id === itemId)
  const servicoSel = tipo === 'servico' ? servicos.find(s => s.id === itemId) : null
  const preco = item ? (tipo === 'servico' ? (item as Servico).preco : (item as Produto).preco_venda) : 0
  const totalBrutoItem = preco * quantidade
  const descontoValorEfetivo = tipoDesconto === 'reais'
    ? Math.min(descontoReais, totalBrutoItem)
    : totalBrutoItem * (descontoPercentual / 100)
  const subtotal = Math.max(0, totalBrutoItem - descontoValorEfetivo)

  function trocarTipoDesconto(novo: 'percentual' | 'reais') {
    if (novo === tipoDesconto) return
    if (novo === 'reais') {
      // converte % atual para R$
      setDescontoReais(parseFloat((totalBrutoItem * descontoPercentual / 100).toFixed(2)))
    } else {
      // converte R$ atual para %
      setDescontoPercentual(totalBrutoItem > 0
        ? parseFloat(((descontoReais / totalBrutoItem) * 100).toFixed(2))
        : 0)
    }
    setTipoDesconto(novo)
  }
  const totalPart = profs.reduce((s, p) => s + p.participacao, 0)
  // Prioridade: comissão específica do profissional > comissão do serviço > comissão padrão
  const comissaoServico = servicoSel?.comissao_servico || 0

  function getComissaoProf(profId: string): { pct: number; origem: 'especifica' | 'servico' | 'nenhuma' } {
    if (profId && itemId) {
      const especifica = comissoesProfissional.find(c =>
        c.profissional_id === profId &&
        c.tipo === tipo &&
        (tipo === 'servico' ? c.servico_id === itemId : c.produto_id === itemId)
      )
      if (especifica) return { pct: especifica.percentual, origem: 'especifica' }
    }
    if (comissaoServico > 0) return { pct: comissaoServico, origem: 'servico' }
    return { pct: 0, origem: 'nenhuma' }
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
    setDescontoPercentual(0)
    setDescontoReais(0)
    setTipoDesconto('percentual')
    setProfs([{ profissional_id: profissionais[0]?.id || '', participacao: 100 }])
  }

  async function handleSalvo(continuar: boolean) {
    if (!itemId) { alert('Selecione um item.'); return }
    if (tipo === 'servico' && profs.length > 0 && Math.abs(totalPart - 100) > 0.01) {
      alert('A soma das participações deve ser 100%.'); return
    }
    setSalvando(true)
    const nomeItem = lista.find(i => i.id === itemId)?.nome || ''
    const pctFinal = tipoDesconto === 'reais'
      ? (totalBrutoItem > 0 ? parseFloat(((descontoReais / totalBrutoItem) * 100).toFixed(4)) : 0)
      : descontoPercentual
    await onSalvo({ tipo, item_id: itemId, quantidade, desconto_percentual: pctFinal, profissionais: tipo === 'servico' ? profs : [], editandoId: itemExistente?.id }, continuar)
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

          {/* Quantidade + preço + desconto */}
          <div className="grid grid-cols-4 gap-3">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto</label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  {tipoDesconto === 'percentual' ? (
                    <>
                      <input type="number" min="0" max="100" step="0.01" value={descontoPercentual}
                        onChange={e => setDescontoPercentual(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="w-full pr-6 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </>
                  ) : (
                    <>
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <input type="number" min="0" step="0.01" value={descontoReais}
                        onChange={e => setDescontoReais(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
                    </>
                  )}
                </div>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden text-xs font-medium flex-shrink-0">
                  <button type="button"
                    onClick={() => trocarTipoDesconto('reais')}
                    className={`px-2.5 py-2 transition-colors ${tipoDesconto === 'reais' ? 'bg-amber-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                    R$
                  </button>
                  <button type="button"
                    onClick={() => trocarTipoDesconto('percentual')}
                    className={`px-2.5 py-2 transition-colors ${tipoDesconto === 'percentual' ? 'bg-amber-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                    %
                  </button>
                </div>
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
                  const { pct: pctComissao, origem } = getComissaoProf(p.profissional_id)
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
                          {p.profissional_id && origem === 'especifica' && (
                            <span className="ml-1 text-blue-600 text-xs">(profissional)</span>
                          )}
                          {p.profissional_id && origem === 'servico' && (
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
            <div className="flex justify-between items-center text-sm font-semibold pt-2 border-t border-gray-100">
              <span className="text-gray-600">Subtotal</span>
              <div className="text-right">
                {descontoPercentual > 0 && (
                  <span className="text-xs text-gray-400 line-through mr-2">{formatCurrency(preco * quantidade)}</span>
                )}
                <span className="text-amber-700">{formatCurrency(subtotal)}</span>
                {descontoPercentual > 0 && (
                  <span className="ml-1.5 text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">-{descontoPercentual}%</span>
                )}
              </div>
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
