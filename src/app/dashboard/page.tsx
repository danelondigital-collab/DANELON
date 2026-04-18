export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, ClipboardList, Users, TrendingUp, Clock, CheckCircle2, Ban } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Agendamento } from '@/types'

const statusAgendamentoCor: Record<string, string> = {
  agendado: 'bg-blue-100 text-blue-700',
  confirmado: 'bg-green-100 text-green-700',
  em_atendimento: 'bg-amber-100 text-amber-700',
  concluido: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
  faltou: 'bg-red-100 text-red-600',
}

const statusAgendamentoLabel: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value

  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('perfil')
    .eq('id', user!.id)
    .single()
  const isAdmin = usuarioData?.perfil === 'admin'

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const inicioMesStr = inicioMes.toISOString().slice(0, 10)
  const fimMesStr = fimMes.toISOString().slice(0, 10)

  const [
    { count: agendamentosHoje },
    { count: comandasAbertas },
    { count: totalClientes },
    { data: rawAgendamentos },
    { data: faturamentoHoje },
    { data: rawBloqueiosMes },
  ] = await Promise.all([
    supabase.from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .gte('data_hora_inicio', hoje.toISOString())
      .lt('data_hora_inicio', amanha.toISOString())
      .not('status', 'in', '(cancelado,faltou)'),
    supabase.from('comandas')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .eq('status', 'aberta'),
    supabase.from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .eq('ativo', true),
    supabase.from('agendamentos')
      .select(`
        id, data_hora_inicio, data_hora_fim, status,
        cliente:clientes(id, nome),
        itens:agendamento_itens(
          id, profissional_id,
          profissional:profissionais(id, nome, cor_agenda),
          servico:servicos(id, nome, duracao_minutos)
        )
      `)
      .eq('unidade_id', unidadeId!)
      .gte('data_hora_inicio', hoje.toISOString())
      .lt('data_hora_inicio', amanha.toISOString())
      .not('status', 'in', '(cancelado,faltou)')
      .order('data_hora_inicio', { ascending: true })
      .limit(10),
    supabase.from('comandas')
      .select('valor_final')
      .eq('unidade_id', unidadeId!)
      .eq('status', 'fechada')
      .gte('data_fechamento', hoje.toISOString())
      .lt('data_fechamento', amanha.toISOString()),
    isAdmin
      ? supabase.from('bloqueios_agenda')
          .select('profissional_id, profissional:profissionais(id, nome, cor_agenda)')
          .eq('unidade_id', unidadeId!)
          .gte('data', inicioMesStr)
          .lt('data', fimMesStr)
      : Promise.resolve({ data: [] }),
  ])

  const agendamentos = (rawAgendamentos as unknown as Agendamento[]) || []
  const faturamentoTotal = (faturamentoHoje || []).reduce((s: number, c: { valor_final: number }) => s + (c.valor_final || 0), 0)

  type BloqueioRow = { profissional_id: string; profissional: { id: string; nome: string; cor_agenda: string } | null }
  const bloqueiosPorProf = ((rawBloqueiosMes || []) as unknown as BloqueioRow[]).reduce(
    (acc, b) => {
      if (!b.profissional) return acc
      const k = b.profissional_id
      if (!acc[k]) acc[k] = { nome: b.profissional.nome, cor: b.profissional.cor_agenda, total: 0 }
      acc[k].total++
      return acc
    },
    {} as Record<string, { nome: string; cor: string; total: number }>
  )
  const listaBloqueios = Object.values(bloqueiosPorProf).sort((a, b) => b.total - a.total)
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje)

  const cards = [
    {
      label: 'Agendamentos Hoje',
      value: agendamentosHoje ?? 0,
      icon: CalendarDays,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Comandas Abertas',
      value: comandasAbertas ?? 0,
      icon: ClipboardList,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Clientes Ativos',
      value: totalClientes ?? 0,
      icon: Users,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Faturamento Hoje',
      value: formatCurrency(faturamentoTotal),
      icon: TrendingUp,
      color: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs md:text-sm text-gray-500 leading-snug">{card.label}</p>
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Agendamentos de hoje</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {agendamentos.length} {agendamentos.length === 1 ? 'agendamento' : 'agendamentos'}
          </span>
        </div>

        {agendamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {agendamentos.map(ag => {
              const inicio = new Date(ag.data_hora_inicio)
              const fim = new Date(ag.data_hora_fim)
              const horaInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const horaFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              const statusClass = statusAgendamentoCor[ag.status] || 'bg-gray-100 text-gray-600'
              const statusLabel = statusAgendamentoLabel[ag.status] || ag.status

              return (
                <div key={ag.id} className="px-5 py-3.5 flex items-start gap-4">
                  {/* Hora */}
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                      <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      {horaInicio}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{horaFim}</p>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{ag.cliente?.nome || '—'}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {ag.itens && ag.itens.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {ag.itens.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
                            {item.profissional && (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-medium text-[10px] flex-shrink-0"
                                style={{ backgroundColor: item.profissional.cor_agenda }}
                              >
                                {item.profissional.nome.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span>{item.servico?.nome || '—'}</span>
                            {item.profissional && (
                              <span className="text-gray-400">· {item.profissional.nome}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-400" />
              <h2 className="font-semibold text-gray-900">Bloqueios de agenda este mês</h2>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full capitalize">{nomeMes}</span>
          </div>

          {listaBloqueios.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-gray-400">Nenhum bloqueio registrado este mês</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {listaBloqueios.map((item) => (
                <div key={item.nome} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: item.cor || '#6366f1' }}
                    >
                      {item.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-800">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-600">{item.total}</span>
                    <span className="text-xs text-gray-400">{item.total === 1 ? 'bloqueio' : 'bloqueios'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
