'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react'

interface Produto {
  id: string
  nome: string
  marca: string | null
  preco_venda: number
  unidade_nome: string
  quantidade_meta: number
  vendido_hoje: number
  vendido_semana: number
  vendido_mes: number
}

interface Props {
  produtos: Produto[]
  todasUnidades: boolean
}

function StatusBadge({ meta, vendido }: { meta: number; vendido: number }) {
  if (meta === 0) return <span className="text-xs text-slate-400">—</span>
  const pct = vendido / meta
  if (pct >= 1) return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="w-3.5 h-3.5" /> Meta atingida
    </span>
  )
  if (pct >= 0.7) return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
      <TrendingUp className="w-3.5 h-3.5" /> {Math.round(pct * 100)}%
    </span>
  )
  if (vendido === 0) return (
    <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
      <Minus className="w-3.5 h-3.5" /> Sem venda
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-red-500">
      <TrendingDown className="w-3.5 h-3.5" /> {Math.round(pct * 100)}%
    </span>
  )
}

export default function EstoqueClient({ produtos: initial, todasUnidades }: Props) {
  const supabase = createClient()
  const [produtos, setProdutos] = useState(initial)
  const [busca, setBusca] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.marca || '').toLowerCase().includes(busca.toLowerCase()) ||
    p.unidade_nome.toLowerCase().includes(busca.toLowerCase())
  )

  function iniciarEdicao(p: Produto) {
    setEditandoId(p.id)
    setEditValor(String(p.quantidade_meta || ''))
    setTimeout(() => inputRef.current?.select(), 50)
  }

  async function salvarMeta(produtoId: string) {
    const val = parseInt(editValor) || 0
    setEditandoId(null)

    setProdutos(prev => prev.map(p => p.id === produtoId ? { ...p, quantidade_meta: val } : p))

    const { error } = await supabase
      .from('estoque_metas')
      .upsert({ produto_id: produtoId, quantidade_meta: val, updated_at: new Date().toISOString() }, { onConflict: 'produto_id' })

    if (error) {
      setProdutos(prev => prev.map(p => p.id === produtoId ? { ...p, quantidade_meta: initial.find(i => i.id === produtoId)?.quantidade_meta ?? 0 } : p))
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar produto ou marca..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <span className="text-sm text-slate-500">{filtrados.length} produto{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Produto</th>
                {todasUnidades && <th className="text-left px-4 py-3 font-semibold text-slate-600">Unidade</th>}
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Preço</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Meta Diária</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Hoje</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Semana</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Mês</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{p.nome}</p>
                    {p.marca && <p className="text-xs text-slate-400">{p.marca}</p>}
                  </td>
                  {todasUnidades && (
                    <td className="px-4 py-3 text-xs text-slate-500">{p.unidade_nome}</td>
                  )}
                  <td className="px-4 py-3 text-slate-600">
                    {p.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editandoId === p.id ? (
                      <input
                        ref={inputRef}
                        type="number"
                        min={0}
                        value={editValor}
                        onChange={e => setEditValor(e.target.value)}
                        onBlur={() => salvarMeta(p.id)}
                        onKeyDown={e => { if (e.key === 'Enter') salvarMeta(p.id); if (e.key === 'Escape') setEditandoId(null) }}
                        className="w-16 text-center border border-violet-400 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    ) : (
                      <button
                        onClick={() => iniciarEdicao(p)}
                        className={`w-12 text-center rounded px-2 py-1 text-sm font-medium transition-colors hover:bg-violet-100 hover:text-violet-700 ${
                          p.quantidade_meta > 0 ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        {p.quantidade_meta > 0 ? p.quantidade_meta : '—'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-700">{p.vendido_hoje}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{p.vendido_semana}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{p.vendido_mes}</td>
                  <td className="px-4 py-3">
                    <StatusBadge meta={p.quantidade_meta} vendido={p.vendido_hoje} />
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={todasUnidades ? 8 : 7} className="px-4 py-12 text-center text-slate-400">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3">Clique na meta para editar. Pressione Enter para salvar.</p>
    </div>
  )
}
