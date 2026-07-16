'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, ComissaoHistorico } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import {
  Users, Wallet, CheckCircle2, Clock, X, ChevronLeft, ChevronRight,
  ArrowLeft, Receipt, Eye, GitMerge,
} from 'lucide-react'

type Aba = 'resumidas' | 'detalhadas' | 'pagas'

interface ProfissionalRateio {
  profissional_id: string
  profissional_nome: string
  profissional_cor: string
  percentual_participacao: number
  percentual_comissao: number
  valor_comissao: number
}

interface ItemComissao {
  id: string
  comanda_id: string
  profissional_id: string
  profissional_nome: string
  profissional_cor: string
  data_fechamento: string
  cliente_nome: string
  item_nome: string
  item_tipo: string
  subtotal: number
  percentual_participacao: number
  percentual_comissao: number
  valor_comissao: number
  rateio: ProfissionalRateio[]  // todos os profissionais do item (incluindo self)
}

interface ComandaGrupo {
  comanda_id: string
  data_fechamento: string
  cliente_nome: string
  itens: ItemComissao[]
  total_comissao: number
}

interface ResumoProfissional {
  profissional: Profissional
  total_itens: number
  valor_base: number
  valor_comissao: number
  tem_rateio: boolean
}

type HistoricoComRegistro = ComissaoHistorico & {
  profissional?: { nome: string; cor_agenda: string }
}

interface ComandaDetalhe {
  id: string
  data_abertura: string
  data_fechamento?: string
  valor_total: number
  desconto: number
  valor_final: number
  forma_pagamento?: string
  observacoes?: string
  cliente?: { nome: string; telefone?: string }
  itens?: Array<{
    id: string
    tipo: string
    quantidade: number
    preco_unitario: number
    desconto_percentual: number
    subtotal: number
    servico?: { nome: string }
    produto?: { nome: string }
    profissionais?: Array<{
      profissional_id: string
      percentual_participacao: number
      percentual_comissao: number
      valor_comissao: number
      profissional?: { nome: string; cor_agenda: string }
    }>
  }>
}

const formaPagamentoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito', pix: 'PIX', misto: 'Misto', retrabalho: 'Retrabalho', avaliacao: 'Avaliação',
}

interface Props {
  profissionais: Profissional[]
  unidadeId: string
}

const PAGAS_POR_PAG = 25

