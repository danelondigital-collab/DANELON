'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Globe, Loader2, RefreshCw, MousePointerClick, Users, Eye, Activity, UserPlus } from 'lucide-react'

const GOLD = '#B8924A'
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')

interface Totals {
  pageViews: number
  activeUsers: number
  engagementRate: number
  sessions: number
  buttonClicks: number
}

interface TrafegoData {
  updatedAt: string
  range: { startDate: string; endDate: string }
  totals: Totals
  timeseries: { date: string; activeUsers: number }[]
  events: { name: string; count: number }[]
  topPages: { path: string; views: number }[]
  trafficSource: { source: string; sessions: number }[]
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}

function fmtPct(n: number) {
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function Sparkline({ points }: { points: { date: string; activeUsers: number }[] }) {
  if (points.length === 0) return null
  const max = Math.max(...points.map(p => p.activeUsers), 1)
  const w = 100
  const h = 32
  const step = w / Math.max(points.length - 1, 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(h - (p.activeUsers / max) * h).toFixed(2)}`)
    .join(' ')
  const area = `${path} L ${w} ${h} L 0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-20">
      <path d={area} fill={GOLD} opacity={0.12} />
      <path d={path} fill="none" stroke={GOLD} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-amber-200' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className="text-2xl font-bold" style={accent ? { color: GOLD } : undefined}>
        {value}
      </p>
    </div>
  )
}

export default function TrafegoClient() {
  const [range, setRange] = useState(() => ({
    start: fmtDate(subDays(new Date(), 28)),
    end: fmtDate(subDays(new Date(), 1)),
  }))
  const [data, setData] = useState<TrafegoData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [kommoLeads, setKommoLeads] = useState<{ count: number; capped: boolean } | null>(null)
  const [kommoError, setKommoError] = useState<string | null>(null)
  const [kommoLoading, setKommoLoading] = useState(true)

  const carregar = useCallback(async (r: { start: string; end: string }) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/trafego?start=${r.start}&end=${r.end}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setData(await res.json())
      setError(null)
    } catch {
      setError('Não foi possível carregar os dados do Google Analytics agora.')
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarKommo = useCallback(async (r: { start: string; end: string }) => {
    setKommoLoading(true)
    try {
      const res = await fetch(`/api/kommo/leads?start=${r.start}&end=${r.end}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        // TODO: remover exibição de "detail"/"envCheck" depois de diagnosticar o problema em produção
        throw new Error(`${json.error || 'Erro'} · ${json.detail || ''} · env=${JSON.stringify(json.envCheck)}`)
      }
      setKommoLeads(json)
      setKommoError(null)
    } catch (e) {
      setKommoError(e instanceof Error ? e.message : 'Não foi possível carregar os leads do Kommo agora.')
    } finally {
      setKommoLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar(range)
    carregarKommo(range)
    const id = setInterval(() => { carregar(range); carregarKommo(range) }, 5 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  const periodoFormatado = useMemo(() => {
    try {
      return `${format(new Date(range.start + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(range.end + 'T12:00:00'), 'dd/MM/yyyy')}`
    } catch {
      return ''
    }
  }, [range])

  function preset(start: Date, end: Date) {
    setRange({ start: fmtDate(start), end: fmtDate(end) })
  }

  const botoes = data?.events.filter(e => e.name.startsWith('Botão')) || []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-5 h-5 text-violet-600" /> Tráfego do Site
          </h1>
          <p className="text-sm text-slate-500">Visitas, cliques em botões e origem de tráfego de elainedanelon.com.br.</p>
        </div>
        <button
          onClick={() => { carregar(range); carregarKommo(range) }}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg border border-gray-200 bg-white"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar
        </button>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">De:</label>
            <input
              type="date"
              value={range.start}
              max={range.end}
              onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Até:</label>
            <input
              type="date"
              value={range.end}
              min={range.start}
              max={fmtDate(new Date())}
              onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => preset(subDays(new Date(), 7), subDays(new Date(), 1))}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Últimos 7 dias
            </button>
            <button onClick={() => preset(subDays(new Date(), 28), subDays(new Date(), 1))}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Últimos 28 dias
            </button>
            <button onClick={() => preset(startOfMonth(new Date()), new Date())}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Este mês
            </button>
            <button onClick={() => preset(startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1)))}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
              Mês passado
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Período: {periodoFormatado}</p>
      </div>

      {/* CRM Kommo */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">CRM Kommo</p>
        {kommoError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{kommoError}</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-violet-200 p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Novos leads no período
              </p>
              <p className="text-2xl font-bold text-violet-600">
                {kommoLoading && !kommoLeads ? <Loader2 className="w-5 h-5 animate-spin text-violet-300" /> : fmt(kommoLeads?.count || 0)}
                {kommoLeads?.capped && <span className="text-xs font-normal text-gray-400">+</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{error}</div>
      )}

      {!data && loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do Analytics…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard icon={Eye} label="Visualizações" value={fmt(data.totals.pageViews)} />
            <KpiCard icon={Users} label="Usuários ativos" value={fmt(data.totals.activeUsers)} />
            <KpiCard icon={Activity} label="Sessões" value={fmt(data.totals.sessions)} />
            <KpiCard icon={Activity} label="Taxa de engajamento" value={fmtPct(data.totals.engagementRate)} />
            <KpiCard icon={MousePointerClick} label="Cliques em botões" value={fmt(data.totals.buttonClicks)} accent />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-2">Usuários ativos por dia</p>
            <Sparkline points={data.timeseries} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" /> Cliques por botão
              </p>
              <ul className="space-y-2">
                {botoes.length === 0 && <li className="text-sm text-gray-400">Nenhum clique registrado no período.</li>}
                {botoes.map(b => (
                  <li key={b.name} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">{b.name.replace('Botão_', '').replace(/_/g, ' ')}</span>
                    <span className="font-semibold" style={{ color: GOLD }}>{fmt(b.count)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-3">Páginas mais vistas</p>
              <ul className="space-y-2">
                {data.topPages.map(p => (
                  <li key={p.path} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">{p.path}</span>
                    <span className="font-semibold text-gray-900">{fmt(p.views)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-3">Origem do tráfego</p>
              <ul className="space-y-2">
                {data.trafficSource.map(s => (
                  <li key={s.source} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">{s.source}</span>
                    <span className="font-semibold text-gray-900">{fmt(s.sessions)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-right">
            Atualizado em {new Date(data.updatedAt).toLocaleString('pt-BR')} · atualiza sozinho a cada 5 min
          </p>
        </>
      )}
    </div>
  )
}
