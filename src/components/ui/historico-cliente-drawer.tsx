'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Receipt, TrendingUp, Scissors, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Visita {
  id: string
  numero: number | null
  created_at: string
  data_fechamento: string | null
  valor_final: number
  desconto: number
  status: string
  itens: { tipo: string; servico: { nome: string } | null; produto: { nome: string } | null }[]
}

interface Props {
  clienteId: string
  clienteNome: string
  unidadeId: string
  onClose: () => void
}

export default function HistoricoClienteDrawer({ clienteId, clienteNome, unidadeId, onClose }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('comandas')
        .select(`
          id, numero, created_at, data_fechamento, valor_final, desconto, status,
          itens:comanda_itens(
            tipo,
            servico:servicos(nome),
            produto:produtos(nome)
          )
        `)
        .eq('cliente_id', clienteId)
        .eq('unidade_id', unidadeId)
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false })
      setVisitas((data as unknown as Visita[]) || [])
      setCarregando(false)
    }
    carregar()
  }, [clienteId, unidadeId])

  const visitasFechadas = visitas.filter(v => v.status === 'fechada')
  const totalGasto = visitasFechadas.reduce((s, v) => s + v.valor_final, 0)
  const totalDesconto = visitasFechadas.reduce((s, v) => s + (v.desconto || 0), 0)

  const servicosFrequentes = Object.entries(
    visitas.flatMap(v => v.itens.filter(i => i.tipo === 'servico' && i.servico).map(i => i.servico!.nome))
      .reduce<Record<string, number>>((acc, nome) => ({ ...acc, [nome]: (acc[nome] || 0) + 1 }), {})
  )
    .filter(([, count]) => count >= 3)
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="fixed inset-0 z-[60] flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Histórico da cliente</h2>
            <p className="text-sm text-gray-500">{clienteNome}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {carregando ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : visitas.length === 0 ? (
            <div className="text-center py-10">
              <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma visita registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xs text-amber-600 font-medium mb-1">Total de visitas</p>
                  <p className="text-2xl font-bold text-amber-800">{visitas.length}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Total gasto
                  </p>
                  <p className="text-2xl font-bold text-green-800">{formatCurrency(totalGasto)}</p>
                </div>
                {totalDesconto > 0 && (
                  <div className="col-span-2 bg-rose-50 rounded-xl p-4">
                    <p className="text-xs text-rose-600 font-medium mb-1">Total de desconto concedido</p>
                    <p className="text-2xl font-bold text-rose-800">{formatCurrency(totalDesconto)}</p>
                  </div>
                )}
              </div>

              {/* Serviços preferidos (≥ 3 vezes) */}
              {servicosFrequentes.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5 mb-3">
                    <Scissors className="w-3.5 h-3.5" /> Serviços mais realizados
                  </p>
                  <div className="space-y-2">
                    {servicosFrequentes.map(([nome, count]) => (
                      <div key={nome} className="flex items-center justify-between">
                        <span className="text-xs text-indigo-900 font-medium">{nome}</span>
                        <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                          {count}× realizado{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de visitas */}
              {visitas.map(visita => {
                const data = new Date(visita.data_fechamento || visita.created_at)
                const dataFmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const servicos = visita.itens.filter(i => i.tipo === 'servico' && i.servico).map(i => i.servico!.nome)
                const produtos = visita.itens.filter(i => i.tipo === 'produto' && i.produto).map(i => i.produto!.nome)
                const isFechada = visita.status === 'fechada'
                return (
                  <div key={visita.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800">{dataFmt}</span>
                          {visita.numero && <span className="text-xs text-gray-400">#{visita.numero}</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isFechada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isFechada ? 'Fechada' : 'Aberta'}
                          </span>
                          {isFechada && <span className="text-sm font-semibold text-gray-900">{formatCurrency(visita.valor_final)}</span>}
                        </div>
                      </div>
                      {servicos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {servicos.map((s, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}
                      {produtos.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {produtos.map((p, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { onClose(); router.push(`/dashboard/comandas?id=${visita.id}`) }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-gray-100 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir comanda
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
