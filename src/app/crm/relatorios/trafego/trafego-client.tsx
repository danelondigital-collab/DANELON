'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Globe, Loader2, RefreshCw, MousePointerClick, Users, Eye, Activity, UserPlus, Contact, HelpCircle } from 'lucide-react'

const GOLD = '#B8924A'
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')

interface Totals {
  pageViews: number
  activeUsers: number
  engagementRate: number
  sessions: number
  buttonClicks: number
}

interface HomeAccess {
  pageViews: number
  sessions: number
  activeUsers: number
}

interface TrafegoData {
  updatedAt: string
  range: { startDate: string; endDate: string }
  totals: Totals
  homeAccess: HomeAccess
  timeseries: { date: string; activeUsers: number }[]
  events: { name: string; count: number }[]
  trafficSource: { source: string; sessions: number }[]
  campaignBreakdown: { campaign: string; sessions: number }[]
}

/** Tenta ler o corpo como JSON; se vier algo diferente (ex: página de erro/timeout da Vercel), dá uma mensagem legível em vez do erro cru de parsing. */
async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    throw new Error('O servidor demorou demais ou devolveu uma resposta inesperada — tente um período menor ou tente de novo.')
  }
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}

function fmtPct(n: number) {
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

const ORIGEM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  'tiktok.com': 'TikTok',
  google: 'Google',
  ig: 'Instagram',
  instagram: 'Instagram',
  'l.instagram.com': 'Instagram',
  facebook: 'Facebook',
  fb: 'Facebook',
  'm.facebook.com': 'Facebook',
}

const MEIO_LABELS: Record<string, string> = {
  paid: 'anúncio pago',
  cpc: 'anúncio pago',
  ppc: 'anúncio pago',
  paidsocial: 'anúncio pago',
  social: 'link na bio/post (não pago)',
  referral: 'clique vindo de outro site',
  organic: 'busca no Google (não pago)',
}

