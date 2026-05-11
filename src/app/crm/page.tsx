import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { BarChart3, Users, TrendingUp, AlertCircle, DollarSign, Calendar } from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default async function CrmPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    { count: totalClientes },
    { count: clientesNovos },
    { data: comandasMes },
    { count: comandasAbertas },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!).eq('ativo', true),
    supabase.from('clientes').select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!).gte('created_at', inicioMes),
    supabase.from('comandas').select('valor_final')
      .eq('unidade_id', unidadeId!).eq('status', 'fechada')
      .gte('data_fechamento', inicioMes).lte('data_fechamento', fimMes),
    supabase.from('comandas').select('*', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId!).eq('status', 'aberta'),
  ])

  const faturamentoMes = (comandasMes || []).reduce((s, c) => s + (c.valor_final || 0), 0)
  const ticketMedio = comandasMes?.length ? faturamentoMes / comandasMes.length : 0

  function formatCurrency(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500 text-sm mt-1">
          {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          title="Faturamento do mês"
          value={formatCurrency(faturamentoMes)}
          sub={`${comandasMes?.length || 0} comandas fechadas`}
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Ticket médio"
          value={formatCurrency(ticketMedio)}
          sub="por comanda no mês"
          icon={TrendingUp}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Clientes ativos"
          value={totalClientes?.toString() || '0'}
          sub={`+${clientesNovos || 0} novos este mês`}
          icon={Users}
          color="bg-violet-100 text-violet-600"
        />
        <StatCard
          title="Comandas abertas"
          value={comandasAbertas?.toString() || '0'}
          sub="aguardando fechamento"
          icon={AlertCircle}
          color="bg-orange-100 text-orange-600"
        />
        <StatCard
          title="Comandas no mês"
          value={comandasMes?.length?.toString() || '0'}
          sub="fechadas este mês"
          icon={BarChart3}
          color="bg-amber-100 text-amber-600"
        />
        <StatCard
          title="Agenda"
          value="—"
          sub="em breve"
          icon={Calendar}
          color="bg-slate-100 text-slate-400"
        />
      </div>
    </div>
  )
}
