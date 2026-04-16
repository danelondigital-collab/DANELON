'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, startOfDay } from 'date-fns'
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
const SLOT_HEIGHT = 80 // px por hora na visão profissional

const statusCor: Record<string, string> = {
  agendado: 'bg-blue-100 border-blue-300 text-blue-800',
  confirmado: 'bg-green-100 border-green-300 text-green-800',
  em_atendimento: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  concluido: 'bg-gray-100 border-gray-300 text-gray-600',
  cancelado: 'bg-red-100 border-red-300 text-red-600',
  faltou: 'bg-orange-100 border-orange-300 text-orange-700',
}

function calcTop(dataHoraInicio: string): number {
  const d = parseISO(dataHoraInicio)
  return (d.getHours() - HORAS[0]) * SLOT_HEIGHT + (d.getMinutes() / 60) * SLOT_HEIGHT
}

function calcAltura(ag: Agendamento): number {
  if (ag.data_hora_fim) {
    const start = parseISO(ag.data_hora_inicio)
    const end = parseISO(ag.data_hora_fim)
    const mins = (end.getTime() - start.getTime()) / 60000
    return Math.max((mins / 60) * SLOT_HEIGHT, 32)
  }
  const dur = ag.itens?.[0]?.servico?.duracao_minutos || 60
  return Math.max((dur / 60) * SLOT_HEIGHT, 32)
}