/** Traduz o "origem / meio" cru do GA4 (ex: "tiktok / paid") pra algo que a cliente entenda. */
function fmtOrigem(raw: string): string {
  if (raw === '(not set)') return 'Não identificado pelo Google'
  if (raw === '(data not available)') return 'Indisponível (bloqueado por privacidade do navegador)'
  if (raw.startsWith('(direct)')) return 'Acesso direto (digitou o site ou já tinha salvo)'

  const [origemRaw, meioRaw] = raw.split(' / ').map(s => s?.trim())
  const origem = ORIGEM_LABELS[(origemRaw || '').toLowerCase()] || origemRaw
  const meio = meioRaw ? MEIO_LABELS[meioRaw.toLowerCase()] : undefined

  return meio ? `${origem} — ${meio}` : origem
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

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
      <span className="pointer-events-none absolute z-20 hidden group-hover/tip:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-gray-800 text-white text-xs leading-relaxed p-2.5 shadow-lg normal-case font-normal">
        {text}
      </span>
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, accent, tooltip }: { icon: React.ElementType; label: string; value: string; accent?: boolean; tooltip?: string }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-amber-200' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
        {tooltip && <InfoTooltip text={tooltip} />}
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
  const [kommoContacts, setKommoContacts] = useState<{ count: number; capped: boolean } | null>(null)
  const [kommoError, setKommoError] = useState<string | null>(null)
  const [kommoLoading, setKommoLoading] = useState(true)

  const [canaisRange, setCanaisRange] = useState(() => ({
    start: fmtDate(new Date()),
    end: fmtDate(new Date()),
  }))
  const [canais, setCanais] = useState<{ matrix: Record<string, Record<string, number>>; channels: string[]; unidades: string[]; sampled: number; capped: boolean; novos: number | null; existentes: number | null } | null>(null)
  const [canaisError, setCanaisError] = useState<string | null>(null)
  const [canaisLoading, setCanaisLoading] = useState(true)

  // Contadores de requisição: como algumas buscas (principalmente a de canais) podem
  // demorar segundos, uma resposta antiga pode voltar depois de uma mais nova. Cada
  // fetch guarda o número da sua própria "rodada" e só aplica o resultado se ainda
  // for a rodada mais recente — evita que dados velhos sobrescrevam os atuais.
  const dataReqId = useRef(0)
  const kommoReqId = useRef(0)
  const canaisReqId = useRef(0)

  const carregar = useCallback(async (r: { start: string; end: string }) => {
    const reqId = ++dataReqId.current
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/trafego?start=${r.start}&end=${r.end}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (reqId !== dataReqId.current) return
      setData(json)
      setError(null)
    } catch {
      if (reqId !== dataReqId.current) return
      setError('Não foi possível carregar os dados do Google Analytics agora.')
    } finally {
      if (reqId === dataReqId.current) setLoading(false)
    }
  }, [])

  const carregarKommo = useCallback(async (r: { start: string; end: string }) => {
    const reqId = ++kommoReqId.current
    setKommoLoading(true)
    try {
      const [leadsRes, contactsRes] = await Promise.all([
        fetch(`/api/kommo/leads?start=${r.start}&end=${r.end}`, { cache: 'no-store' }),
        fetch(`/api/kommo/contacts?start=${r.start}&end=${r.end}`, { cache: 'no-store' }),
      ])
      const [leadsJson, contactsJson] = await Promise.all([safeJson(leadsRes), safeJson(contactsRes)])
      if (reqId !== kommoReqId.current) return

      if (!leadsRes.ok || !contactsRes.ok) {
        const bad = !leadsRes.ok ? leadsJson : contactsJson
        // TODO: remover exibição de "detail"/"envCheck" depois de diagnosticar o problema em produção
        throw new Error(`${bad.error || 'Erro'} · ${bad.detail || ''} · env=${JSON.stringify(bad.envCheck)}`)
      }

      setKommoLeads(leadsJson)
      setKommoContacts(contactsJson)
      setKommoError(null)
    } catch (e) {
      if (reqId !== kommoReqId.current) return
      setKommoError(e instanceof Error ? e.message : 'Não foi possível carregar os dados do Kommo agora.')
    } finally {
      if (reqId === kommoReqId.current) setKommoLoading(false)
    }
  }, [])

  const carregarCanais = useCallback(async (r: { start: string; end: string }) => {
    const reqId = ++canaisReqId.current
    setCanaisLoading(true)
    try {
      const res = await fetch(`/api/kommo/canais?start=${r.start}&end=${r.end}`, { cache: 'no-store' })
      const json = await safeJson(res)
      if (reqId !== canaisReqId.current) return
      if (!res.ok) throw new Error(`${json.error || 'Erro'} · ${json.detail || ''}`)
      setCanais(json)
      setCanaisError(null)
    } catch (e) {
      if (reqId !== canaisReqId.current) return
      setCanaisError(e instanceof Error ? e.message : 'Não foi possível carregar os canais do Kommo agora.')
    } finally {
      if (reqId === canaisReqId.current) setCanaisLoading(false)
    }
  }, [])

  const carregarTudo = useCallback((r: { start: string; end: string }) => {
    carregar(r)
    carregarKommo(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    carregarTudo(range)
    const id = setInterval(() => carregarTudo(range), 5 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  // Canal por unidade tem seu próprio filtro de período (menor/independente do
  // filtro geral) porque o cálculo pagina conversa por conversa e fica mais lento
  // quanto maior o período.
  useEffect(() => {
    carregarCanais(canaisRange)
    const id = setInterval(() => carregarCanais(canaisRange), 5 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canaisRange.start, canaisRange.end])

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

  function presetCanais(start: Date, end: Date) {
    setCanaisRange({ start: fmtDate(start), end: fmtDate(end) })
  }

  const canaisPeriodoFormatado = useMemo(() => {
    try {
      if (canaisRange.start === canaisRange.end) return format(new Date(canaisRange.start + 'T12:00:00'), 'dd/MM/yyyy')
      return `${format(new Date(canaisRange.start + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(canaisRange.end + 'T12:00:00'), 'dd/MM/yyyy')}`
    } catch {
      return ''
    }
  }, [canaisRange])

  const botoes = data?.events.filter(e => e.name.startsWith('Botão')) || []

  const funilStages = data && kommoLeads && canais
    ? [
        { label: 'Visitantes', value: data.totals.activeUsers, icon: Users },
        { label: 'Cliques em botões', value: data.totals.buttonClicks, icon: MousePointerClick },
        { label: 'Conversas recebidas (novas)', value: canais.novos, icon: Globe },
        { label: 'Leads no CRM', value: kommoLeads.count, icon: UserPlus },
      ]
    : null

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
          onClick={() => carregarTudo(range)}
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

      {/* Funil geral */}
      {funilStages && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            Funil geral
            <InfoTooltip text="Funil aproximado: compara o total de cada etapa no período, mas não acompanha a mesma pessoa passo a passo — os dados vêm de sistemas diferentes (Google Analytics e Kommo) que não se conversam entre si. Útil pra ver onde o volume cai mais, não é uma taxa de conversão individual exata." />
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Visitantes / Cliques / Leads: {periodoFormatado} · Conversas recebidas: {canaisPeriodoFormatado} (filtro próprio do quadro Canal por unidade, mais abaixo)
          </p>
          <div className="space-y-3">
            {funilStages.map((stage, i) => {
              const first = funilStages[0].value ?? 0
              const prev = i > 0 ? funilStages[i - 1].value : null
              const value = stage.value
              const width = value === null ? 0 : Math.max(first ? (value / first) * 100 : 0, value > 0 ? 2 : 0)
              const pctFromPrev = value !== null && prev ? (value / prev) * 100 : null
              const pctFromFirst = value !== null && i > 0 && first ? (value / first) * 100 : null
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <stage.icon className="w-3.5 h-3.5" /> {stage.label}
                    </span>
                    <span className="font-semibold text-gray-900">{value === null ? '—' : fmt(value)}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: GOLD }} />
                  </div>
                  {(pctFromPrev !== null || pctFromFirst !== null) && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {pctFromPrev !== null && `${pctFromPrev.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da etapa anterior`}
                      {pctFromPrev !== null && pctFromFirst !== null && ' · '}
                      {pctFromFirst !== null && `${pctFromFirst.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total de visitantes`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {canais?.novos === null && (
            <p className="text-xs text-amber-600 mt-3">
              A etapa &quot;Conversas recebidas&quot; não pôde ser calculada agora (período grande demais pro quadro de canais) — o funil pode estar incompleto.
            </p>
          )}
        </div>
      )}

      {/* CRM Kommo */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
          CRM Kommo
          {kommoLoading && kommoLeads && <span className="flex items-center gap-1 text-violet-400 normal-case font-normal"><Loader2 className="w-3 h-3 animate-spin" /> atualizando…</span>}
        </p>
        {kommoError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{kommoError}</div>
        ) : (
          <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 transition-opacity ${kommoLoading && kommoLeads ? 'opacity-50' : ''}`}>
            <div className="bg-white rounded-xl border border-violet-200 p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Novos leads no período
                <InfoTooltip text="Oportunidades de venda criadas no funil da Kommo no período, de qualquer origem (WhatsApp, Instagram, cadastro manual, formulário etc). Nem todo contato vira lead — por isso costuma ser menor que 'Novos contatos'." />
              </p>
              <p className="text-2xl font-bold text-violet-600">
                {kommoLoading && !kommoLeads ? <Loader2 className="w-5 h-5 animate-spin text-violet-300" /> : fmt(kommoLeads?.count || 0)}
                {kommoLeads?.capped && <span className="text-xs font-normal text-gray-400">+</span>}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-violet-200 p-4">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                <Contact className="w-3.5 h-3.5" /> Novos contatos no período
                <InfoTooltip text="Pessoas (registros de contato) criadas na Kommo no período, de qualquer origem — não só mensageria. Diferente do quadro 'Canal por unidade' abaixo, que conta só conversas recebidas por chat." />
              </p>
              <p className="text-2xl font-bold text-violet-600">
                {kommoLoading && !kommoContacts ? <Loader2 className="w-5 h-5 animate-spin text-violet-300" /> : fmt(kommoContacts?.count || 0)}
                {kommoContacts?.capped && <span className="text-xs font-normal text-gray-400">+</span>}
              </p>
            </div>
          </div>
        )}

        {/* Canal x unidade — tem filtro próprio, menor que o de cima */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              Canal por unidade
              <InfoTooltip text="Conversas recebidas por mensageria (WhatsApp, Instagram, TikTok, Facebook) no período, separadas por unidade. Não inclui contatos/leads criados de outras formas (cadastro manual, formulário etc) — só o que veio por chat." />
              {canaisLoading && canais && <span className="flex items-center gap-1 text-violet-400 font-normal"><Loader2 className="w-3 h-3 animate-spin" /> atualizando…</span>}
            </p>
            <button
              onClick={() => carregarCanais(canaisRange)}
              className="text-gray-400 hover:text-gray-700"
              title="Atualizar"
            >
              {canaisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">De:</label>
              <input
                type="date"
                value={canaisRange.start}
                max={canaisRange.end}
                onChange={e => setCanaisRange(r => ({ ...r, start: e.target.value }))}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">Até:</label>
              <input
                type="date"
                value={canaisRange.end}
                min={canaisRange.start}
                max={fmtDate(new Date())}
                onChange={e => setCanaisRange(r => ({ ...r, end: e.target.value }))}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => presetCanais(new Date(), new Date())}
                className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                Hoje
              </button>
              <button onClick={() => presetCanais(subDays(new Date(), 1), subDays(new Date(), 1))}
                className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                Ontem
              </button>
              <button onClick={() => presetCanais(subDays(new Date(), 7), new Date())}
                className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                Últimos 7 dias
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Total de conversas recebidas em {canaisPeriodoFormatado || '...'}
            {canais?.sampled ? `: ${fmt(canais.sampled)}` : ''}
            {canais?.capped && '+'}
            . Esse quadro tem um filtro próprio, separado do filtro geral acima, porque o cálculo é feito conversa por conversa — quanto maior o período, mais tempo leva.
            {canais?.capped && ' O período escolhido tem mais conversas do que o quadro consegue somar de uma vez — o número mostrado é parcial, não o total exato.'}
          </p>

          {canais && canais.novos !== null && canais.existentes !== null && (
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <strong className="text-gray-700">{fmt(canais.novos)}</strong> novos (nunca tinham falado com vocês)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <strong className="text-gray-700">{fmt(canais.existentes)}</strong> já conhecidos (voltaram a chamar)
              </span>
              <InfoTooltip text="Compara a data de criação do contato com a data da conversa: se o contato foi criado na hora dessa conversa, é a primeira vez que esse número fala com vocês; se o contato já existia antes, é alguém que já tinham no Kommo." />
            </p>
          )}

          {canaisError ? (
            <p className="text-sm text-red-600">{canaisError}</p>
          ) : !canais ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
          ) : (
            <div className={`overflow-x-auto transition-opacity ${canaisLoading ? 'opacity-50' : ''}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">Unidade</th>
                    {canais.channels.map(c => (
                      <th key={c} className="py-2 px-3 font-medium text-right">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {canais.unidades.map(u => (
                    <tr key={u} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pr-4 text-gray-700">{u}</td>
                      {canais.channels.map(c => (
                        <td key={c} className="py-2 px-3 text-right text-gray-900 font-medium">{fmt(canais.matrix[u]?.[c] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
          {loading && (
            <p className="text-xs text-violet-400 flex items-center gap-1 -mb-2">
              <Loader2 className="w-3 h-3 animate-spin" /> atualizando dados do Analytics…
            </p>
          )}
          <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <KpiCard icon={Eye} label="Visualizações" value={fmt(data.totals.pageViews)}
              tooltip="Quantas vezes uma página do site foi carregada. Se a mesma pessoa vir 3 páginas, conta 3 — não é 'quantas pessoas', é 'quantas vezes uma página abriu'." />
            <KpiCard icon={Users} label="Usuários ativos" value={fmt(data.totals.activeUsers)}
              tooltip="Quantas pessoas diferentes (visitantes únicos) entraram no site no período. Cada pessoa conta 1 vez, não importa quantas páginas viu." />
            <KpiCard icon={Activity} label="Sessões" value={fmt(data.totals.sessions)}
              tooltip="Quantas 'visitas' o site recebeu. A mesma pessoa pode gerar mais de uma sessão se sair e voltar depois de ~30 min parado — por isso costuma ser um pouco maior que usuários ativos." />
            <KpiCard icon={Activity} label="Taxa de engajamento" value={fmtPct(data.totals.engagementRate)}
              tooltip="% das sessões consideradas 'de qualidade' pelo Google: a pessoa ficou pelo menos ~10s no site, viu 2+ páginas, ou fez alguma ação de conversão. Separa quem interagiu de quem abriu e saiu na hora." />
            <KpiCard icon={MousePointerClick} label="Cliques em botões" value={fmt(data.totals.buttonClicks)} accent
              tooltip="Soma de cliques nos botões do site configurados como eventos rastreáveis (os que aparecem no quadro 'Cliques por botão' abaixo, tipo Unidade Santo André, Curso Presencial etc)." />
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Acessos na home
              <InfoTooltip text="Quem chegou na página inicial do site (elainedanelon.com.br), contando só quem caiu direto nela — sem entrar em nenhuma sub-página. Isso é diferente de 'Cliques em botões': aqui é só a chegada na página, antes de qualquer clique dentro dela. Serve de referência pra saber o volume de gente que passou pelo site, mesmo quem não clicou em nada." />
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-semibold text-gray-900">{fmt(data.homeAccess.pageViews)}</p>
                <p className="text-xs text-gray-500">visualizações</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{fmt(data.homeAccess.sessions)}</p>
                <p className="text-xs text-gray-500">sessões</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{fmt(data.homeAccess.activeUsers)}</p>
                <p className="text-xs text-gray-500">usuários</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
              Usuários ativos por dia
              <InfoTooltip text="Evolução diária de visitantes únicos no período selecionado — mesma métrica do card 'Usuários ativos' acima, mas dia a dia." />
            </p>
            <Sparkline points={data.timeseries} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" /> Cliques por botão
                <InfoTooltip text="Cliques em botões específicos do site que foram configurados manualmente para disparar um evento no Google Analytics quando clicados. Só aparece aqui o que foi configurado — não é automático." />
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
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                Origem do tráfego
                <InfoTooltip text="De onde vieram as sessões: por qual canal a pessoa chegou ao site. 'Anúncio pago' = campanha paga (Meta/Google Ads); 'não pago' = alguém clicou num link ou achou no Google sem ser anúncio; 'acesso direto' = digitou o site ou já tinha salvo." />
              </p>
              <ul className="space-y-2">
                {data.trafficSource.map(s => (
                  <li key={s.source} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-600 truncate pr-2">
                      {fmtOrigem(s.source)}
                      <span className="block text-[10px] text-gray-400">{s.source}</span>
                    </span>
                    <span className="font-semibold text-gray-900 shrink-0">{fmt(s.sessions)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
                Origem por perfil (link na bio)
                <InfoTooltip text="Sessões vindas do link na bio do Instagram, separadas por perfil/unidade — cada perfil usa um link próprio com identificação (utm_campaign) diferente. Só aparece aqui o perfil que já estiver usando o link com essa identificação; perfil que ainda usa o link antigo sem identificação cai em 'Origem do tráfego', misturado com o resto do Instagram." />
              </p>
              <ul className="space-y-2">
                {data.campaignBreakdown.length === 0 && (
                  <li className="text-sm text-gray-400">Nenhum link com identificação de perfil usado ainda no período.</li>
                )}
                {data.campaignBreakdown.map(c => (
                  <li key={c.campaign} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-600 truncate pr-2">{c.campaign.replace('perfil_', '')}</span>
                    <span className="font-semibold text-gray-900 shrink-0">{fmt(c.sessions)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 leading-relaxed flex items-start gap-1">
                  <span>
                    <strong className="text-gray-500">Referência antes da troca dos links</strong> (25/08/2026, link puro sem identificação, últimos 28 dias): 66.695 visualizações · 33.462 sessões · 26.277 usuários na home. Fica registrado aqui pra comparar com o que os links por perfil trouxerem depois.
                  </span>
                </p>
              </div>
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
