export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Comanda, Profissional } from '@/types'
import PrintButton from '../PrintButton'

interface PageProps {
  searchParams: Promise<{ inicio?: string; fim?: string; profissional?: string }>
}

export default async function PrintComissaoPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const hoje = new Date()
  const inicio = params.inicio || format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')
  const fim = params.fim || format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), 'yyyy-MM-dd')
  const profissionalFiltro = params.profissional || 'todos'

  const { data: unidade } = await supabase
    .from('unidades')
    .select('nome, cidade')
    .eq('id', unidadeId)
    .single()

  const { data: rawProfissionais } = await supabase
    .from('profissionais')
    .select('*')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('nome')

  const profissionais = (rawProfissionais as Profissional[]) || []

  const { data: rawComandas } = await supabase
    .from('comandas')
    .select(`
      id, data_abertura, data_fechamento, valor_total, desconto, valor_final, forma_pagamento, status,
      cliente:clientes(id, nome),
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
    .gte('data_fechamento', inicio + 'T00:00:00')
    .lte('data_fechamento', fim + 'T23:59:59')
    .order('data_fechamento', { ascending: true })

  const comandas = (rawComandas as unknown as Comanda[]) || []

  const periodoFormatado = `${format(new Date(inicio + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} a ${format(new Date(fim + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`

  // Calcula resumo por profissional — Base = Subtotal × Comissão%
  const resumoPorProfissional = profissionais.map(prof => {
    let totalBase = 0
    let totalComissao = 0
    const comandasIds = new Set<string>()
    let totalItens = 0

    comandas.forEach(c => {
      c.itens?.forEach(item => {
        item.profissionais?.forEach(cp => {
          if (cp.profissional_id === prof.id) {
            totalBase += (item.subtotal || 0) * (cp.percentual_comissao || 0) / 100
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

  const profissionalSelecionado = profissionalFiltro !== 'todos'
    ? profissionais.find(p => p.id === profissionalFiltro)
    : null

  const titulo = profissionalSelecionado
    ? `Relatório de Comissão — ${profissionalSelecionado.nome}`
    : 'Relatório de Comissão — Todos os Profissionais'

  const grandTotalBase = resumoPorProfissional.reduce((s, r) => s + r.totalBase, 0)
  const grandTotalComissao = resumoPorProfissional.reduce((s, r) => s + r.totalComissao, 0)

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-5 border-b-2 border-gray-800 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#B8924A' }}>
                <span className="text-white font-bold text-base">D</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Danelon</span>
            </div>
            {unidade && (
              <p className="text-sm text-gray-500 ml-12">{unidade.nome} — {unidade.cidade}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">{titulo}</p>
            <p className="text-sm text-gray-500 mt-0.5">{periodoFormatado}</p>
            <p className="text-xs text-gray-400 mt-0.5">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </div>

        {profissionalFiltro === 'todos' ? (
          /* ===== VISÃO GERAL — TODOS OS PROFISSIONAIS ===== */
          <>
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Profissionais</p>
                <p className="text-2xl font-bold text-gray-900">{resumoPorProfissional.length}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Cálculo Base total</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(grandTotalBase)}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center" style={{ backgroundColor: '#FFF8F0' }}>
                <p className="text-xs text-gray-500 mb-1">Total comissões</p>
                <p className="text-xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(grandTotalComissao)}</p>
              </div>
            </div>

            {/* Tabela resumo */}
            <table className="w-full border-collapse mb-8">
              <thead>
                <tr style={{ backgroundColor: '#1F2937' }}>
                  <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Profissional</th>
                  <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Comandas</th>
                  <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Itens</th>
                  <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Cálculo Base</th>
                  <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {resumoPorProfissional.map((r, idx) => (
                  <tr key={r.profissional.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F9FAFB' }}>
                    <td className="px-3 py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{ backgroundColor: r.profissional.cor_agenda }}>
                          {r.profissional.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{r.profissional.nome}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 text-right border-b border-gray-100">{r.comandasCount}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 text-right border-b border-gray-100">{r.totalItens}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-900 text-right border-b border-gray-100">{formatCurrency(r.totalBase)}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-right border-b border-gray-100" style={{ color: '#B8924A' }}>
                      {formatCurrency(r.totalComissao)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#FFF8F0' }}>
                  <td colSpan={3} className="px-3 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300">TOTAL GERAL</td>
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right border-t-2 border-gray-300">{formatCurrency(grandTotalBase)}</td>
                  <td className="px-3 py-3 text-sm font-bold text-right border-t-2 border-gray-300" style={{ color: '#B8924A' }}>{formatCurrency(grandTotalComissao)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Detalhamento por profissional */}
            {resumoPorProfissional.map(r => {
              const comandasProf = comandas.filter(c =>
                c.itens?.some(item => item.profissionais?.some(cp => cp.profissional_id === r.profissional.id))
              )
              return (
                <div key={r.profissional.id} className="mb-8 break-inside-avoid">
                  {/* Header profissional */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-t-lg border border-b-0 border-gray-300" style={{ backgroundColor: '#F3F4F6' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: r.profissional.cor_agenda }}>
                      {r.profissional.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">{r.profissional.nome}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {r.comandasCount} comanda{r.comandasCount !== 1 ? 's' : ''} · {r.totalItens} item{r.totalItens !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-gray-600">Cálculo Base: <strong className="text-gray-900">{formatCurrency(r.totalBase)}</strong></span>
                      <span className="mx-3 text-gray-300">|</span>
                      <span className="text-gray-600">Comissão: <strong style={{ color: '#B8924A' }}>{formatCurrency(r.totalComissao)}</strong></span>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-gray-300 rounded-b-lg overflow-hidden">
                    <thead>
                      <tr style={{ backgroundColor: '#E5E7EB' }}>
                        <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Data</th>
                        <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Cliente</th>
                        <th className="text-left text-xs font-semibold text-gray-700 px-3 py-2">Item</th>
                        <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Subtotal</th>
                        <th className="text-center text-xs font-semibold text-gray-700 px-3 py-2">Comissão%</th>
                        <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Cálculo Base</th>
                        <th className="text-center text-xs font-semibold text-gray-700 px-3 py-2">Rateio Profissionais</th>
                        <th className="text-center text-xs font-semibold text-gray-700 px-3 py-2">Participação%</th>
                        <th className="text-right text-xs font-semibold text-gray-700 px-3 py-2">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comandasProf.map((c, cIdx) => {
                        const itensProf = (c.itens || []).filter(item =>
                          item.profissionais?.some(cp => cp.profissional_id === r.profissional.id)
                        )
                        const subtotalComissao = itensProf.reduce((s, item) => {
                          const cp = item.profissionais?.find(p => p.profissional_id === r.profissional.id)
                          return s + (cp?.valor_comissao || 0)
                        }, 0)

                        return itensProf.map((item, iIdx) => {
                          const cp = item.profissionais?.find(p => p.profissional_id === r.profissional.id)!
                          const nProfs = item.profissionais?.length || 1
                          const nomeItem = item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome
                          const isLastItem = iIdx === itensProf.length - 1
                          const calculoBase = (item.subtotal || 0) * (cp.percentual_comissao || 0) / 100
                          const bg = cIdx % 2 === 0 ? '#ffffff' : '#F9FAFB'
                          const borderClass = isLastItem ? 'border-b border-gray-200' : ''

                          return (
                            <tr key={`${c.id}-${item.id}`} style={{ backgroundColor: bg }}>
                              <td className={`px-3 py-2 text-xs text-gray-600 whitespace-nowrap align-top ${borderClass}`}>
                                {iIdx === 0 && c.data_fechamento ? format(parseISO(c.data_fechamento), 'dd/MM/yyyy') : ''}
                              </td>
                              <td className={`px-3 py-2 text-xs font-medium text-gray-900 align-top ${borderClass}`}>
                                {iIdx === 0 ? (c.cliente?.nome || '—') : ''}
                              </td>
                              <td className={`px-3 py-2 text-xs text-gray-700 ${borderClass}`}>{nomeItem}</td>
                              <td className={`px-3 py-2 text-xs text-gray-600 text-right ${borderClass}`}>{formatCurrency(item.subtotal)}</td>
                              <td className={`px-3 py-2 text-xs text-gray-600 text-center ${borderClass}`}>{cp.percentual_comissao}%</td>
                              <td className={`px-3 py-2 text-xs text-gray-900 text-right ${borderClass}`}>{formatCurrency(calculoBase)}</td>
                              <td className={`px-3 py-2 text-center ${borderClass}`}>
                                {nProfs > 1 ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                                    {nProfs} profs.
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className={`px-3 py-2 text-xs text-gray-600 text-center ${borderClass}`}>{cp.percentual_participacao}%</td>
                              <td className={`px-3 py-2 text-xs font-semibold text-right ${borderClass}`} style={{ color: '#B8924A' }}>
                                {isLastItem ? formatCurrency(subtotalComissao) : formatCurrency(cp.valor_comissao)}
                              </td>
                            </tr>
                          )
                        })
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#FFF8F0' }}>
                        <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-800 border-t border-gray-300">
                          SUBTOTAL {r.profissional.nome.toUpperCase()}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-gray-900 text-right border-t border-gray-300">
                          {formatCurrency(r.totalBase)}
                        </td>
                        <td colSpan={2} className="border-t border-gray-300" />
                        <td className="px-3 py-2 text-xs font-bold text-right border-t border-gray-300" style={{ color: '#B8924A' }}>
                          {formatCurrency(r.totalComissao)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })}

            {/* Grand total */}
            <div className="mt-4 p-4 rounded-lg border-2" style={{ backgroundColor: '#FFF8F0', borderColor: '#B8924A' }}>
              <div className="flex justify-between items-center">
                <p className="font-bold text-gray-900">TOTAL GERAL DO PERÍODO</p>
                <div className="flex gap-8 text-sm">
                  <span className="text-gray-600">Cálculo Base: <strong className="text-gray-900 text-base">{formatCurrency(grandTotalBase)}</strong></span>
                  <span className="text-gray-600">Comissão total: <strong className="text-lg" style={{ color: '#B8924A' }}>{formatCurrency(grandTotalComissao)}</strong></span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ===== RELATÓRIO INDIVIDUAL — UM PROFISSIONAL ===== */
          (() => {
            const resumoProf = resumoPorProfissional.find(r => r.profissional.id === profissionalFiltro)
            const comandasProf = comandas.filter(c =>
              c.itens?.some(item => item.profissionais?.some(cp => cp.profissional_id === profissionalFiltro))
            )

            if (!resumoProf) {
              return (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg">Nenhuma comissão registrada para este profissional no período</p>
                </div>
              )
            }

            return (
              <>
                {/* Header profissional */}
                <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 mb-6" style={{ backgroundColor: '#F9FAFB' }}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-medium"
                    style={{ backgroundColor: resumoProf.profissional.cor_agenda }}>
                    {resumoProf.profissional.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900">{resumoProf.profissional.nome}</p>
                    <p className="text-sm text-gray-500">
                      {resumoProf.comandasCount} comanda{resumoProf.comandasCount !== 1 ? 's' : ''} · {resumoProf.totalItens} item{resumoProf.totalItens !== 1 ? 's' : ''} no período
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Cálculo Base</p>
                    <p className="text-base font-semibold text-gray-900">{formatCurrency(resumoProf.totalBase)}</p>
                    <p className="text-xs text-gray-500 mt-1">Comissão total</p>
                    <p className="text-2xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(resumoProf.totalComissao)}</p>
                  </div>
                </div>

                {/* Tabela de itens */}
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: '#1F2937' }}>
                      <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Data</th>
                      <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Cliente</th>
                      <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Item</th>
                      <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Subtotal</th>
                      <th className="text-center text-xs font-semibold text-white px-3 py-2.5">Comissão%</th>
                      <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Cálculo Base</th>
                      <th className="text-center text-xs font-semibold text-white px-3 py-2.5">Rateio Profissionais</th>
                      <th className="text-center text-xs font-semibold text-white px-3 py-2.5">Participação%</th>
                      <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comandasProf.map((c, cIdx) => {
                      const itensProf = (c.itens || []).filter(item =>
                        item.profissionais?.some(cp => cp.profissional_id === profissionalFiltro)
                      )

                      return itensProf.map((item, iIdx) => {
                        const cp = item.profissionais?.find(p => p.profissional_id === profissionalFiltro)!
                        const nProfs = item.profissionais?.length || 1
                        const nomeItem = item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome
                        const isLastItem = iIdx === itensProf.length - 1
                        const calculoBase = (item.subtotal || 0) * (cp.percentual_comissao || 0) / 100
                        const bg = cIdx % 2 === 0 ? '#ffffff' : '#F9FAFB'
                        const borderClass = isLastItem ? 'border-b border-gray-200' : ''

                        return (
                          <tr key={`${c.id}-${item.id}`} style={{ backgroundColor: bg }}>
                            <td className={`px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap align-top ${borderClass}`}>
                              {iIdx === 0 && c.data_fechamento ? format(parseISO(c.data_fechamento), 'dd/MM/yyyy') : ''}
                            </td>
                            <td className={`px-3 py-2.5 text-sm font-medium text-gray-900 align-top ${borderClass}`}>
                              {iIdx === 0 ? (c.cliente?.nome || '—') : ''}
                            </td>
                            <td className={`px-3 py-2.5 text-xs text-gray-700 ${borderClass}`}>{nomeItem}</td>
                            <td className={`px-3 py-2.5 text-xs text-gray-600 text-right ${borderClass}`}>{formatCurrency(item.subtotal)}</td>
                            <td className={`px-3 py-2.5 text-xs text-gray-600 text-center ${borderClass}`}>{cp.percentual_comissao}%</td>
                            <td className={`px-3 py-2.5 text-xs text-gray-900 text-right ${borderClass}`}>{formatCurrency(calculoBase)}</td>
                            <td className={`px-3 py-2.5 text-center ${borderClass}`}>
                              {nProfs > 1 ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                                  {nProfs} profs.
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className={`px-3 py-2.5 text-xs text-gray-600 text-center ${borderClass}`}>{cp.percentual_participacao}%</td>
                            <td className={`px-3 py-2.5 text-xs font-semibold text-right ${borderClass}`} style={{ color: '#B8924A' }}>
                              {formatCurrency(cp.valor_comissao)}
                            </td>
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#FFF8F0' }}>
                      <td colSpan={5} className="px-3 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300">
                        TOTAL DO PERÍODO
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right border-t-2 border-gray-300">
                        {formatCurrency(resumoProf.totalBase)}
                      </td>
                      <td colSpan={2} className="border-t-2 border-gray-300" />
                      <td className="px-3 py-3 text-sm font-bold text-right border-t-2 border-gray-300" style={{ color: '#B8924A' }}>
                        {formatCurrency(resumoProf.totalComissao)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )
          })()
        )}

        {/* Rodapé */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
          <span>Danelon — Sistema de Gestão</span>
          <span>{titulo} · {periodoFormatado}</span>
        </div>
      </div>

      <PrintButton titulo={titulo} />
    </div>
  )
}
