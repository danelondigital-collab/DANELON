'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Search } from 'lucide-react'
import { format, addMinutes, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Agendamento, Profissional, Servico, Cliente } from '@/types'
import HistoricoLog from '@/components/ui/historico-log'

interface ItemAgendamento {
  profissional_id: string
  servico_id: string
  hora_inicio: string
  duracao_minutos: number
}

interface Props {
  agendamento: Agendamento | null
  unidadeId: string
  profissionais: Profissional[]
  servicos: Servico[]
  horarioInicial: { data: Date; profissional_id?: string } | null
  perfil: string
  onClose: () => void
  onSalvo: () => void
}

const STATUS_OPTIONS = [
  { value: 'agendado', label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'em_atendimento', label: 'Em atendimento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'faltou', label: 'Faltou' },
]

const DURACOES_MIN = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 270, 300, 330, 360]

function fmtDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function somaMin(hora: string, minutos: number): string {
  const base = parse(hora, 'HH:mm', new Date())
  return format(addMinutes(base, minutos), 'HH:mm')
}

export default function AgendamentoModal({
  agendamento, unidadeId, profissionais, servicos,
  horarioInicial, perfil, onClose, onSalvo
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const dataInicio = agendamento
    ? new Date(agendamento.data_hora_inicio)
    : (horarioInicial?.data || new Date())

  const clienteInicial = agendamento?.cliente || null

  const [form, setForm] = useState({
    cliente_id: agendamento?.cliente_id || '',
    data: format(dataInicio, 'yyyy-MM-dd'),
    status: agendamento?.status || 'agendado',
    observacoes: agendamento?.observacoes || '',
  })

  const [clienteBusca, setClienteBusca] = useState(clienteInicial?.nome || '')
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(clienteInicial)
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [mostrarDropdown, setMostrarDropdown] = useState(false)

  useEffect(() => {
    if (!clienteBusca.trim() || clienteSelecionado) { setClientesFiltrados([]); setBuscandoCliente(false); return }
    const termo = clienteBusca.trim()
    const t = setTimeout(async () => {
      setBuscandoCliente(true)
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
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
      setClientesFiltrados(ordenados.slice(0, 30))
      setBuscandoCliente(false)
    }, 300)
    return () => clearTimeout(t)
  }, [clienteBusca, clienteSelecionado, unidadeId])

  function duracaoServico(servicoId: string): number {
    return servicos.find(s => s.id === servicoId)?.duracao_minutos || 60
  }

  const [itens, setItens] = useState<ItemAgendamento[]>(
    agendamento?.itens?.map(i => ({
      profissional_id: i.profissional_id,
      servico_id: i.servico_id,
      hora_inicio: i.data_hora_inicio ? format(new Date(i.data_hora_inicio), 'HH:mm') : format(dataInicio, 'HH:mm'),
      duracao_minutos: i.data_hora_inicio && i.data_hora_fim
        ? Math.round((new Date(i.data_hora_fim).getTime() - new Date(i.data_hora_inicio).getTime()) / 60000)
        : duracaoServico(i.servico_id),
    })) || [{
      profissional_id: horarioInicial?.profissional_id || (profissionais[0]?.id || ''),
      servico_id: servicos[0]?.id || '',
      hora_inicio: format(dataInicio, 'HH:mm'),
      duracao_minutos: duracaoServico(servicos[0]?.id || ''),
    }]
  )

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addItem() {
    setItens(prev => {
      const ultimo = prev[prev.length - 1]
      const horaInicio = ultimo ? somaMin(ultimo.hora_inicio, ultimo.duracao_minutos) : format(dataInicio, 'HH:mm')
      const servicoId = servicos[0]?.id || ''
      return [...prev, {
        profissional_id: ultimo?.profissional_id || profissionais[0]?.id || '',
        servico_id: servicoId,
        hora_inicio: horaInicio,
        duracao_minutos: duracaoServico(servicoId),
      }]
    })
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function setItemField(idx: number, field: keyof ItemAgendamento, value: string | number) {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const atualizado = { ...item, [field]: value }
      // Ao trocar o serviço, prevalece a duração configurada no cadastro do serviço
      if (field === 'servico_id') {
        atualizado.duracao_minutos = duracaoServico(value as string)
      }
      return atualizado
    }))
  }

  async function handleSalvar() {
    if (!form.cliente_id) { setErro('Selecione o cliente.'); return }
    if (itens.length === 0) { setErro('Adicione pelo menos um serviço.'); return }
    if (itens.some(i => !i.profissional_id || !i.servico_id)) { setErro('Preencha profissional e serviço em todos os itens.'); return }

    setLoading(true); setErro('')

    const itensComHorario = itens.map(i => ({
      ...i,
      inicio: new Date(`${form.data}T${i.hora_inicio}:00`),
      fim: new Date(`${form.data}T${somaMin(i.hora_inicio, i.duracao_minutos)}:00`),
    }))

    // Verificar bloqueios de agenda antes de salvar
    const profIds = [...new Set(itensComHorario.map(i => i.profissional_id).filter(Boolean))]
    const { data: bloqueios } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .in('profissional_id', profIds)
      .eq('data', form.data)

    if (bloqueios && bloqueios.length > 0) {
      const dataFmt = format(new Date(`${form.data}T12:00:00`), "dd/MM/yyyy (EEEE)", { locale: ptBR })
      for (const b of bloqueios) {
        const prof = profissionais.find(p => p.id === b.profissional_id)
        const nome = prof?.nome || 'Profissional'
        const itensDoProf = itensComHorario.filter(i => i.profissional_id === b.profissional_id)
        if (itensDoProf.length === 0) continue

        if (!b.hora_inicio && !b.hora_fim) {
          setErro(`${nome} não está disponível em ${dataFmt} — agenda bloqueada o dia inteiro.`)
          setLoading(false)
          return
        }

        const blqInicio = new Date(`${form.data}T${b.hora_inicio}`)
        const blqFim = new Date(`${form.data}T${b.hora_fim}`)
        for (const item of itensDoProf) {
          if (item.inicio < blqFim && item.fim > blqInicio) {
            const hIni = b.hora_inicio.slice(0, 5)
            const hFim = b.hora_fim.slice(0, 5)
            setErro(`${nome} não está disponível em ${dataFmt} das ${hIni} às ${hFim}.`)
            setLoading(false)
            return
          }
        }
      }
    }

    // O período do agendamento (para a grade da agenda) abrange do início do 1º item ao fim do último
    const inicioGeral = new Date(Math.min(...itensComHorario.map(i => i.inicio.getTime())))
    const fimGeral = new Date(Math.max(...itensComHorario.map(i => i.fim.getTime())))

    const itensPayload = itensComHorario.map(i => ({
      profissional_id: i.profissional_id,
      servico_id: i.servico_id,
      data_hora_inicio: i.inicio.toISOString(),
      data_hora_fim: i.fim.toISOString(),
    }))

    if (agendamento) {
      const { error } = await supabase.from('agendamentos').update({
        cliente_id: form.cliente_id,
        data_hora_inicio: inicioGeral.toISOString(),
        data_hora_fim: fimGeral.toISOString(),
        status: form.status,
        observacoes: form.observacoes || null,
      }).eq('id', agendamento.id)

      if (error) { setErro(error.message); setLoading(false); return }

      await supabase.from('agendamento_itens').delete().eq('agendamento_id', agendamento.id)
      await supabase.from('agendamento_itens').insert(
        itensPayload.map(i => ({ agendamento_id: agendamento.id, ...i }))
      )
    } else {
      const { data: novoAg, error } = await supabase.from('agendamentos').insert({
        cliente_id: form.cliente_id,
        unidade_id: unidadeId,
        data_hora_inicio: inicioGeral.toISOString(),
        data_hora_fim: fimGeral.toISOString(),
        status: form.status,
        observacoes: form.observacoes || null,
      }).select().single()

      if (error || !novoAg) { setErro(error?.message || 'Erro ao salvar'); setLoading(false); return }

      await supabase.from('agendamento_itens').insert(
        itensPayload.map(i => ({ agendamento_id: novoAg.id, ...i }))
      )
    }

    setLoading(false)
    onSalvo()
  }

  async function handleExcluir() {
    if (!agendamento) return
    if (!confirm('Excluir este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', agendamento.id)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{agendamento ? 'Editar agendamento' : 'Novo agendamento'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
            {clienteSelecionado ? (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{clienteSelecionado.nome}</p>
                  {clienteSelecionado.telefone && <p className="text-xs text-gray-500">{clienteSelecionado.telefone}</p>}
                </div>
                {!agendamento && (
                  <button type="button" onClick={() => {
                    setClienteSelecionado(null)
                    setClienteBusca('')
                    setField('cliente_id', '')
                  }} className="text-xs text-red-500 hover:underline ml-3 flex-shrink-0">
                    Trocar
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar pelo nome ou telefone..."
                  value={clienteBusca}
                  onChange={e => {
                    setClienteBusca(e.target.value)
                    setMostrarDropdown(true)
                  }}
                  onFocus={() => setMostrarDropdown(true)}
                  onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                {mostrarDropdown && clienteBusca && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {buscandoCliente ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
                    ) : clientesFiltrados.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">Nenhum cliente encontrado</p>
                    ) : clientesFiltrados.map(c => (
                      <button key={c.id} type="button"
                        onMouseDown={() => {
                          setClienteSelecionado(c)
                          setClienteBusca(c.nome)
                          setField('cliente_id', c.id)
                          setMostrarDropdown(false)
                        }}
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

          {/* Data e status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={form.data} onChange={e => setField('data', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Itens do agendamento: serviço + profissional + horário + duração */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Itens do agendamento</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr_88px_110px_28px] gap-2 mb-1.5 px-0.5">
              <span className="text-xs font-medium text-gray-500">Serviço</span>
              <span className="text-xs font-medium text-gray-500">Profissional</span>
              <span className="text-xs font-medium text-gray-500">Horário</span>
              <span className="text-xs font-medium text-gray-500">Duração</span>
              <span />
            </div>

            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_88px_110px_28px] gap-2 items-center">
                  <select value={item.servico_id} onChange={e => setItemField(idx, 'servico_id', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                    <option value="">Serviço</option>
                    {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>

                  <select value={item.profissional_id} onChange={e => setItemField(idx, 'profissional_id', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                    <option value="">Profissional</option>
                    {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>

                  <input type="time" value={item.hora_inicio} onChange={e => setItemField(idx, 'hora_inicio', e.target.value)}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600" />

                  <select value={item.duracao_minutos} onChange={e => setItemField(idx, 'duracao_minutos', Number(e.target.value))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                    {!DURACOES_MIN.includes(item.duracao_minutos) && (
                      <option value={item.duracao_minutos}>{fmtDuracao(item.duracao_minutos)}</option>
                    )}
                    {DURACOES_MIN.map(d => <option key={d} value={d}>{fmtDuracao(d)}</option>)}
                  </select>

                  {itens.length > 1 ? (
                    <button onClick={() => removeItem(idx)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors justify-self-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => setField('observacoes', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
              placeholder="Observações sobre o agendamento..." />
          </div>

          {/* Histórico de alterações — apenas admin */}
          {agendamento && perfil === 'admin' && (
            <HistoricoLog tabela="agendamento" registroId={agendamento.id} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agendamento && (
              <button onClick={handleExcluir} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                Excluir
              </button>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
            <button onClick={handleSalvar} disabled={loading}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
