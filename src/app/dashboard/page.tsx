import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, ClipboardList, Users, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  const [
    { count: agendamentosHoje },
    { count: comandasAbertas },
    { count: totalClientes },
  ] = await Promise.all([
    supabase.from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .gte('data_hora_inicio', hoje.toISOString())
      .lt('data_hora_inicio', amanha.toISOString()),
    supabase.from('comandas')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .eq('status', 'aberta'),
    supabase.from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!)
      .eq('ativo', true),
  ])

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
      value: 'R$ 0,00',
      icon: TrendingUp,
      color: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{card.label}</p>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-900 mb-4">Próximos agendamentos</h2>
        <p className="text-sm text-gray-400 text-center py-8">
          Nenhum agendamento para hoje
        </p>
      </div>
    </div>
  )
}
