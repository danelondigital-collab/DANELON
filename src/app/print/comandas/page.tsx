export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Comanda } from '@/types'
import PrintButton from '../PrintButton'

const formaPagamentoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  pix: 'PIX',
  misto: 'Misto',
}

interface PageProps {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}

export default async function PrintComandasPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const hoje = new Date()
  const inicio = params.inicio || format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd')
  const fim = params.fim || format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), 'yyyy-MM-dd')

  const { data: unidade } = await supabase
    .from('unidades')
    .select('nome, cidade')
    .eq('id', unidadeId)
    .single()

  const { data: rawComandas } = await supabase
    .from('comandas')
    .select(`
      id, data_abertura, data_fechamento, valor_total, desconto, valor_final, forma_pagamento, status,
      cliente:clientes(id, nome),
      itens:comanda_itens(
        id, tipo, quantidade, preco_unitario, subtotal,
        servico:servicos(id, nome),
        produto:produtos(id, nome)
      )
    `)
    .eq('unidade_id', unidadeId)
    .eq('status', 'fechada')
    .gte('data_fechamento', inicio + 'T00:00:00')
    .lte('data_fechamento', fim + 'T23:59:59')
    .order('data_fechamento', { ascending: true })

  const comandas = (rawComandas as unknown as Comanda[]) || []

  const totalFaturamento = comandas.reduce((s, c) => s + (c.valor_final || 0), 0)
  const totalBruto = comandas.reduce((s, c) => s + (c.valor_total || 0), 0)
  const totalDesconto = comandas.reduce((s, c) => s + (c.desconto || 0), 0)

  const periodoFormatado = `${format(new Date(inicio + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} a ${format(new Date(fim + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-8 py-8">

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
            <p className="text-lg font-semibold text-gray-900">Relatório de Comandas Fechadas</p>
            <p className="text-sm text-gray-500 mt-0.5">{periodoFormatado}</p>
            <p className="text-xs text-gray-400 mt-0.5">Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Comandas</p>
            <p className="text-2xl font-bold text-gray-900">{comandas.length}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Valor bruto</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalBruto)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Descontos</p>
            <p className="text-xl font-bold text-red-600">{totalDesconto > 0 ? `- ${formatCurrency(totalDesconto)}` : '—'}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-3 text-center" style={{ backgroundColor: '#FFF8F0' }}>
            <p className="text-xs text-gray-500 mb-1">Faturamento líquido</p>
            <p className="text-xl font-bold" style={{ color: '#B8924A' }}>{formatCurrency(totalFaturamento)}</p>
          </div>
        </div>

        {/* Tabela */}
        {comandas.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Nenhuma comanda fechada no período selecionado</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#1F2937' }}>
                <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Data / Hora</th>
                <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Cliente</th>
                <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Itens</th>
                <th className="text-left text-xs font-semibold text-white px-3 py-2.5">Pagamento</th>
                <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Desconto</th>
                <th className="text-right text-xs font-semibold text-white px-3 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {comandas.map((c, idx) => (
                <tr key={c.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F9FAFB' }}>
                  <td className="px-3 py-2.5 text-xs text-gray-600 align-top whitespace-nowrap border-b border-gray-100">
                    {c.data_fechamento ? format(parseISO(c.data_fechamento), 'dd/MM/yyyy') : '—'}
                    <br />
                    <span className="text-gray-400">
                      {c.data_fechamento ? format(parseISO(c.data_fechamento), 'HH:mm') : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900 align-top border-b border-gray-100">
                    {c.cliente?.nome || '—'}
                  </td>
                  <td className="px-3 py-2.5 align-top border-b border-gray-100">
                    {c.itens?.map(item => (
                      <div key={item.id} className="text-xs text-gray-600 leading-5">
                        · {item.tipo === 'servico' ? item.servico?.nome : item.produto?.nome}
                        {item.quantidade > 1 ? ` ×${item.quantidade}` : ''}{' '}
                        <span className="font-medium text-gray-800">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 align-top border-b border-gray-100 whitespace-nowrap">
                    {c.forma_pagamento ? formaPagamentoLabel[c.forma_pagamento] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right align-top border-b border-gray-100 whitespace-nowrap">
                    {c.desconto > 0
                      ? <span className="text-red-600">- {formatCurrency(c.desconto)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 text-right align-top border-b border-gray-100 whitespace-nowrap">
                    {formatCurrency(c.valor_final)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#FFF8F0' }}>
                <td colSpan={4} className="px-3 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300">
                  TOTAL — {comandas.length} comanda{comandas.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-red-600 text-right border-t-2 border-gray-300">
                  {totalDesconto > 0 ? `- ${formatCurrency(totalDesconto)}` : '—'}
                </td>
                <td className="px-3 py-3 text-sm font-bold text-right border-t-2 border-gray-300" style={{ color: '#B8924A' }}>
                  {formatCurrency(totalFaturamento)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Rodapé */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
          <span>Danelon — Sistema de Gestão</span>
          <span>Relatório de Comandas Fechadas · {periodoFormatado}</span>
        </div>
      </div>

      <PrintButton titulo="Relatório de Comandas Fechadas" />
    </div>
  )
}