export default function AgendaClient({ unidadeId, profissionais, servicos, clientes }: Props) {
  const supabase = createClient()
  const [semanaAtual, setSemanaAtual] = useState(() => new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null)
  const [horarioInicial, setHorarioInicial] = useState<{ data: Date; profissional_id?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [visualizacao, setVisualizacao] = useState<'semana' | 'dia' | 'profissional'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'dia' : 'semana'
  )
  const [diaAtual, setDiaAtual] = useState(() => new Date())

  const inicioSemana = startOfWeek(semanaAtual, { weekStartsOn: 1 })
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i))

  const fetchingRef = useRef(false)

  async function buscarAgendamentos(inicio: Date, dias = 7) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    const fim = addDays(inicio, dias)
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
    if (visualizacao === 'semana') {
      buscarAgendamentos(inicioSemana, 7)
    } else {
      buscarAgendamentos(startOfDay(diaAtual), 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaAtual, diaAtual, visualizacao, unidadeId])

  function navAnterior() {
    if (visualizacao === 'semana') {
      setSemanaAtual(s => subWeeks(s, 1))
      setDiaAtual(d => addDays(d, -7))
    } else {
      const novo = addDays(diaAtual, -1)
      setDiaAtual(novo)
      setSemanaAtual(startOfWeek(novo, { weekStartsOn: 1 }))
    }
  }

  function navProximo() {
    if (visualizacao === 'semana') {
      setSemanaAtual(s => addWeeks(s, 1))
      setDiaAtual(d => addDays(d, 7))
    } else {
      const novo = addDays(diaAtual, 1)
      setDiaAtual(novo)
      setSemanaAtual(startOfWeek(novo, { weekStartsOn: 1 }))
    }
  }

  function irParaHoje() {
    const hoje = new Date()
    setSemanaAtual(hoje)
    setDiaAtual(hoje)
  }

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
    if (visualizacao === 'semana') {
      buscarAgendamentos(inicioSemana, 7)
    } else {
      buscarAgendamentos(startOfDay(diaAtual), 1)
    }
  }

  const diasVisiveis = visualizacao === 'semana' ? diasSemana : [diaAtual]

  function getAgendamentosHora(dia: Date, hora: number) {
    return agendamentos.filter(ag => {
      const inicio = parseISO(ag.data_hora_inicio)
      return isSameDay(inicio, dia) && inicio.getHours() === hora
    })
  }

  function getAgendamentosProfDia(profId: string, dia: Date) {
    return agendamentos.filter(ag => {
      const inicio = parseISO(ag.data_hora_inicio)
      return isSameDay(inicio, dia) && ag.itens?.some(i => i.profissional_id === profId)
    })
  }

  const totalAltura = HORAS.length * SLOT_HEIGHT

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={navAnterior}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={irParaHoje}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Hoje
            </button>
            <button onClick={navProximo}
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
            <button onClick={() => setVisualizacao('profissional')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${visualizacao === 'profissional' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
              <span className="hidden sm:inline">Profissionais</span>
              <span className="sm:hidden">Profs</span>
            </button>
          </div>
          <button onClick={() => abrirNovo()}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo agendamento</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* Grade */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visualizacao === 'profissional' ? (
          /* ===== VISÃO POR PROFISSIONAL ===== */
          <div className="min-w-max">
            {/* Cabeçalho das profissionais */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-20 shadow-sm">
              <div className="w-16 flex-shrink-0" />
              {profissionais.map(prof => (
                <div key={prof.id} className="w-44 flex-shrink-0 text-center py-3 border-l border-gray-100">
                  <div
                    className="w-9 h-9 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: prof.cor_agenda || '#6366f1' }}
                  >
                    {prof.nome.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-xs font-semibold text-gray-800 truncate px-2">{prof.nome}</p>
                </div>
              ))}
            </div>

            {/* Corpo: horas + colunas das profissionais */}
            <div className="flex">
              {/* Coluna de horas */}
              <div className="w-16 flex-shrink-0 relative" style={{ height: totalAltura }}>
                {HORAS.map(hora => (
                  <div
                    key={hora}
                    className="absolute left-0 right-0 pr-3 flex items-start justify-end pt-1"
                    style={{ top: (hora - HORAS[0]) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    <span className="text-xs text-gray-400">{hora}:00</span>
                  </div>
                ))}
              </div>

              {/* Colunas das profissionais */}
              {profissionais.map(prof => {
                const agsProf = getAgendamentosProfDia(prof.id, diaAtual)
                return (
                  <div
                    key={prof.id}
                    className="w-44 flex-shrink-0 border-l border-gray-200 relative"
                    style={{ height: totalAltura }}
                  >
                    {/* Linhas de hora (clicáveis para novo agendamento) */}
                    {HORAS.map(hora => (
                      <div
                        key={hora}
                        className="absolute left-0 right-0 border-t border-gray-100 cursor-pointer hover:bg-amber-50/50 transition-colors"
                        style={{ top: (hora - HORAS[0]) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        onClick={() => {
                          const d = new Date(diaAtual)
                          d.setHours(hora, 0, 0, 0)
                          abrirNovo(d, prof.id)
                        }}
                      />
                    ))}

                    {/* Agendamentos posicionados */}
                    {agsProf.map(ag => {
                      const top = calcTop(ag.data_hora_inicio)
                      const height = calcAltura(ag)
                      const servNome =
                        ag.itens?.find(i => i.profissional_id === prof.id)?.servico?.nome ||
                        ag.itens?.[0]?.servico?.nome ||
                        'Serviço'
                      const statusClass = statusCor[ag.status] || statusCor.agendado
                      return (
                        <div
                          key={ag.id}
                          onClick={e => { e.stopPropagation(); abrirEdicao(ag) }}
                          className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 border-l-[3px] cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${statusClass}`}
                          style={{
                            top: top + 1,
                            height: height - 2,
                            borderLeftColor: prof.cor_agenda || '#6366f1',
                          }}
                        >
                          <p className="text-xs font-semibold truncate leading-tight">{ag.cliente?.nome || 'Cliente'}</p>
                          <p className="text-xs truncate opacity-75 leading-tight">{servNome}</p>
                          {height >= 52 && (
                            <p className="text-xs opacity-60 leading-tight mt-0.5">
                              {format(parseISO(ag.data_hora_inicio), 'HH:mm')}
                              {ag.data_hora_fim && ` – ${format(parseISO(ag.data_hora_fim), 'HH:mm')}`}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ===== VISÃO SEMANA / DIA ===== */
          <div className={visualizacao === 'semana' ? 'min-w-[640px]' : 'min-w-[320px]'}>
            {/* Cabeçalho dos dias */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
              <div className="w-14 flex-shrink-0" />
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

            {/* Corpo com posicionamento absoluto */}
            <div className="flex">
              {/* Coluna de horas */}
              <div className="w-14 flex-shrink-0 relative" style={{ height: totalAltura }}>
                {HORAS.map(hora => (
                  <div
                    key={hora}
                    className="absolute left-0 right-0 pr-2 flex items-start justify-end pt-1 border-t border-gray-100"
                    style={{ top: (hora - HORAS[0]) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                  >
                    <span className="text-xs text-gray-400">{hora}:00</span>
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              {diasVisiveis.map(dia => {
                const agsNoDia = agendamentos.filter(ag =>
                  isSameDay(parseISO(ag.data_hora_inicio), dia)
                )
                return (
                  <div
                    key={dia.toISOString()}
                    className={`flex-1 border-l border-gray-200 relative min-w-0 overflow-hidden ${
                      isSameDay(dia, new Date()) ? 'bg-amber-50/20' : ''
                    }`}
                    style={{ height: totalAltura }}
                  >
                    {/* Linhas de hora clicáveis */}
                    {HORAS.map(hora => (
                      <div
                        key={hora}
                        className="absolute left-0 right-0 border-t border-gray-100 cursor-pointer hover:bg-gray-50/60 transition-colors"
                        style={{ top: (hora - HORAS[0]) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        onClick={() => {
                          const data = new Date(dia)
                          data.setHours(hora, 0, 0, 0)
                          abrirNovo(data)
                        }}
                      />
                    ))}

                    {/* Agendamentos posicionados */}
                    {agsNoDia.map(ag => {
                      const top = calcTop(ag.data_hora_inicio)
                      const height = calcAltura(ag)
                      const profs = ag.itens?.map(i => i.profissional).filter(Boolean) || []
                      const cor = profs[0]?.cor_agenda || '#6366f1'
                      const servNome = ag.itens?.[0]?.servico?.nome || 'Serviço'
                      const statusClass = statusCor[ag.status] || statusCor.agendado
                      return (
                        <div
                          key={ag.id}
                          onClick={e => { e.stopPropagation(); abrirEdicao(ag) }}
                          className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 border-l-[3px] cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${statusClass}`}
                          style={{
                            top: top + 1,
                            height: height - 2,
                            borderLeftColor: cor,
                          }}
                        >
                          <p className="text-xs font-semibold truncate leading-tight">{ag.cliente?.nome || 'Cliente'}</p>
                          <p className="text-xs truncate opacity-75 leading-tight">{servNome}</p>
                          {height >= 52 && (
                            <p className="text-xs opacity-60 leading-tight mt-0.5">
                              {format(parseISO(ag.data_hora_inicio), 'HH:mm')}
                              {ag.data_hora_fim && ` – ${format(parseISO(ag.data_hora_fim), 'HH:mm')}`}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {agendamentos.length === 0 && !loading && visualizacao !== 'profissional' && (
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