export default function ComissoesClient({ profissionais, unidadeId }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('detalhadas')
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPagas, setLoadingPagas] = useState(false)

  const [itens, setItens] = useState<ItemComissao[]>([])
  const [historico, setHistorico] = useState<HistoricoComRegistro[]>([])
  const [paginaPagas, setPaginaPagas] = useState(1)

  // Preview de comanda
  const [comandaAbertaId, setComandaAbertaId] = useState<string | null>(null)
  const [comandaDetalhe, setComandaDetalhe] = useState<ComandaDetalhe | null>(null)
  const [loadingComanda, setLoadingComanda] = useState(false)

  // Modal de fechamento
  const [modalFechamento, setModalFechamento] = useState<ResumoProfissional | null>(null)
  const [fechVencimento, setFechVencimento] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [fechItem, setFechItem] = useState('')
  const [fechHistorico, setFechHistorico] = useState('')
  const [fechando, setFechando] = useState(false)
  const [erroFech, setErroFech] = useState('')

  useEffect(() => {
    buscarItens()
  }, [dataInicio, dataFim, unidadeId])

  useEffect(() => {
    if (aba === 'pagas') buscarHistorico()
  }, [aba, dataInicio, dataFim, unidadeId])

  useEffect(() => {
    if (comandaAbertaId) abrirComanda(comandaAbertaId)
  }, [comandaAbertaId])

  async function buscarItens() {
    setLoading(true)
    const { data } = await supabase
      .from('comandas')
      .select(`
        id, data_fechamento,
        cliente:clientes(nome),
        itens:comanda_itens(
          id, tipo, subtotal,
          servico:servicos(nome),
          produto:produtos(nome),
          profissionais:comanda_item_profissionais(
            id, profissional_id, percentual_participacao, percentual_comissao, valor_comissao,
            profissional:profissionais(id, nome, cor_agenda)
          )
        )
      `)
      .eq('unidade_id', unidadeId)
      .eq('status', 'fechada')
      .gte('data_fechamento', dataInicio + 'T00:00:00')
      .lte('data_fechamento', dataFim + 'T23:59:59')
      .order('data_fechamento', { ascending: false })

    const rows: ItemComissao[] = []
    for (const c of (data as unknown as any[]) || []) {
      for (const item of c.itens || []) {
        const todosProfs: ProfissionalRateio[] = (item.profissionais || []).map((cp: any) => ({
          profissional_id: cp.profissional_id,
          profissional_nome: cp.profissional?.nome || '—',
          profissional_cor: cp.profissional?.cor_agenda || '#888888',
          percentual_participacao: cp.percentual_participacao || 0,
          percentual_comissao: cp.percentual_comissao || 0,
          valor_comissao: cp.valor_comissao || 0,
        }))

        for (const cp of (item.profissionais || []) as any[]) {
          if (!cp.profissional_id) continue
          rows.push({
            id: cp.id,
            comanda_id: c.id,
            profissional_id: cp.profissional_id,
            profissional_nome: cp.profissional?.nome || '—',
            profissional_cor: cp.profissional?.cor_agenda || '#888888',
            data_fechamento: c.data_fechamento,
            cliente_nome: c.cliente?.nome || '—',
            item_nome: item.tipo === 'servico' ? (item.servico?.nome || '—') : (item.produto?.nome || '—'),
            item_tipo: item.tipo,
            subtotal: item.subtotal || 0,
            percentual_participacao: cp.percentual_participacao || 0,
            percentual_comissao: cp.percentual_comissao || 0,
            valor_comissao: cp.valor_comissao || 0,
            rateio: todosProfs,
          })
        }
      }
    }
    setItens(rows)
    setLoading(false)
  }

  async function buscarHistorico() {
    setLoadingPagas(true)
    const { data } = await supabase
      .from('comissoes_historico')
      .select('*, profissional:profissionais(nome, cor_agenda)')
      .eq('unidade_id', unidadeId)
      .gte('vencimento', dataInicio)
      .lte('vencimento', dataFim)
      .order('vencimento', { ascending: false })
    setHistorico((data as unknown as HistoricoComRegistro[]) || [])
    setPaginaPagas(1)
    setLoadingPagas(false)
  }

  async function abrirComanda(id: string) {
    setLoadingComanda(true)
    setComandaDetalhe(null)
    const { data } = await supabase
      .from('comandas')
      .select(`
        id, data_abertura, data_fechamento, valor_total, desconto, valor_final, forma_pagamento, observacoes,
        cliente:clientes(nome, telefone),
        itens:comanda_itens(
          id, tipo, quantidade, preco_unitario, desconto_percentual, subtotal,
          servico:servicos(nome),
          produto:produtos(nome),
          profissionais:comanda_item_profissionais(
            profissional_id, percentual_participacao, percentual_comissao, valor_comissao,
            profissional:profissionais(nome, cor_agenda)
          )
        )
      `)
      .eq('id', id)
      .single()
    setComandaDetalhe(data as unknown as ComandaDetalhe)
    setLoadingComanda(false)
  }

  function fecharPreviewComanda() {
    setComandaAbertaId(null)
    setComandaDetalhe(null)
  }

  // Resumo por profissional
  const resumo: ResumoProfissional[] = profissionais
    .map(prof => {
      const seus = itens.filter(i => i.profissional_id === prof.id)
      const tem_rateio = seus.some(i => i.rateio.length > 1)
      return {
        profissional: prof,
        total_itens: seus.length,
        valor_base: seus.reduce((s, i) => s + i.subtotal * i.percentual_comissao / 100, 0),
        valor_comissao: seus.reduce((s, i) => s + i.valor_comissao, 0),
        tem_rateio,
      }
    })
    .filter(r => r.total_itens > 0)
    .sort((a, b) => b.valor_comissao - a.valor_comissao)

  const profSelecionadoObj = profissionais.find(p => p.id === profissionalSelecionado)
  const resumoProf = resumo.find(r => r.profissional.id === profissionalSelecionado)
  const itensProfSelecionado = profissionalSelecionado
    ? itens.filter(i => i.profissional_id === profissionalSelecionado)
    : []

  // Agrupa itens do profissional por comanda
  const comandasAgrupadas: ComandaGrupo[] = (() => {
    const map = new Map<string, ComandaGrupo>()
    for (const item of itensProfSelecionado) {
      if (!map.has(item.comanda_id)) {
        map.set(item.comanda_id, {
          comanda_id: item.comanda_id,
          data_fechamento: item.data_fechamento,
          cliente_nome: item.cliente_nome,
          itens: [],
          total_comissao: 0,
        })
      }
      const grupo = map.get(item.comanda_id)!
      grupo.itens.push(item)
      grupo.total_comissao += item.valor_comissao
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.data_fechamento).getTime() - new Date(a.data_fechamento).getTime()
    )
  })()

  const totalProfSelecionado = itensProfSelecionado.reduce((s, i) => s + i.valor_comissao, 0)
  const totalGeral = resumo.reduce((s, r) => s + r.valor_comissao, 0)
  const totalHistorico = historico.reduce((s, h) => s + h.valor, 0)
  const pagasTotais = Math.ceil(historico.length / PAGAS_POR_PAG)
  const historicoPaginado = historico.slice((paginaPagas - 1) * PAGAS_POR_PAG, paginaPagas * PAGAS_POR_PAG)

  function abrirFechamento(r: ResumoProfissional) {
    const mesAno = format(new Date(dataInicio + 'T12:00:00'), 'MM/yyyy')
    setFechItem(`Fechamento ${mesAno}`)
    setFechVencimento(format(new Date(), 'yyyy-MM-dd'))
    setFechHistorico('')
    setErroFech('')
    setModalFechamento(r)
  }

  async function confirmarFechamento() {
    if (!modalFechamento) return
    setFechando(true)
    setErroFech('')
    const { error } = await supabase.from('comissoes_historico').insert({
      profissional_id: modalFechamento.profissional.id,
      unidade_id: unidadeId,
      vencimento: fechVencimento,
      item: fechItem || `Fechamento ${format(new Date(dataInicio + 'T12:00:00'), 'MM/yyyy')}`,
      valor: modalFechamento.valor_comissao,
      historico: fechHistorico || null,
      status: 'pendente',
    })
    if (error) { setErroFech('Erro ao registrar fechamento.'); setFechando(false); return }
    setFechando(false)
    setModalFechamento(null)
    if (aba === 'pagas') buscarHistorico()
  }

  async function toggleStatus(h: HistoricoComRegistro) {
    const novoStatus = h.status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('comissoes_historico').update({ status: novoStatus }).eq('id', h.id)
    setHistorico(prev => prev.map(x => x.id === h.id ? { ...x, status: novoStatus } : x))
  }

  async function removerHistorico(id: string) {
    await supabase.from('comissoes_historico').delete().eq('id', id)
    setHistorico(prev => prev.filter(h => h.id !== id))
  }

  function irParaEsteMes() {
    setDataInicio(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setDataFim(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }
  function irParaMesAnterior() {
    const m = new Date(dataInicio + 'T12:00:00')
    m.setMonth(m.getMonth() - 1)
    setDataInicio(format(startOfMonth(m), 'yyyy-MM-dd'))
    setDataFim(format(endOfMonth(m), 'yyyy-MM-dd'))
  }

  const periodoLabel = `${format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy')}`

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Comissões</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fechamento mensal de comissões por profissional</p>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">De:</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Até:</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
          </div>
          <div className="flex gap-2">
            <button onClick={irParaEsteMes}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Este mês
            </button>
            <button onClick={irParaMesAnterior}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Mês anterior
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(['detalhadas', 'resumidas', 'pagas'] as Aba[]).map(t => (
          <button key={t} onClick={() => { setAba(t); if (t !== 'detalhadas') setProfissionalSelecionado(null) }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${aba === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ===== DETALHADAS ===== */}
      {aba === 'detalhadas' && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !profissionalSelecionado ? (

          /* ── Lista de profissionais para selecionar ── */
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Selecione uma profissional para ver as comissões detalhadas do período
            </p>
            {resumo.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma comissão registrada no período</p>
              </div>
            ) : (
              <div className="space-y-2">
                {resumo.map(r => (
                  <button
                    key={r.profissional.id}
                    onClick={() => setProfissionalSelecionado(r.profissional.id)}
                    className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all text-left group"
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                      style={{ backgroundColor: r.profissional.cor_agenda }}
                    >
                      {r.profissional.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.profissional.nome}</p>
                        {r.tem_rateio && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            <GitMerge className="w-3 h-3" /> Rateio
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.profissional.cargo || 'Profissional'} · {r.total_itens} item{r.total_itens !== 1 ? 's' : ''} trabalhados
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold" style={{ color: '#B8924A' }}>
                        {formatCurrency(r.valor_comissao)}
                      </p>
                      <p className="text-xs text-gray-400">em comissão</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 flex-shrink-0 transition-colors" />
                  </button>
                ))}

                {/* Totalizador */}
                <div className="flex items-center justify-between px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 mt-4">
                  <p className="text-sm font-semibold text-gray-700">
                    {resumo.length} profissional{resumo.length !== 1 ? 'is' : ''} · {itens.length} item{itens.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-base font-bold" style={{ color: '#B8924A' }}>
                    {formatCurrency(totalGeral)} total
                  </p>
                </div>
              </div>
            )}
          </div>

        ) : (

          /* ── Detalhe por profissional ── */
          <div>
            {/* Header do profissional */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 mb-5">
              <button
                onClick={() => setProfissionalSelecionado(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-gray-600" />
              </button>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0"
                style={{ backgroundColor: profSelecionadoObj?.cor_agenda || '#888' }}
              >
                {profSelecionadoObj?.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{profSelecionadoObj?.nome}</p>
                <p className="text-sm text-gray-500">
                  {profSelecionadoObj?.cargo || 'Profissional'} · {periodoLabel}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">Total comissão</p>
                <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>
                  {formatCurrency(totalProfSelecionado)}
                </p>
              </div>
            </div>

            {comandasAgrupadas.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma comissão no período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comandasAgrupadas.map(grupo => (
                  <div key={grupo.comanda_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Header da comanda */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{grupo.cliente_nome}</p>
                        <p className="text-xs text-gray-500">
                          {grupo.data_fechamento
                            ? format(parseISO(grupo.data_fechamento), "dd/MM/yyyy 'às' HH:mm")
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Comissão</p>
                          <p className="text-sm font-bold" style={{ color: '#B8924A' }}>
                            {formatCurrency(grupo.total_comissao)}
                          </p>
                        </div>
                        <button
                          onClick={() => setComandaAbertaId(grupo.comanda_id)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 hover:bg-white rounded-lg transition-colors text-gray-700 whitespace-nowrap flex-shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver comanda
                        </button>
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="divide-y divide-gray-50">
                      {grupo.itens.map(item => {
                        const ehRateio = item.rateio.length > 1
                        const outrosProfissionais = item.rateio.filter(r => r.profissional_id !== item.profissional_id)

                        return (
                          <div key={item.id} className="px-4 py-3">
                            {/* Linha principal do item */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900 truncate">{item.item_nome}</p>
                                  <span className="text-xs text-gray-400">
                                    {item.item_tipo === 'servico' ? 'Serviço' : 'Produto'}
                                  </span>
                                  {ehRateio && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-full font-medium">
                                      <GitMerge className="w-3 h-3" /> Rateio
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                                  <span>Subtotal: <strong className="text-gray-700">{formatCurrency(item.subtotal)}</strong></span>
                                  {ehRateio && (
                                    <span>Participação: <strong className="text-gray-700">{item.percentual_participacao}%</strong></span>
                                  )}
                                  <span>Comissão: <strong className="text-gray-700">{item.percentual_comissao}%</strong></span>
                                </div>
                              </div>
                              <p className="text-sm font-bold flex-shrink-0 pt-0.5" style={{ color: '#B8924A' }}>
                                {formatCurrency(item.valor_comissao)}
                              </p>
                            </div>

                            {/* Rateio: outros profissionais do mesmo item */}
                            {ehRateio && outrosProfissionais.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed border-gray-100">
                                <p className="text-xs text-gray-400 mb-1.5">Também atendeu neste serviço:</p>
                                <div className="flex flex-wrap gap-2">
                                  {outrosProfissionais.map(outro => (
                                    <div key={outro.profissional_id}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                                      <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                        style={{ backgroundColor: outro.profissional_cor }}
                                      >
                                        {outro.profissional_nome.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-xs text-gray-700 font-medium">{outro.profissional_nome}</span>
                                      <span className="text-xs text-gray-400">·</span>
                                      <span className="text-xs text-gray-500">{outro.percentual_participacao}% participação</span>
                                      <span className="text-xs text-gray-400">·</span>
                                      <span className="text-xs font-semibold" style={{ color: '#B8924A' }}>
                                        {formatCurrency(outro.valor_comissao)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Total + fechamento */}
                <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">TOTAL DO PERÍODO</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {comandasAgrupadas.length} comanda{comandasAgrupadas.length !== 1 ? 's' : ''} · {itensProfSelecionado.length} item{itensProfSelecionado.length !== 1 ? 's' : ''}
                      {resumoProf?.tem_rateio ? ' · inclui rateios' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>
                      {formatCurrency(totalProfSelecionado)}
                    </p>
                    {resumoProf && (
                      <button onClick={() => abrirFechamento(resumoProf)}
                        className="px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors whitespace-nowrap">
                        Fazer fechamento
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ===== RESUMIDAS ===== */}
      {aba === 'resumidas' && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Profissionais</p>
                <p className="text-2xl font-bold text-gray-900">{resumo.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Total comissões</p>
                <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(totalGeral)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 mb-1">Itens trabalhados</p>
                <p className="text-2xl font-bold text-gray-900">{itens.length}</p>
              </div>
            </div>

            {resumo.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma comissão registrada no período</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cargo</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Itens</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor base</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Comissão total</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.map(r => (
                      <tr key={r.profissional.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                              style={{ backgroundColor: r.profissional.cor_agenda }}>
                              {r.profissional.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{r.profissional.nome}</p>
                              {r.tem_rateio && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-blue-600">
                                  <GitMerge className="w-3 h-3" /> tem rateios
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.profissional.cargo || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{r.total_itens}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(r.valor_base)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: '#B8924A' }}>
                          {formatCurrency(r.valor_comissao)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setProfissionalSelecionado(r.profissional.id); setAba('detalhadas') }}
                              className="text-xs font-medium px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors whitespace-nowrap">
                              Ver detalhes
                            </button>
                            <button onClick={() => abrirFechamento(r)}
                              className="text-xs font-medium px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors whitespace-nowrap">
                              Fazer fechamento
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-50 border-t-2 border-amber-200">
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(resumo.reduce((s, r) => s + r.valor_base, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: '#B8924A' }}>
                        {formatCurrency(totalGeral)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-50">
                  {resumo.map(r => (
                    <div key={r.profissional.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: r.profissional.cor_agenda }}>
                          {r.profissional.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{r.profissional.nome}</p>
                          <p className="text-xs text-gray-500">{r.total_itens} itens · {formatCurrency(r.valor_base)} base</p>
                        </div>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color: '#B8924A' }}>{formatCurrency(r.valor_comissao)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setProfissionalSelecionado(r.profissional.id); setAba('detalhadas') }}
                          className="flex-1 text-xs font-medium px-3 py-2 border border-gray-200 text-gray-700 rounded-lg">
                          Ver detalhes
                        </button>
                        <button onClick={() => abrirFechamento(r)}
                          className="flex-1 text-xs font-medium px-3 py-2 bg-amber-700 text-white rounded-lg">
                          Fazer fechamento
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ===== PAGAS ===== */}
      {aba === 'pagas' && (
        loadingPagas ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Registros no período</p>
                <p className="text-2xl font-bold text-gray-900">{historico.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Valor total registrado</p>
                <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(totalHistorico)}</p>
              </div>
            </div>

            {historico.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhum fechamento registrado no período</p>
                <p className="text-xs text-gray-400 mt-1">Use "Fazer fechamento" na aba Detalhadas ou Resumidas</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vencimento</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Descrição</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Observações</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {historicoPaginado.map(h => (
                      <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {format(new Date(h.vencimento + 'T12:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {h.profissional && (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                style={{ backgroundColor: h.profissional.cor_agenda }}>
                                {h.profissional.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-gray-900">{h.profissional?.nome || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{h.item}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{h.historico || '—'}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: '#B8924A' }}>
                          {formatCurrency(h.valor)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleStatus(h)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              h.status === 'pago'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}>
                            {h.status === 'pago'
                              ? <><CheckCircle2 className="w-3 h-3" /> Pago</>
                              : <><Clock className="w-3 h-3" /> Pendente</>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removerHistorico(h.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-50">
                  {historicoPaginado.map(h => (
                    <div key={h.id} className="px-4 py-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {h.profissional && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                style={{ backgroundColor: h.profissional.cor_agenda }}>
                                {h.profissional.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <p className="text-sm font-medium text-gray-900">{h.profissional?.nome || '—'}</p>
                          </div>
                          <p className="text-xs text-gray-500">{h.item} · {format(new Date(h.vencimento + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                          {h.historico && <p className="text-xs text-gray-400 mt-0.5">{h.historico}</p>}
                        </div>
                        <div className="flex-shrink-0 text-right ml-3">
                          <p className="text-sm font-bold" style={{ color: '#B8924A' }}>{formatCurrency(h.valor)}</p>
                          <button onClick={() => toggleStatus(h)}
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              h.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {h.status === 'pago' ? 'Pago' : 'Pendente'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {pagasTotais > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {(paginaPagas - 1) * PAGAS_POR_PAG + 1}–{Math.min(paginaPagas * PAGAS_POR_PAG, historico.length)} de {historico.length}
                    </p>
                    <div className="flex gap-1">
                      <button onClick={() => setPaginaPagas(p => Math.max(1, p - 1))} disabled={paginaPagas === 1}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setPaginaPagas(p => Math.min(pagasTotais, p + 1))} disabled={paginaPagas === pagasTotais}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}

      {/* ===== MODAL: PREVIEW DE COMANDA ===== */}
      {comandaAbertaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={fecharPreviewComanda} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-amber-700" />
                <h2 className="text-base font-semibold text-gray-900">
                  {loadingComanda ? 'Carregando...' : `Comanda — ${comandaDetalhe?.cliente?.nome || '—'}`}
                </h2>
              </div>
              <button onClick={fecharPreviewComanda} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4">
              {loadingComanda ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !comandaDetalhe ? (
                <p className="text-center text-gray-500 py-12">Erro ao carregar comanda</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Cliente</p>
                      <p className="font-medium text-gray-900">{comandaDetalhe.cliente?.nome || '—'}</p>
                      {comandaDetalhe.cliente?.telefone && (
                        <p className="text-xs text-gray-500 mt-0.5">{comandaDetalhe.cliente.telefone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Fechamento</p>
                      <p className="font-medium text-gray-900">
                        {comandaDetalhe.data_fechamento
                          ? format(parseISO(comandaDetalhe.data_fechamento), "dd/MM/yyyy 'às' HH:mm")
                          : '—'}
                      </p>
                      {comandaDetalhe.forma_pagamento && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formaPagamentoLabel[comandaDetalhe.forma_pagamento] || comandaDetalhe.forma_pagamento}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Itens da comanda</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {(comandaDetalhe.itens || []).map(item => {
                        const nome = item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome
                        const ehRateio = (item.profissionais || []).length > 1
                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900">{nome || '—'}</p>
                                  {ehRateio && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-full">
                                      <GitMerge className="w-3 h-3" /> Rateio
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {item.quantidade}× {formatCurrency(item.preco_unitario)}
                                  {item.desconto_percentual > 0 && ` · desc. ${item.desconto_percentual}%`}
                                </p>
                                {(item.profissionais || []).length > 0 && (
                                  <div className="mt-2 flex flex-col gap-1">
                                    {(item.profissionais || []).map((cp, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <div
                                          className="w-4 h-4 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: cp.profissional?.cor_agenda || '#888' }}
                                        />
                                        <span className="text-xs text-gray-700">{cp.profissional?.nome}</span>
                                        {ehRateio && (
                                          <span className="text-xs text-gray-400">{cp.percentual_participacao}% participação ·</span>
                                        )}
                                        <span className="text-xs text-gray-600">{cp.percentual_comissao}% comissão</span>
                                        <span className="text-xs font-semibold ml-auto" style={{ color: '#B8924A' }}>
                                          {formatCurrency(cp.valor_comissao)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                                {formatCurrency(item.subtotal)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {comandaDetalhe.desconto > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Desconto</span>
                        <span className="text-red-600">- {formatCurrency(comandaDetalhe.desconto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                      <span>Total pago</span>
                      <span>{formatCurrency(comandaDetalhe.valor_final)}</span>
                    </div>
                  </div>

                  {comandaDetalhe.observacoes && (
                    <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Observações</p>
                      <p className="text-gray-700">{comandaDetalhe.observacoes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={fecharPreviewComanda}
                className="w-full px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: FAZER FECHAMENTO ===== */}
      {modalFechamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalFechamento(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Fazer fechamento</h2>
              <button onClick={() => setModalFechamento(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                  style={{ backgroundColor: modalFechamento.profissional.cor_agenda }}>
                  {modalFechamento.profissional.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{modalFechamento.profissional.nome}</p>
                  <p className="text-xs text-gray-500">{periodoLabel}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Comissão total</p>
                  <p className="text-xl font-bold" style={{ color: '#B8924A' }}>
                    {formatCurrency(modalFechamento.valor_comissao)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">
                <span>{modalFechamento.total_itens} item{modalFechamento.total_itens !== 1 ? 's' : ''} trabalhados</span>
                <span className="text-right">Valor base: {formatCurrency(modalFechamento.valor_base)}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Vencimento</label>
                <input type="date" value={fechVencimento} onChange={e => setFechVencimento(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Descrição</label>
                <input type="text" value={fechItem} onChange={e => setFechItem(e.target.value)}
                  placeholder="Ex: Fechamento 05/2026"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Observações (opcional)</label>
                <textarea value={fechHistorico} onChange={e => setFechHistorico(e.target.value)}
                  rows={2} placeholder="Notas sobre o fechamento..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none" />
              </div>

              {erroFech && <p className="text-xs text-red-500">{erroFech}</p>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalFechamento(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarFechamento} disabled={fechando}
                className="flex-1 px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors disabled:opacity-60">
                {fechando ? 'Registrando...' : 'Confirmar fechamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
