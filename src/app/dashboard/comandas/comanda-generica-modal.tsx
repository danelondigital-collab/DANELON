'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, Profissional, Servico, ComissaoProfissionalItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { format, getDaysInMonth, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Shuffle, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react'

interface Props {
  unidadeId: string
  clientes: Cliente[]
  profissionais: Profissional[]
  servicos: Servico[]
  comissoesProfissional: ComissaoProfissionalItem[]
  onClose: () => void
  onCriadas: (count: number) => void
}

interface DiaDist {
  data: string      // YYYY-MM-DD
  diaSemana: string
  valor: number
}

const DIA_SEMANA: Record<number, string> = {
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

function getDiasTercaSabado(ano: number, mes: number): string[] {
  const dias: string[] = []
  const total = getDaysInMonth(new Date(ano, mes - 1))
  for (let d = 1; d <= total; d++) {
    const dow = new Date(ano, mes - 1, d).getDay()
    if (dow >= 2 && dow <= 6) {
      dias.push(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  }
  return dias
}

function distribuirAleatorio(totalCents: number, n: number): number[] {
  if (n === 1) return [totalCents]
  if (totalCents < n) return Array(n).fill(0).map((_, i) => (i === 0 ? totalCents : 0))

  for (let tentativa = 0; tentativa < 500; tentativa++) {
    // Cortes aleatórios em "totalCents - n" posições (garante mínimo de 1 cent por slot)
    const espaco = totalCents - n
    const cortes = new Set<number>()
    while (cortes.size < n - 1) cortes.add(Math.floor(Math.random() * (espaco - 1)) + 1)

    const cortesOrdenados = Array.from(cortes).sort((a, b) => a - b)
    const values: number[] = []
    let prev = 0
    for (const c of cortesOrdenados) {
      values.push(c - prev + 1)   // +1 garante mínimo de 1 cent
      prev = c
    }
    values.push(espaco - prev + 1)

    // Verificar unicidade
    if (new Set(values).size === n) {
      // Embaralhar
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]]
      }
      return values
    }
  }

  // Fallback com leve variação progressiva
  const base = Math.floor(totalCents / n)
  return Array.from({ length: n }, (_, i) => base + i).map((v, i, arr) => {
    const soma = arr.reduce((a, b) => a + b, 0)
    return i === n - 1 ? v + (totalCents - soma) : v
  })
}

