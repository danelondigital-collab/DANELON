'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { Profissional, Servico, Cliente, Agendamento, BloqueioAgenda } from '@/types'
import AgendamentoModal from './agendamento-modal'

interface Props {
  unidadeId: string
  profissionais: Profissional[]
  servicos: Servico[]
  clientes: Cliente[]
}

const HORAS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h às 19h
const SLOT_HEIGHT = 80 // px por hora

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

function calcTopFromTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - HORAS[0]) * SLOT_HEIGHT + (m / 60) * SLOT_HEIGHT
}

function calcAlturaFromTimes(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
  return Math.max((mins / 60) * SLOT_HEIGHT, 20)
}

export default function AgendaClient({ unidadeId, profissionais, servicos, clientes }: Props) {
  const supabase = createClient()
  const [semanaAtual, setSemanaAtual] = useState(() => new Date())
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])
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

  const [erroSlot, setErroSlot] = useState('')

  const fetchingRef = useRef(false)
  const dragRef = useRef<{ agId: string; offsetY: number } | null>(null)
  const wasDraggingRef = useRef(false)

  async function buscarAgendamentos(inicio: Date, dias = 7) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)

    const fim = addDays(inicio, dias)
    const [{ data: ags }, { data: blqs }] = await Promise.all([
      supabase
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
        .order('data_hora_inicio'),
      supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('unidade_id', unidadeId)
        .gte('data', format(inicio, 'yyyy-MM-dd'))
        .lte('data', format(fim, 'yyyy-MM-dd')),
    ])

    setAgendamentos((ags as unknown as Agendamento[]) || [])
    setBloqueios((blqs as BloqueioAgenda[]) || [])
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
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return }
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

  function getBloqueiosDia(profId: string, dia: Date): BloqueioAgenda[] {
    return bloqueios.filter(b => b.profissional_id === profId && b.data === format(dia, 'yyyy-MM-dd'))
  }

  function isProfDiaTodoBloqueado(profId: string, dia: Date): boolean {
    return getBloqueiosDia(profId, dia).some(b => !b.hora_inicio && !b.hora_fim)
  }

  function isProfHorarioBloqueado(profId: string, dia: Date, hora: number): boolean {
    return getBloqueiosDia(profId, dia).some(b => {
      if (!b.hora_inicio || !b.hora_fim) return false
      const [h1] = b.hora_inicio.split(':').map(Number)
      const [h2, m2] = b.hora_fim.split(':').map(Number)
      const fimMin = h2 * 60 + m2
      return hora >= h1 && hora * 60 < fimMin
    })
  }

  function mostrarErroSlot(msg: string) {
    setErroSlot(msg)
    setTimeout(() => setErroSlot(''), 3500)
  }

  // ===== DRAG AND DROP =====

  function handleDragStart(e: React.DragEvent, ag: Agendamento) {
    dragRef.current = { agId: ag.id, offsetY: e.nativeEvent.offsetY }
    wasDraggingRef.current = false
    e.dataTransfer.effectAllowed = 'move'
  }

  async function moverAgendamento(agId: string, novaDia: Date, hora: number, dropOffsetY: number) {
    if (!dragRef.current) return
    wasDraggingRef.current = true
    const { offsetY } = dragRef.current
    dragRef.current = null

    const effectiveY = (hora - HORAS[0]) * SLOT_HEIGHT + Math.max(0, dropOffsetY - offsetY)
    const totalMinutes = Math.round(((effectiveY / SLOT_HEIGHT) * 60) / 15) * 15
    const clampedMinutes = Math.max(0, Math.min(totalMinutes, (HORAS.length - 1) * 60 + 45))
    const newHour = HORAS[0] + Math.floor(clampedMinutes / 60)
    const newMinute = clampedMinutes % 60

    const ag = agendamentos.find(a => a.id === agId)
    if (!ag) return

    const newStart = new Date(novaDia)
    newStart.setHours(newHour, newMinute, 0, 0)

    const duracao = ag.data_hora_fim
      ? parseISO(ag.data_hora_fim).getTime() - parseISO(ag.data_hora_inicio).getTime()
      : (ag.itens?.[0]?.servico?.duracao_minutos || 60) * 60000
    const newEnd = new Date(newStart.getTime() + duracao)
    const dataStr = format(novaDia, 'yyyy-MM-dd')

    // Validar bloqueios antes de mover
    const profIds = [...new Set((ag.itens || []).map(i => i.profissional_id).filter(Boolean))]
    if (profIds.length > 0) {
      const { data: blqs } = await supabase
        .from('bloqueios_agenda')
        .select('*, profissional:profissionais(nome)')
        .in('profissional_id', profIds)
        .eq('data', dataStr)

      if (blqs && blqs.length > 0) {
        for (const b of blqs) {
          const nomePro = (b.profissional as { nome?: string })?.nome || 'Profissional'
          const dataFmt = format(novaDia, "dd/MM/yyyy", { locale: ptBR })

          if (!b.hora_inicio && !b.hora_fim) {
            mostrarErroSlot(`${nomePro} não está disponível em ${dataFmt} (dia inteiro bloqueado).`)
            return
          }
          const blqInicio = new Date(`${dataStr}T${b.hora_inicio}`)
          const blqFim = new Date(`${dataStr}T${b.hora_fim}`)
          if (newStart < blqFim && newEnd > blqInicio) {
            const hIni = b.hora_inicio.slice(0, 5)
            const hFim = b.hora_fim.slice(0, 5)
            mostrarErroSlot(`${nomePro} não está disponível em ${dataFmt} das ${hIni} às ${hFim}.`)
            return
          }
        }
      }
    }

    const updates: Record<string, string> = { data_hora_inicio: newStart.toISOString() }
    if (ag.data_hora_fim) {
      updates.data_hora_fim = newEnd.toISOString()
    }

    await supabase.from('agendamentos').update(updates).eq('id', agId)
    onSalvo()
  }

  function handleDropProf(e: React.DragEvent, hora: number, profId: string) {
    e.preventDefault()
    if (!dragRef.current) return
    if (isProfDiaTodoBloqueado(profId, diaAtual)) return
    const agId = dragRef.current.agId
    moverAgendamento(agId, diaAtual, hora, e.nativeEvent.offsetY)
  }

  function handleDropDia(e: React.DragEvent, dia: Date, hora: number) {
    e.preventDefault()
    if (!dragRef.current) return
    const agId = dragRef.current.agId
    moverAgendamento(agId, dia, hora, e.nativeEvent.offsetY)
  }

  const diasVisiveis = visualizacao === 'semana' ? diasSemana : [diaAtual]
  const totalAltura = HORAS.length * SLOT_HEIGHT

  function getAgendamentosProfDia(profId: string, dia: Date) {
    return agendamentos.filter(ag => {
      const inicio = parseISO(ag.data_hora_inicio)
      return isSameDay(inicio, dia) && ag.itens?.some(i => i.profissional_id === profId)
    })
  }

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

      {/* Toast de erro de slot bloqueado */}
      {erroSlot && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
          <span className="text-sm text-red-700">{erroSlot}</span>
        </div>
      )}

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
              {profissionais.map(prof => {
                const bloqueadaHoje = isProfDiaTodoBloqueado(prof.id, diaAtual)
                return (
                  <div key={prof.id} className={`w-44 flex-shrink-0 text-center py-3 border-l border-gray-100 ${bloqueadaHoje ? 'opacity-40' : ''}`}>
                    <div
                      className="w-9 h-9 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: bloqueadaHoje ? '#9ca3af' : (prof.cor_agenda || '#6366f1') }}
                    >
                      {prof.nome.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 truncate px-2">{prof.nome}</p>
                    {bloqueadaHoje && <p className="text-xs text-gray-400">Indisponível</p>}
                  </div>
                )
              })}
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
                const bloqueadaHoje = isProfDiaTodoBloqueado(prof.id, diaAtual)
                const bloqueiosParciais = getBloqueiosDia(prof.id, diaAtual).filter(b => b.hora_inicio && b.hora_fim)

                return (
                  <div
                    key={prof.id}
                    className={`w-44 flex-shrink-0 border-l border-gray-200 relative ${bloqueadaHoje ? 'bg-gray-100' : ''}`}
                    style={{ height: totalAltura }}
                  >
                    {/* Linhas de hora */}
                    {HORAS.map(hora => (
                      <div
                        key={hora}
                        className={`absolute left-0 right-0 border-t border-gray-100 transition-colors ${
                          bloqueadaHoje ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-amber-50/50'
                        }`}
                        style={{ top: (hora - HORAS[0]) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        onClick={bloqueadaHoje ? undefined : () => {
                          if (isProfHorarioBloqueado(prof.id, diaAtual, hora)) {
                            mostrarErroSlot(`${prof.nome} não está disponível neste horário.`)
                            return
                          }
                          const d = new Date(diaAtual)
                          d.setHours(hora, 0, 0, 0)
                          abrirNovo(d, prof.id)
                        }}
                        onDragOver={bloqueadaHoje ? undefined : (e) => e.preventDefault()}
                        onDrop={bloqueadaHoje ? undefined : (e) => handleDropProf(e, hora, prof.id)}
                      />
                    ))}

                    {/* Bloqueios de horário parcial */}
                    {bloqueiosParciais.map(b => (
                      <div
                        key={b.id}
                        className="absolute left-0 right-0 z-[5] bg-gray-300/60 border-l-2 border-gray-400 flex flex-col justify-center px-2 pointer-events-none"
                        style={{
                          top: calcTopFromTime(b.hora_inicio!),
                          height: calcAlturaFromTimes(b.hora_inicio!, b.hora_fim!),
                        }}
                      >
                        <span className="text-xs text-gray-600 font-medium truncate">Bloqueio de Agenda</span>
                        {b.motivo && <span className="text-xs text-gray-400 truncate">{b.motivo}</span>}
                      </div>
                    ))}

                    {/* Overlay dia inteiro bloqueado */}
                    {bloqueadaHoje && (
                      <div className="absolute inset-0 z-[6] flex items-center justify-center pointer-events-none">
                        <p className="text-xs text-gray-400 font-medium rotate-[-90deg] whitespace-nowrap tracking-wide uppercase">
                          Indisponível
                        </p>
                      </div>
                    )}

                    {/* Agendamentos */}
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
                          draggable
                          onDragStart={(e) => handleDragStart(e, ag)}
                          onClick={(e) => { e.stopPropagation(); abrirEdicao(ag) }}
                          className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 border-l-[3px] cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity overflow-hidden select-none ${statusClass}`}
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
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropDia(e, dia, hora)}
                      />
                    ))}

                    {/* Agendamentos */}
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
                          draggable
                          onDragStart={(e) => handleDragStart(e, ag)}
                          onClick={(e) => { e.stopPropagation(); abrirEdicao(ag) }}
                          className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 border-l-[3px] cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity overflow-hidden select-none ${statusClass}`}
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
