'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, ComissaoHistorico } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { Users, Wallet, CheckCircle2, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react'

type Aba = 'resumidas' | 'detalhadas' | 'pagas'

interface ItemComissao {
  id: string
  profissional_id: string
  profissional_nome: string
  profissional_cor: string
  data_fechamento: string
  cliente_nome: string
  item_nome: string
  item_tipo: string
  subtotal: number
  percentual_comissao: number
  valor_comissao: number
}

interface ResumoProfissional {
  profissional: Profissional
  total_itens: number
  valor_base: number
  valor_comissao: number
}

type HistoricoComRegistro = ComissaoHistorico & {
  profissional?: { nome: string; cor_agenda: string }
}

interface Props {
  profissionais: Profissional[]
  unidadeId: string
}

const PAGAS_POR_PAG = 25

export default function ComissoesClient({ profissionais, unidadeId }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('resumidas')
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [profissionalFiltro, setProfissionalFiltro] = useState<string>('todos')
  const [loading, setLoading] = useState(false)
  const [loadingPagas, setLoadingPagas] = useState(false)

  const [itens, setItens] = useState<ItemComissao[]>([])
  const [historico, setHistorico] = useState<HistoricoComRegistro[]>([])
  const [paginaPagas, setPaginaPagas] = useState(1)

  // Modal de pagamento
  const [modalPag, setModalPag] = useState<ResumoProfissional | null>(null)
  const [pagVencimento, setPagVencimento] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [pagItem, setPagItem] = useState('')
  const [pagHistorico, setPagHistorico] = useState('')
  const [pagando, setPagando] = useState(false)
  const [erroPag, setErroPag] = useState('')

  useEffect(() => {
    buscarItens()
  }, [dataInicio, dataFim, unidadeId])

  useEffect(() => {
    if (aba === 'pagas') buscarHistorico()
  }, [aba, dataInicio, dataFim, unidadeId])

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
            id, profissional_id, percentual_comissao, valor_comissao,
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
        for (const cp of item.profissionais || []) {
          if (!cp.valor_comissao) continue
          rows.push({
            id: cp.id,
            profissional_id: cp.profissional_id,
            profissional_nome: cp.profissional?.nome || '—',
            profissional_cor: cp.profissional?.cor_agenda || '#888888',
            data_fechamento: c.data_fechamento,
            cliente_nome: c.cliente?.nome || '—',
            item_nome: item.tipo === 'servico' ? (item.servico?.nome || '—') : (item.produto?.nome || '—'),
            item_tipo: item.tipo,
            subtotal: item.subtotal || 0,
            percentual_comissao: cp.percentual_comissao || 0,
            valor_comissao: cp.valor_comissao || 0,
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

  const resumo: ResumoProfissional[] = profissionais
    .map(prof => {
      const seus = itens.filter(i => i.profissional_id === prof.id)
      return {
        profissional: prof,
        total_itens: seus.length,
        valor_base: seus.reduce((s, i) => s + i.subtotal * i.percentual_comissao / 100, 0),
        valor_comissao: seus.reduce((s, i) => s + i.valor_comissao, 0),
      }
    })
    .filter(r => r.valor_comissao > 0)
    .sort((a, b) => b.valor_comissao - a.valor_comissao)

  const itensFiltrados = profissionalFiltro === 'todos'
    ? itens
    : itens.filter(i => i.profissional_id === profissionalFiltro)

  const totalComissoes = resumo.reduce((s, r) => s + r.valor_comissao, 0)
  const totalHistorico = historico.reduce((s, h) => s + h.valor, 0)
  const pagasTotais = Math.ceil(historico.length / PAGAS_POR_PAG)
  const historicoPaginado = historico.slice((paginaPagas - 1) * PAGAS_POR_PAG, paginaPagas * PAGAS_POR_PAG)

  function abrirModalPagamento(r: ResumoProfissional) {
    const mesAno = format(new Date(dataInicio + 'T12:00:00'), 'MM/yyyy')
    setPagItem(`Comissão ${mesAno}`)
    setPagVencimento(format(new Date(), 'yyyy-MM-dd'))
    setPagHistorico('')
    setErroPag('')
    setModalPag(r)
  }

  async function confirmarPagamento() {
    if (!modalPag) return
    setPagando(true)
    setErroPag('')
    const { error } = await supabase.from('comissoes_historico').insert({
      profissional_id: modalPag.profissional.id,
      unidade_id: unidadeId,
      vencimento: pagVencimento,
      item: pagItem || `Comissão ${format(new Date(dataInicio + 'T12:00:00'), 'MM/yyyy')}`,
      valor: modalPag.valor_comissao,
      historico: pagHistorico || null,
      status: 'pendente',
    })
    if (error) {
      setErroPag('Erro ao registrar pagamento.')
      setPagando(false)
      return
    }
    setPagando(false)
    setModalPag(null)
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
        <p className="text-sm text-gray-500 mt-0.5">Gestão e pagamento de comissões por profissional</p>
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
        {(['resumidas', 'detalhadas', 'pagas'] as Aba[]).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${aba === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ===== RESUMIDAS ===== */}
      {aba === 'resumidas' && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div>
            {/* Cards de totais */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Profissionais com comissão</p>
                <p className="text-2xl font-bold text-gray-900">{resumo.length}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 p-4">
                <p className="text-xs text-gray-500 mb-1">Total comissões no período</p>
                <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(totalComissoes)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 mb-1">Total de itens</p>
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
                {/* Desktop */}
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cargo</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Itens</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor base</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Comissão</th>
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
                            <span className="text-sm font-medium text-gray-900">{r.profissional.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.profissional.cargo || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right">{r.total_itens}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(r.valor_base)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: '#B8924A' }}>
                          {formatCurrency(r.valor_comissao)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => abrirModalPagamento(r)}
                            className="text-xs font-medium px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors whitespace-nowrap">
                            Registrar pagamento
                          </button>
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
                        {formatCurrency(totalComissoes)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-50">
                  {resumo.map(r => (
                    <div key={r.profissional.id} className="px-4 py-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: r.profissional.cor_agenda }}>
                          {r.profissional.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{r.profissional.nome}</p>
                          <p className="text-xs text-gray-500">{r.total_itens} item{r.total_itens !== 1 ? 's' : ''} · Base: {formatCurrency(r.valor_base)}</p>
                        </div>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color: '#B8924A' }}>{formatCurrency(r.valor_comissao)}</p>
                      </div>
                      <button
                        onClick={() => abrirModalPagamento(r)}
                        className="w-full text-xs font-medium px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors">
                        Registrar pagamento
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ===== DETALHADAS ===== */}
      {aba === 'detalhadas' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm text-gray-600 whitespace-nowrap">Profissional:</label>
            <select value={profissionalFiltro} onChange={e => setProfissionalFiltro(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600">
              <option value="todos">Todos</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma comissão no período</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Desktop */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Serviço / Produto</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor item</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">% Comissão</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Valor comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map(i => (
                    <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {i.data_fechamento ? format(parseISO(i.data_fechamento), 'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: i.profissional_cor }}>
                            {i.profissional_nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-900">{i.profissional_nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{i.cliente_nome}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {i.item_nome}
                        <span className="ml-1.5 text-xs text-gray-400">{i.item_tipo === 'servico' ? 'Serviço' : 'Produto'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(i.subtotal)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{i.percentual_comissao}%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right" style={{ color: '#B8924A' }}>
                        {formatCurrency(i.valor_comissao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700">
                      TOTAL — {itensFiltrados.length} item{itensFiltrados.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: '#B8924A' }}>
                      {formatCurrency(itensFiltrados.reduce((s, i) => s + i.valor_comissao, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-50">
                {itensFiltrados.map(i => (
                  <div key={i.id} className="px-4 py-3">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{i.item_nome}</p>
                        <p className="text-xs text-gray-500">{i.cliente_nome} · {i.data_fechamento ? format(parseISO(i.data_fechamento), 'dd/MM/yyyy') : '—'}</p>
                      </div>
                      <p className="text-sm font-bold flex-shrink-0 ml-2" style={{ color: '#B8924A' }}>{formatCurrency(i.valor_comissao)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: i.profissional_cor }}>
                        {i.profissional_nome.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-xs text-gray-600">{i.profissional_nome} · {i.percentual_comissao}% sobre {formatCurrency(i.subtotal)}</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3 bg-amber-50 flex justify-between">
                  <p className="text-sm font-semibold text-gray-700">Total {itensFiltrados.length} item{itensFiltrados.length !== 1 ? 's' : ''}</p>
                  <p className="text-sm font-bold" style={{ color: '#B8924A' }}>
                    {formatCurrency(itensFiltrados.reduce((s, i) => s + i.valor_comissao, 0))}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
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
                <p className="text-gray-500 text-sm">Nenhum pagamento registrado no período</p>
                <p className="text-xs text-gray-400 mt-1">Use "Registrar pagamento" na aba Resumidas</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vencimento</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Item</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Histórico</th>
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

                {/* Paginação */}
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

      {/* ===== MODAL DE PAGAMENTO ===== */}
      {modalPag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalPag(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Registrar pagamento</h2>
              <button onClick={() => setModalPag(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Profissional */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                  style={{ backgroundColor: modalPag.profissional.cor_agenda }}>
                  {modalPag.profissional.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{modalPag.profissional.nome}</p>
                  <p className="text-xs text-gray-500">{periodoLabel}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-500">Comissão</p>
                  <p className="text-lg font-bold" style={{ color: '#B8924A' }}>
                    {formatCurrency(modalPag.valor_comissao)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Vencimento</label>
                <input type="date" value={pagVencimento} onChange={e => setPagVencimento(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Descrição</label>
                <input type="text" value={pagItem} onChange={e => setPagItem(e.target.value)}
                  placeholder="Ex: Comissão 05/2026"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Observações (opcional)</label>
                <textarea value={pagHistorico} onChange={e => setPagHistorico(e.target.value)}
                  rows={2} placeholder="Notas sobre o pagamento..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none" />
              </div>

              {erroPag && <p className="text-xs text-red-500">{erroPag}</p>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setModalPag(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarPagamento} disabled={pagando}
                className="flex-1 px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors disabled:opacity-60">
                {pagando ? 'Registrando...' : 'Confirmar registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