export default function ComandaGenericaModal({
  unidadeId, clientes, profissionais, servicos, comissoesProfissional, onClose, onCriadas,
}: Props) {
  const supabase = createClient()

  const mesAtual = format(new Date(), 'yyyy-MM')
  const [etapa, setEtapa] = useState<'form' | 'preview' | 'sucesso'>('form')

  // Campos do formulário
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [mes, setMes] = useState(mesAtual)
  const [valorStr, setValorStr] = useState('')

  // Preview
  const [distribuicao, setDistribuicao] = useState<DiaDist[]>([])
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  const [clientesBusca, setClientesBusca] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)

  useEffect(() => {
    if (!buscaCliente.trim()) { setClientesBusca([]); return }
    const termo = buscaCliente.trim()
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
      setClientesBusca(ordenados.slice(0, 30))
      setBuscandoCliente(false)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente, unidadeId, supabase])

  const clientesFiltrados = clientesBusca

  const [clienteSelecionadoObj, setClienteSelecionadoObj] = useState<Cliente | null>(null)
  const clienteSelecionado = clienteSelecionadoObj || clientes.find(c => c.id === clienteId)
  const servicoSelecionado = servicos.find(s => s.id === servicoId)
  const valor = parseFloat(valorStr.replace(',', '.')) || 0
  const formValida = clienteId && servicoId && mes && valor > 0

  function gerarDistribuicao() {
    const [anoStr, mesStr] = mes.split('-')
    const ano = parseInt(anoStr)
    const mesNum = parseInt(mesStr)
    const dias = getDiasTercaSabado(ano, mesNum)

    if (dias.length === 0) {
      setErro('Nenhum dia de Terça a Sábado encontrado no mês selecionado.')
      return
    }

    const totalCents = Math.round(valor * 100)
    const valores = distribuirAleatorio(totalCents, dias.length)

    const dist: DiaDist[] = dias.map((dataStr, i) => {
      const dow = new Date(dataStr + 'T12:00:00').getDay()
      return {
        data: dataStr,
        diaSemana: DIA_SEMANA[dow] || '—',
        valor: valores[i] / 100,
      }
    })

    setDistribuicao(dist)
    setErro('')
    setEtapa('preview')
  }

  function regenerar() {
    const [anoStr, mesStr] = mes.split('-')
    const dias = getDiasTercaSabado(parseInt(anoStr), parseInt(mesStr))
    const totalCents = Math.round(valor * 100)
    const valores = distribuirAleatorio(totalCents, dias.length)
    setDistribuicao(prev => prev.map((d, i) => ({ ...d, valor: valores[i] / 100 })))
  }

  async function criarComandas() {
    if (!clienteId || !servicoId) return
    setCriando(true)
    setErro('')

    const pctComissao = (() => {
      if (!profissionalId) return 0
      const especifica = comissoesProfissional.find(c =>
        c.profissional_id === profissionalId && c.tipo === 'servico' && c.servico_id === servicoId
      )
      if (especifica) return especifica.percentual
      return servicoSelecionado?.comissao_servico ?? 0
    })()

    let criadas = 0
    for (const { data: dataStr, valor: val } of distribuicao) {
      const { data: comanda, error: e1 } = await supabase
        .from('comandas')
        .insert({
          cliente_id: clienteId,
          unidade_id: unidadeId,
          data_abertura: `${dataStr}T09:00:00.000Z`,
          data_fechamento: `${dataStr}T18:00:00.000Z`,
          status: 'fechada',
          valor_total: val,
          desconto: 0,
          credito_utilizado: 0,
          valor_final: val,
          forma_pagamento: 'dinheiro',
        })
        .select('id')
        .single()

      if (e1 || !comanda) continue

      const { data: item, error: e2 } = await supabase
        .from('comanda_itens')
        .insert({
          comanda_id: comanda.id,
          tipo: 'servico',
          servico_id: servicoId,
          quantidade: 1,
          preco_unitario: val,
          desconto_percentual: 0,
          subtotal: val,
        })
        .select('id')
        .single()

      if (!e2 && item && profissionalId) {
        await supabase.from('comanda_item_profissionais').insert({
          comanda_item_id: item.id,
          profissional_id: profissionalId,
          percentual_participacao: 100,
          percentual_comissao: pctComissao,
          valor_base: val,
          valor_comissao: val * pctComissao / 100,
        })
      }

      criadas++
    }

    setCriando(false)
    if (criadas === 0) {
      setErro('Nenhuma comanda criada. Verifique e tente novamente.')
    } else {
      setEtapa('sucesso')
      onCriadas(criadas)
    }
  }

  const totalDistribuido = distribuicao.reduce((s, d) => s + d.valor, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {etapa === 'preview' && (
              <button onClick={() => setEtapa('form')}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors -ml-1.5">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900">Comanda Genérica</h2>
              <p className="text-xs text-gray-500">
                {etapa === 'form' ? 'Distribui o valor em Terça a Sábado do mês' :
                 etapa === 'preview' ? `${distribuicao.length} dias · confirme os valores` :
                 'Comandas criadas com sucesso'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── ETAPA 1: FORMULÁRIO ── */}
          {etapa === 'form' && (
            <div className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Cliente <span className="text-red-500">*</span>
                </label>
                {clienteSelecionado ? (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{clienteSelecionado.nome}</p>
                      {clienteSelecionado.telefone && (
                        <p className="text-xs text-gray-500">{clienteSelecionado.telefone}</p>
                      )}
                    </div>
                    <button onClick={() => { setClienteId(''); setClienteSelecionadoObj(null); setBuscaCliente('') }}
                      className="text-xs text-red-500 hover:underline flex-shrink-0 ml-2">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={buscaCliente}
                      onChange={e => setBuscaCliente(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600 mb-2"
                    />
                    {buscaCliente.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50 bg-white shadow-sm">
                        {buscandoCliente ? (
                          <p className="px-3 py-2 text-sm text-gray-400">Buscando...</p>
                        ) : clientesFiltrados.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</p>
                        ) : clientesFiltrados.map(c => (
                          <button key={c.id} onClick={() => { setClienteId(c.id); setClienteSelecionadoObj(c); setBuscaCliente('') }}
                            className="w-full text-left px-3 py-2.5 hover:bg-amber-50 transition-colors">
                            <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                            {c.telefone && <p className="text-xs text-gray-500">{c.telefone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Serviço */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Serviço <span className="text-red-500">*</span>
                </label>
                <select value={servicoId} onChange={e => setServicoId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600">
                  <option value="">Selecione o serviço</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>

              {/* Profissional */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Profissional <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select value={profissionalId} onChange={e => setProfissionalId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600">
                  <option value="">Sem profissional</option>
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Mês */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Mês de distribuição <span className="text-red-500">*</span>
                </label>
                <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600" />
                <p className="text-xs text-gray-400 mt-1.5">
                  O valor será distribuído nos dias de Terça a Sábado deste mês
                </p>
              </div>

              {/* Valor total */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Valor total (R$) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={valorStr}
                    onChange={e => setValorStr(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
                {mes && valor > 0 && (() => {
                  const [a, m] = mes.split('-').map(Number)
                  const n = getDiasTercaSabado(a, m).length
                  return (
                    <p className="text-xs text-gray-400 mt-1.5">
                      {n} dia{n !== 1 ? 's' : ''} de Terça a Sábado em{' '}
                      {format(new Date(a, m - 1, 1), 'MMMM/yyyy', { locale: ptBR })}
                    </p>
                  )
                })()}
              </div>

              {erro && <p className="text-xs text-red-500">{erro}</p>}
            </div>
          )}

          {/* ── ETAPA 2: PREVIEW ── */}
          {etapa === 'preview' && (
            <div>
              {/* Resumo */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{clienteSelecionado?.nome}</p>
                  <p className="text-xs text-gray-500">
                    {servicoSelecionado?.nome}
                    {profissionalId && ` · ${profissionais.find(p => p.id === profissionalId)?.nome}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(mes + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-lg font-bold" style={{ color: '#B8924A' }}>
                    {formatCurrency(totalDistribuido)}
                  </p>
                </div>
              </div>

              {/* Tabela de distribuição */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                <div className="bg-gray-50 border-b border-gray-100 grid grid-cols-3 px-3 py-2 text-xs font-medium text-gray-500">
                  <span>Data</span>
                  <span>Dia</span>
                  <span className="text-right">Valor</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {distribuicao.map((d, i) => (
                    <div key={d.data} className="grid grid-cols-3 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                      <span className="text-gray-700 font-medium">
                        {format(new Date(d.data + 'T12:00:00'), 'dd/MM')}
                      </span>
                      <span className="text-gray-500">{d.diaSemana.replace('-feira', '')}</span>
                      <span className="text-right font-semibold" style={{ color: '#B8924A' }}>
                        {formatCurrency(d.valor)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border-t border-amber-100 grid grid-cols-3 px-3 py-2 text-xs font-semibold">
                  <span className="text-gray-700 col-span-2">TOTAL — {distribuicao.length} dia{distribuicao.length !== 1 ? 's' : ''}</span>
                  <span className="text-right" style={{ color: '#B8924A' }}>{formatCurrency(totalDistribuido)}</span>
                </div>
              </div>

              {/* Botão regenerar */}
              <button onClick={regenerar}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-1">
                <Shuffle className="w-3.5 h-3.5" />
                Gerar nova distribuição aleatória
              </button>

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
            </div>
          )}

          {/* ── ETAPA 3: SUCESSO ── */}
          {etapa === 'sucesso' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-lg font-bold text-gray-900 mb-1">
                {distribuicao.length} comanda{distribuicao.length !== 1 ? 's' : ''} criada{distribuicao.length !== 1 ? 's' : ''}!
              </p>
              <p className="text-sm text-gray-500 mb-1">
                {formatCurrency(totalDistribuido)} distribuídos em{' '}
                {format(new Date(mes + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR })}
              </p>
              <p className="text-xs text-gray-400">
                Aparecerão no relatório de Vendas do período
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {etapa === 'form' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={gerarDistribuicao}
                disabled={!formValida}
                className="flex-1 px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gerar distribuição →
              </button>
            </div>
          )}

          {etapa === 'preview' && (
            <div className="flex gap-3">
              <button onClick={() => setEtapa('form')}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                ← Ajustar
              </button>
              <button
                onClick={criarComandas}
                disabled={criando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition-colors disabled:opacity-60"
              >
                {criando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                ) : (
                  `Criar ${distribuicao.length} comanda${distribuicao.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}

          {etapa === 'sucesso' && (
            <button onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium bg-amber-700 hover:bg-amber-800 text-white rounded-xl transition-colors">
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
