'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { format, addMinutes } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Agendamento, Profissional, Servico, Cliente } from '@/types'

interface ItemAgendamento {
  profissional_id: string
  servico_id: string
}

interface Props {
  agendamento: Agendamento | null
  unidadeId: string
  profissionais: Profissional[]
  servicos: Servico[]
  clientes: Cliente[]
  horarioInicial: { data: Date; profissional_id?: string } | null
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

export default function AgendamentoModal({
  agendamento, unidadeId, profissionais, servicos, clientes,
  horarioInicial, onClose, onSalvo
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const dataInicio = agendamento
    ? new Date(agendamento.data_hora_inicio)
    : (horarioInicial?.data || new Date())

  const dataFim = agendamento
    ? new Date(agendamento.data_hora_fim)
    : addMinutes(dataInicio, 60)

  const [form, setForm] = useState({
    cliente_id: agendamento?.cliente_id || '',
    data: format(dataInicio, 'yyyy-MM-dd'),
    hora_inicio: format(dataInicio, 'HH:mm'),
    hora_fim: format(dataFim, 'HH:mm'),
    status: agendamento?.status || 'agendado',
    observacoes: agendamento?.observacoes || '',
  })

  const [itens, setItens] = useState<ItemAgendamento[]>(
    agendamento?.itens?.map(i => ({
      profissional_id: i.profissional_id,
      servico_id: i.servico_id,
    })) || [{
      profissional_id: horarioInicial?.profissional_id || (profissionais[0]?.id || ''),
      servico_id: servicos[0]?.id || '',
    }]
  )

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addItem() {
    setItens(prev => [...prev, { profissional_id: profissionais[0]?.id || '', servico_id: servicos[0]?.id || '' }])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function setItemField(idx: number, field: string, value: string) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSalvar() {
    if (!form.cliente_id) { setErro('Selecione o cliente.'); return }
    if (itens.length === 0) { setErro('Adicione pelo menos um serviço.'); return }
    if (itens.some(i => !i.profissional_id || !i.servico_id)) { setErro('Preencha profissional e serviço em todos os itens.'); return }

    setLoading(true); setErro('')

    // Verificar bloqueios de agenda antes de salvar
    const profIds = [...new Set(itens.map(i => i.profissional_id).filter(Boolean))]
    const { data: bloqueios } = await supabase
      .from('bloqueios_agenda')
      .select('*')
      .in('profissional_id', profIds)
      .eq('data', form.data)

    if (bloqueios && bloqueios.length > 0) {
      const apInicio = new Date(`${form.data}T${form.hora_inicio}:00`)
      const apFim = new Date(`${form.data}T${form.hora_fim}:00`)

      for (const b of bloqueios) {
        const prof = profissionais.find(p => p.id === b.profissional_id)
        const nome = prof?.nome || 'Profissional'

        if (!b.hora_inicio && !b.hora_fim) {
          setErro(`${nome} não está disponível neste dia.`)
          setLoading(false)
          return
        }

        const blqInicio = new Date(`${form.data}T${b.hora_inicio}:00`)
        const blqFim = new Date(`${form.data}T${b.hora_fim}:00`)
        if (apInicio < blqFim && apFim > blqInicio) {
          setErro(`${nome} não está disponível das ${b.hora_inicio} às ${b.hora_fim}.`)
          setLoading(false)
          return
        }
      }
    }

    const inicio = new Date(`${form.data}T${form.hora_inicio}:00`)
    const fim = new Date(`${form.data}T${form.hora_fim}:00`)

    if (agendamento) {
      const { error } = await supabase.from('agendamentos').update({
        cliente_id: form.cliente_id,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        status: form.status,
        observacoes: form.observacoes || null,
      }).eq('id', agendamento.id)

      if (error) { setErro(error.message); setLoading(false); return }

      await supabase.from('agendamento_itens').delete().eq('agendamento_id', agendamento.id)
      await supabase.from('agendamento_itens').insert(
        itens.map(i => ({ agendamento_id: agendamento.id, ...i }))
      )
    } else {
      const { data: novoAg, error } = await supabase.from('agendamentos').insert({
        cliente_id: form.cliente_id,
        unidade_id: unidadeId,
        data_hora_inicio: inicio.toISOString(),
        data_hora_fim: fim.toISOString(),
        status: form.status,
        observacoes: form.observacoes || null,
      }).select().single()

      if (error || !novoAg) { setErro(error?.message || 'Erro ao salvar'); setLoading(false); return }

      await supabase.from('agendamento_itens').insert(
        itens.map(i => ({ agendamento_id: novoAg.id, ...i }))
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{agendamento ? 'Editar agendamento' : 'Novo agendamento'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
            <select value={form.cliente_id} onChange={e => setField('cliente_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
              <option value="">Selecione o cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.telefone ? ` — ${c.telefone}` : ''}</option>)}
            </select>
          </div>

          {/* Data e horários */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={form.data} onChange={e => setField('data', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
              <input type="time" value={form.hora_inicio} onChange={e => setField('hora_inicio', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input type="time" value={form.hora_fim} onChange={e => setField('hora_fim', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Itens: profissional + serviço */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Serviços</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select value={item.profissional_id} onChange={e => setItemField(idx, 'profissional_id', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                      <option value="">Profissional</option>
                      {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <select value={item.servico_id} onChange={e => setItemField(idx, 'servico_id', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-600">
                      <option value="">Serviço</option>
                      {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                  {itens.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
