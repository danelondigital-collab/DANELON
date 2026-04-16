'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Comanda, Profissional } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { FileText, Users, Printer, ExternalLink } from 'lucide-react'

const formaPagamentoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  pix: 'PIX',
  misto: 'Misto',
}

interface Props {
  profissionais: Profissional[]
  unidadeId: string
}

export default function RelatoriosClient({ profissionais, unidadeId }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<'comandas' | 'comissao'>('comandas')
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [profissionalId, setProfissionalId] = useState<string>('todos')
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    buscarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, unidadeId])

  async function buscarDados() {
    setLoading(true)
    const { data } = await supabase
      .from('comandas')
      .select(`
        id, data_abertura, data_fechamento, valor_total, desconto, valor_final, forma_pagamento, status,
        cliente:clientes(id, nome, telefone),
        itens:comanda_itens(
          id, tipo, quantidade, preco_unitario, subtotal,
          servico:servicos(id, nome),
          produto:produtos(id, nome),
          profissionais:comanda_item_profissionais(
            id, profissional_id, percentual_participacao, percentual_comissao, valor_base, valor_comissao,
            profissional:profissionais(id, nome, cor_agenda)
          )
        )
      `)
      .eq('unidade_id', unidadeId)
      .eq('status', 'fechada')
      .gte('data_fechamento', dataInicio + 'T00:00:00')
      .lte('data_fechamento', dataFim + 'T23:59:59')
      .order('data_fechamento', { ascending: false })

    setComandas((data as unknown as Comanda[]) || [])
    setLoading(false)
  }

  // Resumo relatório 1
  const totalFaturamento = comandas.reduce((s, c) => s + (c.valor_final || 0), 0)
  const totalDesconto = comandas.reduce((s, c) => s + (c.desconto || 0), 0)

  // Resumo por profissional
  const resumoPorProfissional = profissionais.map(prof => {
    let totalBase = 0
    let totalComissao = 0
    const comandasIds = new Set<string>()
    let totalItens = 0

    comandas.forEach(c => {
      c.itens?.forEach(item => {
        item.profissionais?.forEach(cp => {
          if (cp.profissional_id === prof.id) {
            totalBase += cp.valor_base || 0
            totalComissao += cp.valor_comissao || 0
            comandasIds.add(c.id)
            totalItens++
          }
        })
      })
    })

    return { profissional: prof, totalBase, totalComissao, comandasCount: comandasIds.size, totalItens }
  }).filter(r => r.totalBase > 0 || r.totalComissao > 0)
    .sort((a, b) => b.totalComissao - a.totalComissao)

  // Comandas de um profissional específico
  const comandasProfissional = profissionalId !== 'todos'
    ? comandas.filter(c => c.itens?.some(item => item.profissionais?.some(cp => cp.profissional_id === profissionalId)))
    : []

  const resumoProf = resumoPorProfissional.find(r => r.profissional.id === profissionalId)

  function irParaMesAnterior() {
    const m = new Date(dataInicio)
    m.setMonth(m.getMonth() - 1)
    setDataInicio(format(startOfMonth(m), 'yyyy-MM-dd'))
    setDataFim(format(endOfMonth(m), 'yyyy-MM-dd'))
  }

  function irParaEsteMes() {
    setDataInicio(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setDataFim(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const tituloPrint = aba === 'comandas'
    ? 'Relatório de Comandas Fechadas'
    : profissionalId === 'todos'
      ? 'Relatório de Comissão — Todos os Profissionais'
      : `Relatório de Comissão — ${resumoProf?.profissional.nome || ''}`

  const periodoFormatado = `${format(new Date(dataInicio + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(dataFim + 'T12:00:00'), 'dd/MM/yyyy')}`

  return (
    <div className="p-4 md:p-6">
      {/* Cabeçalho visível apenas na impressão */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-300">
        <p className="text-lg font-bold text-gray-900">Danelon</p>
        <p className="text-base font-semibold text-gray-800 mt-1">{tituloPrint}</p>
        <p className="text-sm text-gray-600 mt-0.5">Período: {periodoFormatado}</p>
      </div>

      <div className="print:hidden mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análise de comandas e comissionamento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => window.open(`/print/comandas?inicio=${dataInicio}&fim=${dataFim}`, '_blank')}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">PDF Comandas</span>
            <span className="sm:hidden">Cmd.</span>
          </button>
          <button
            onClick={() => window.open(`/print/comissao?inicio=${dataInicio}&fim=${dataFim}&profissional=${profissionalId}`, '_blank')}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">PDF Comissão</span>
            <span className="sm:hidden">Com.</span>
          </button>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="print:hidden bg-white rounded-xl border border-gray-200 p-4 mb-6">
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
      <div className="print:hidden flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => setAba('comandas')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${aba === 'comandas' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
          Comandas Fechadas
        </button>
        <button onClick={() => setAba('comissao')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${aba === 'comissao' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
          Comissão
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : aba === 'comandas' ? (

        /* ===== RELATÓRIO 1: COMANDAS FECHADAS ===== */
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Comandas fechadas</p>
              <p className="text-2xl font-bold text-gray-900">{comandas.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Faturamento</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalFaturamento)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Descontos</p>
              <p className="text-2xl font-bold text-red-600">- {formatCurrency(totalDesconto)}</p>
            </div>
          </div>

          {comandas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma comanda fechada no período</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Tabela */}
              <table className="w-full hidden md:table print:table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Data fechamento</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Itens</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pagamento</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Desconto</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comandas.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {c.data_fechamento ? format(parseISO(c.data_fechamento), 'dd/MM/yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.cliente?.nome || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {c.itens?.map(item => (
                            <p key={item.id} className="text-xs text-gray-600">
                              · {item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome}
                              {item.quantidade > 1 ? ` ×${item.quantidade}` : ''}{' '}
                              <span className="font-medium text-gray-800">{formatCurrency(item.subtotal)}</span>
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {c.forma_pagamento ? formaPagamentoLabel[c.forma_pagamento] : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {c.desconto > 0
                          ? <span className="text-red-600">- {formatCurrency(c.desconto)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                        {formatCurrency(c.valor_final)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">
                      TOTAL — {comandas.length} comanda{comandas.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                      {totalDesconto > 0 ? `- ${formatCurrency(totalDesconto)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(totalFaturamento)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden print:hidden divide-y divide-gray-50">
                {comandas.map(c => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex justify-between items-start mb-1.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.cliente?.nome || '—'}</p>
                        <p className="text-xs text-gray-500">
                          {c.data_fechamento ? format(parseISO(c.data_fechamento), 'dd/MM/yyyy') : '—'}
                          {c.forma_pagamento ? ` · ${formaPagamentoLabel[c.forma_pagamento]}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(c.valor_final)}</p>
                    </div>
                    {c.itens?.map(item => (
                      <p key={item.id} className="text-xs text-gray-500">
                        · {item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome}
                        {item.quantidade > 1 ? ` ×${item.quantidade}` : ''} — {formatCurrency(item.subtotal)}
                      </p>
                    ))}
                  </div>
                ))}
                <div className="px-4 py-3 bg-amber-50 flex justify-between">
                  <p className="text-sm font-semibold text-gray-700">Total {comandas.length} comanda{comandas.length !== 1 ? 's' : ''}</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(totalFaturamento)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

      ) : (

        /* ===== RELATÓRIO 2: COMISSÃO POR PROFISSIONAL ===== */
        <div>
          <div className="print:hidden flex items-center gap-3 mb-6">
            <label className="text-sm text-gray-600 whitespace-nowrap">Profissional:</label>
            <select value={profissionalId} onChange={e => setProfissionalId(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600">
              <option value="todos">Todos os profissionais</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            {profissionalId !== 'todos' && (
              <button onClick={() => setProfissionalId('todos')}
                className="text-sm text-amber-700 hover:underline whitespace-nowrap">
                ← Todos
              </button>
            )}
          </div>

          {profissionalId === 'todos' ? (
            /* Visão geral de todos */
            resumoPorProfissional.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma comissão registrada no período</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Base total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(resumoPorProfissional.reduce((s, r) => s + r.totalBase, 0))}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 mb-1">Total comissões</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {formatCurrency(resumoPorProfissional.reduce((s, r) => s + r.totalComissao, 0))}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
                    <p className="text-xs text-gray-500 mb-1">Profissionais</p>
                    <p className="text-2xl font-bold text-gray-900">{resumoPorProfissional.length}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Desktop */}
                  <table className="w-full hidden md:table">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Profissional</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Comandas</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Itens</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Base</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Comissão</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {resumoPorProfissional.map(r => (
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
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{r.comandasCount}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{r.totalItens}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(r.totalBase)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-amber-700 text-right">{formatCurrency(r.totalComissao)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setProfissionalId(r.profissional.id)}
                              className="print:hidden text-xs text-amber-700 hover:underline">
                              Ver detalhes →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 border-t-2 border-amber-200">
                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">TOTAL</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(resumoPorProfissional.reduce((s, r) => s + r.totalBase, 0))}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-amber-700 text-right">
                          {formatCurrency(resumoPorProfissional.reduce((s, r) => s + r.totalComissao, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>

                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-gray-50">
                    {resumoPorProfissional.map(r => (
                      <div key={r.profissional.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                          style={{ backgroundColor: r.profissional.cor_agenda }}>
                          {r.profissional.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{r.profissional.nome}</p>
                          <p className="text-xs text-gray-500">{r.comandasCount} comanda{r.comandasCount !== 1 ? 's' : ''} · {r.totalItens} item{r.totalItens !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-amber-700">{formatCurrency(r.totalComissao)}</p>
                          <button onClick={() => setProfissionalId(r.profissional.id)}
                            className="print:hidden text-xs text-amber-700 hover:underline">Detalhes</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          ) : (
            /* Detalhes de um profissional */
            <div>
              {/* Header do profissional */}
              {resumoProf && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-medium flex-shrink-0"
                    style={{ backgroundColor: resumoProf.profissional.cor_agenda }}>
                    {resumoProf.profissional.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{resumoProf.profissional.nome}</p>
                    <p className="text-sm text-gray-500">
                      {resumoProf.comandasCount} comanda{resumoProf.comandasCount !== 1 ? 's' : ''} · {resumoProf.totalItens} item{resumoProf.totalItens !== 1 ? 's' : ''} no período
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">Comissão total</p>
                    <p className="text-xl font-bold text-amber-700">{formatCurrency(resumoProf.totalComissao)}</p>
                    <p className="text-xs text-gray-500">Base: {formatCurrency(resumoProf.totalBase)}</p>
                  </div>
                </div>
              )}

              {comandasProfissional.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-sm">Nenhuma comissão para este profissional no período</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comandasProfissional.map(c => {
                    const itensProf = (c.itens || []).filter(item =>
                      item.profissionais?.some(cp => cp.profissional_id === profissionalId)
                    )
                    const subtotalBase = itensProf.reduce((s, item) => {
                      const cp = item.profissionais?.find(p => p.profissional_id === profissionalId)
                      return s + (cp?.valor_base || 0)
                    }, 0)
                    const subtotalComissao = itensProf.reduce((s, item) => {
                      const cp = item.profissionais?.find(p => p.profissional_id === profissionalId)
                      return s + (cp?.valor_comissao || 0)
                    }, 0)

                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Cabeçalho da comanda */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{c.cliente?.nome || '—'}</p>
                            <p className="text-xs text-gray-500">
                              {c.data_fechamento ? format(parseISO(c.data_fechamento), "dd/MM/yyyy 'às' HH:mm") : '—'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Valor total da comanda</p>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(c.valor_final)}</p>
                          </div>
                        </div>

                        {/* Itens trabalhados */}
                        <div className="divide-y divide-gray-50">
                          {itensProf.map(item => {
                            const cp = item.profissionais?.find(p => p.profissional_id === profissionalId)!
                            const nProfs = item.profissionais?.length || 1
                            const nomeItem = item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome

                            return (
                              <div key={item.id} className="px-4 py-3">
                                {/* Desktop */}
                                <div className="hidden md:flex items-center gap-3 text-sm">
                                  <p className="font-medium text-gray-900 w-52 flex-shrink-0 truncate">{nomeItem}</p>
                                  <div className="flex-1 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                                    <span>
                                      Subtotal: <strong className="text-gray-900">{formatCurrency(item.subtotal)}</strong>
                                    </span>
                                    <span>
                                      Participação: <strong className="text-gray-900">{cp.percentual_participacao}%</strong>
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${nProfs > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {nProfs === 1 ? '1 profissional' : `${nProfs} profissionais (rateio)`}
                                    </span>
                                    <span>
                                      Base: <strong className="text-gray-900">{formatCurrency(cp.valor_base)}</strong>
                                    </span>
                                    <span>
                                      Comissão: <strong className="text-gray-900">{cp.percentual_comissao}%</strong>
                                    </span>
                                  </div>
                                  <p className="font-semibold text-amber-700 flex-shrink-0">{formatCurrency(cp.valor_comissao)}</p>
                                </div>

                                {/* Mobile */}
                                <div className="md:hidden">
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="text-sm font-medium text-gray-900 flex-1 mr-2">{nomeItem}</p>
                                    <p className="text-sm font-semibold text-amber-700 flex-shrink-0">{formatCurrency(cp.valor_comissao)}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                    <span>Subtotal: {formatCurrency(item.subtotal)}</span>
                                    <span>{cp.percentual_participacao}% participação</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${nProfs > 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {nProfs === 1 ? '1 prof.' : `${nProfs} profs. (rateio)`}
                                    </span>
                                    <span>Base: {formatCurrency(cp.valor_base)}</span>
                                    <span>{cp.percentual_comissao}% comissão</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Rodapé da comanda */}
                        <div className="flex justify-end gap-6 px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs">
                          <span className="text-gray-600">
                            Base nesta comanda: <strong className="text-gray-900">{formatCurrency(subtotalBase)}</strong>
                          </span>
                          <span className="text-gray-600">
                            Comissão: <strong className="text-amber-700">{formatCurrency(subtotalComissao)}</strong>
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Total geral */}
                  {resumoProf && (
                    <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200 flex flex-wrap justify-between items-center gap-3">
                      <p className="font-semibold text-gray-900 text-sm">TOTAL DO PERÍODO</p>
                      <div className="flex gap-6 text-sm">
                        <span className="text-gray-600">Base: <strong className="text-gray-900">{formatCurrency(resumoProf.totalBase)}</strong></span>
                        <span className="text-gray-600">Comissão: <strong className="text-amber-700 text-base">{formatCurrency(resumoProf.totalComissao)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
