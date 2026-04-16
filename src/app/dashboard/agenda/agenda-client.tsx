'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, Servico, Cliente, Agendamento } from '@/types'
import AgendamentoModal from './agendamento-modal'

interface Props {
  unidadeId: string
  profissionais: Profissional[]
  servicos: Servico[]
  clientes: Cliente[]
}

const HORAS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h às 19h

const statusCor: Record<string, string> = {
  agendado: 'bg-blue-100 border-blue-300 text-blue-800',
  confirmado: 'bg-green-100 border-green-300 text-green-800',
  em_atendimento: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  concluido: 'bg-gray-100 border-gray-300 text-gray-600',
  cancelado: 'bg-red-100 border-red-300 text-red-600',
  faltou: 'bg-orange-100 border-orange-300 text-orange-700',
}

export default function AgendaClient({ unidadeId, profissionais, servicos, clientes }: Props) {
  const supabase = createClient()
  const [semanaAtual, setSemanaAtual] = useState(() => new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null)
  const [horarioInicial, setHorarioInicial] = useState<{ data: Date; profissional_id?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [visualizacao, setVisualizacao] = useState<'semana' | 'dia'>('semana')
  const [diaAtual, setDiaAtual] = useState(() => new Date())

  const inicioSemana = startOfWeek(semanaAtual, { weekStartsOn: 1 })
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i))

  // Ref para evitar múltiplas chamadas simultâneas
  const fetchingRef = useRef(false)

  async function buscarAgendamentos(inicio: Date) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    const fim = addDays(inicio, 7)
    const { data } = await supabase
      .from('agendamentos')
      .select(`
        *,
        cliente:clientes(id, nome, telefone),
        itens:agendamento_itens(
          id, profissional_id, servico_id,
          profissional:profissionais(id, nome, cor_agenda),
          servico:servicos(id, nome, duracao_minutos)
        )
      `)
      .eq('unidade_id', unidadeId)
      .gte('data_hora_inicio', inicio.toISOString())
      .lt('data_hora_inicio', fim.toISOString())
      .order('data_hora_inicio')

    setAgendamentos((data as unknown as Agendamento[]) || [])
    setLoading(false)
    fetchingRef.current = false
  }

  useEffect(() => {
    buscarAgendamentos(inicioSemana)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaAtual, unidadeId])

  function abrirNovo(data?: Date, profissional_id?: string) {
    setSelecionado(null)
    setHorarioInicial(data ? { data, profissional_id } : null)
    setModalAberto(true)
  }

  function abrirEdicao(ag: Agendamento) {
    setSelecionado(ag)
    setHorarioInicial(null)
    setModalAberto(true)
  }

  function onSalvo() {
    setModalAberto(false)
    buscarAgendamentos(inicioSemana)
  }

  const diasVisiveis = visualizacao === 'semana' ? diasSemana : [diaAtual]

  function getAgendamentosHora(dia: Date, hora: number) {
    return agendamentos.filter(ag => {
      const inicio = parseISO(ag.data_hora_inicio)
      return isSameDay(inicio, dia) && inicio.getHours() === hora
    })
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => { setSemanaAtual(s => subWeeks(s, 1)); setDiaAtual(d => addDays(d, -7)) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => { setSemanaAtual(new Date()); setDiaAtual(new Date()) }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Hoje
            </button>
            <button onClick={() => { setSemanaAtual(s => addWeeks(s, 1)); setDiaAtual(d => addDays(d, 7)) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h2 className="font-semibold text-gray-900 text-sm">
            {visualizacao === 'semana'
              ? `${format(inicioSemana, "d 'de' MMM", { locale: ptBR })} – ${format(addDays(inicioSemana, 6), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
              : format(diaAtual, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setVisualizacao('semana')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${visualizacao === 'semana' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
              Semana
            </button>
            <button onClick={() => setVisualizacao('dia')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${visualizacao === 'dia' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
              Dia
            </button>
          </div>
          <button onClick={() => abrirNovo()}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Novo agendamento
          </button>
        </div>
      </div>

      {/* Grade */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="min-w-[700px]">
            {/* Cabeçalho dos dias */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
              <div className="w-16 flex-shrink-0" />
              {diasVisiveis.map(dia => (
                <div key={dia.toISOString()}
                  className={`flex-1 text-center py-3 border-l border-gray-100 ${isSameDay(dia, new Date()) ? 'bg-amber-50' : ''}`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{format(dia, 'EEE', { locale: ptBR })}</p>
                  <button
                    onClick={() => { setDiaAtual(dia); setVisualizacao('dia') }}
                    className={`mt-1 w-8 h-8 rounded-full text-sm font-semibold mx-auto flex items-center justify-center transition-colors ${
                      isSameDay(dia, new Date())
                        ? 'bg-amber-700 text-white'
                        : 'text-gray-900 hover:bg-gray-100'
                    }`}>
                    {format(dia, 'd')}
                  </button>
                </div>
              ))}
            </div>

            {/* Linhas de hora */}
            {HORAS.map(hora => (
              <div key={hora} className="flex border-b border-gray-100" style={{ minHeight: 64 }}>
                <div className="w-16 flex-shrink-0 px-2 pt-2 text-right pr-3">
                  <span className="text-xs text-gray-400">{hora}:00</span>
                </div>
                {diasVisiveis.map(dia => {
                  const ags = getAgendamentosHora(dia, hora)
                  return (
                    <div key={dia.toISOString()}
                      onClick={() => {
                        const data = new Date(dia)
                        data.setHours(hora, 0, 0, 0)
                        abrirNovo(data)
                      }}
                      className={`flex-1 border-l border-gray-100 p-1 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSameDay(dia, new Date()) ? 'bg-amber-50/30' : ''
                      }`}>
                      {ags.map(ag => {
                        const profs = ag.itens?.map(i => i.profissional).filter(Boolean) || []
                        const cor = profs[0]?.cor_agenda || '#6366f1'
                        const servNome = ag.itens?.[0]?.servico?.nome || 'Serviço'
                        return (
                          <div key={ag.id}
                            onClick={e => { e.stopPropagation(); abrirEdicao(ag) }}
                            className={`text-xs rounded px-2 py-1 mb-1 border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${statusCor[ag.status] || statusCor.agendado}`}
                            style={{ borderLeftColor: cor }}>
                            <p className="font-semibold truncate">{ag.cliente?.nome || 'Cliente'}</p>
                            <p className="truncate opacity-75">{servNome}</p>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {agendamentos.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Calendar className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">Nenhum agendamento nesta semana</p>
            <button onClick={() => abrirNovo()} className="mt-3 text-sm text-amber-700 hover:underline">
              Criar agendamento
            </button>
          </div>
        )}
      </div>

      {modalAberto && (
        <AgendamentoModal
          agendamento={selecionado}
          unidadeId={unidadeId}
          profissionais={profissionais}
          servicos={servicos}
          clientes={clientes}
          horarioInicial={horarioInicial}
          onClose={() => setModalAberto(false)}
          onSalvo={onSalvo}
        />
      )}
    </div>
  )
}
