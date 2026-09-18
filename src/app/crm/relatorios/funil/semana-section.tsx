'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle, Briefcase, CalendarDays, ChevronLeft, ChevronRight, Eye, HelpCircle,
  Loader2, MessageCircle, MousePointerClick, Users,
} from 'lucide-react'

const GOLD = '#B8924A'
const fmt = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number) => n.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const iso = (d: Date) => format(d, 'yyyy-MM-dd')
/** Semana de segunda a domingo, como a equipe fala "essa semana". */
const segundaDe = (d: Date) => startOfWeek(d, { weekStartsOn: 1 })

interface Dia {
  dia: string
  sessoes: number | null
  visitantes: number | null
  clicaram: number | null
  conversas: number | null
  leadsComerciais: number | null
}

interface Semana {
  start: string
  end: string
  hoje: string
  dias: Dia[]
  totais: { sessoes: number; visitantes: number; clicaram: number; conversas: number; leadsComerciais: number }
  parcial: boolean
}

type Chave = 'sessoes' | 'visitantes' | 'clicaram' | 'conversas' | 'leadsComerciais'

/** As mesmas 5 etapas e cores do "Funil completo". */
const ETAPAS: { chave: Chave; label: string; icon: React.ElementType; cor: string; fonte: 'GA4' | 'Kommo' }[] = [
  { chave: 'sessoes', label: 'Visitas ao site', icon: Eye, cor: '#1F2937', fonte: 'GA4' },
  { chave: 'visitantes', label: 'Pessoas diferentes', icon: Users, cor: '#374151', fonte: 'GA4' },
  { chave: 'clicaram', label: 'Clicaram em contato', icon: MousePointerClick, cor: GOLD, fonte: 'GA4' },
  { chave: 'conversas', label: 'Conversas recebidas', icon: MessageCircle, cor: '#0F766E', fonte: 'Kommo' },
  { chave: 'leadsComerciais', label: 'Leads comerciais', icon: Briefcase, cor: '#134E4A', fonte: 'Kommo' },
]

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <HelpCircle className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help" />
      <span className="pointer-events-none absolute z-30 hidden group-hover/tip:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 text-white text-xs leading-relaxed p-2.5 shadow-lg normal-case font-normal text-left">
        {text}
      </span>
    </span>
  )
}

const diaCurto = (d: string) => format(new Date(`${d}T12:00:00`), 'EEE', { locale: ptBR }).replace('.', '')
const diaNumero = (d: string) => format(new Date(`${d}T12:00:00`), 'dd/MM')

/** Gráfico de barras de uma etapa: um dia por barra, valor em cima. */
function BarrasDia({ dias, chave, cor, hoje }: { dias: Dia[]; chave: Chave; cor: string; hoje: string }) {
  const valores = dias.map(d => d[chave])
  const max = Math.max(...valores.map(v => v ?? 0), 1)
  const melhor = Math.max(...valores.map(v => v ?? -1))

  return (
    <div className="flex items-end gap-1.5 sm:gap-2.5 h-44">
      {dias.map(d => {
        const v = d[chave]
        const altura = v ? Math.max((v / max) * 100, 2) : 0
        const ehHoje = d.dia === hoje
        return (
          <div key={d.dia} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
            <span className={`text-[11px] tabular-nums mb-1 ${v === melhor && v > 0 ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
              {v === null ? '' : fmt(v)}
            </span>
            <div className="w-full flex-1 flex items-end">
              {v === null ? (
                <div className="w-full h-full rounded-t-md border border-dashed border-gray-200 flex items-center justify-center">
                  {ehHoje && <span className="text-[9px] text-gray-400 text-center leading-tight px-0.5">em processamento</span>}
                </div>
              ) : (
                <div
                  className="w-full rounded-t-md transition-all"
                  title={`${diaNumero(d.dia)}: ${fmt(v)}`}
                  style={{ height: `${altura}%`, backgroundColor: cor }}
                />
              )}
            </div>
            <span className={`mt-1.5 text-[11px] capitalize ${ehHoje ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
              {diaCurto(d.dia)}
            </span>
            <span className="text-[10px] text-gray-400 tabular-nums">{diaNumero(d.dia)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SemanaSection() {
  const [segunda, setSegunda] = useState(() => segundaDe(new Date()))
  const [dados, setDados] = useState<Semana | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const reqId = useRef(0)

  const start = iso(segunda)
  const end = iso(addDays(segunda, 6))
  const ehSemanaAtual = start === iso(segundaDe(new Date()))

  const buscar = useCallback(async () => {
    const id = ++reqId.current
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/funil/semana?start=${start}&end=${end}`, { cache: 'no-store' })
      const json = await res.json().catch(() => {
        throw new Error('O servidor demorou demais pra responder — tente de novo.')
      })
      if (id !== reqId.current) return
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar a semana.')
      setDados(json)
    } catch (e) {
      if (id !== reqId.current) return
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a semana.')
    } finally {
      if (id === reqId.current) setCarregando(false)
    }
  }, [start, end])

  useEffect(() => { buscar() }, [buscar])

  const titulo = `${format(segunda, 'dd/MM')} a ${format(addDays(segunda, 6), 'dd/MM/yyyy')}`
  // a resposta pode ser da semana anterior enquanto a nova carrega
  const semana = dados && dados.start === start ? dados : null
  const temHoje = semana?.dias.some(d => d.dia === semana.hoje)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Funil completo da semana, dia a dia
            <InfoTooltip text="As mesmas etapas do Funil completo, com as mesmas regras (sem TikTok pago), quebradas por dia. Esta seção tem o próprio seletor de semana e não segue o filtro de período do topo da página." />
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Segunda a domingo. Não segue o filtro de período do topo.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSegunda(s => addWeeks(s, -1))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600" aria-label="Semana anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-700 tabular-nums px-2 min-w-[9.5rem] text-center">{titulo}</span>
          <button onClick={() => setSegunda(s => addWeeks(s, 1))} disabled={ehSemanaAtual}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Próxima semana">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!ehSemanaAtual && (
            <button onClick={() => setSegunda(segundaDe(new Date()))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 ml-1">
              Esta semana
            </button>
          )}
        </div>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-3">{erro}</div>}

      {!semana ? (
        <p className="text-sm text-gray-400 py-16 text-center flex items-center justify-center gap-2">
          {carregando ? <><Loader2 className="w-4 h-4 animate-spin" /> Carregando a semana… (o Kommo leva alguns segundos)</> : 'Sem dados.'}
        </p>
      ) : (
        <div className={carregando ? 'opacity-60 transition-opacity' : ''}>
          {/* Totais da semana, na ordem do funil */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            {ETAPAS.map((e, i) => {
              const total = semana.totais[e.chave]
              const anterior = i > 0 ? semana.totais[ETAPAS[i - 1].chave] : null
              const Icon = e.icon
              return (
                <div key={e.chave} className="rounded-lg p-3 text-white" style={{ backgroundColor: e.cor }}>
                  <p className="text-[11px] flex items-center gap-1 opacity-90">
                    <Icon className="w-3 h-3 shrink-0" /> {e.label}
                  </p>
                  <p className="text-xl font-bold tabular-nums mt-1">{fmt(total)}</p>
                  <p className="text-[10px] opacity-75 mt-0.5">
                    {e.fonte}
                    {anterior ? ` · ${fmtPct(total / anterior)} da etapa anterior` : ''}
                  </p>
                </div>
              )
            })}
          </div>

          {(semana.parcial || temHoje) && (
            <div className="flex items-start gap-2 mb-4 text-[11px] text-gray-500">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {temHoje && <><strong>Hoje</strong> fica de fora até o dia fechar: o Google Analytics leva de 24 a 48h pra identificar de onde veio cada visita, e até lá o anúncio do TikTok aparece como visita sem origem e infla o número. </>}
                {semana.parcial && <>O Kommo não terminou de varrer a caixa de entrada a tempo: conversas e leads estão <strong>abaixo do real</strong>.</>}
              </p>
            </div>
          )}

          {/* Um gráfico por etapa: as escalas são muito diferentes (centenas de
              visitas contra poucos leads), num gráfico só as etapas de baixo sumiriam */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ETAPAS.map(e => (
              <div key={e.chave} className={`rounded-lg border border-gray-100 p-4 ${e.chave === 'leadsComerciais' ? 'lg:col-span-2' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.cor }} />
                    {e.label}
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{e.fonte}</span>
                  </p>
                  <span className="text-xs text-gray-500">
                    semana: <strong className="text-gray-800 tabular-nums">{fmt(semana.totais[e.chave])}</strong>
                  </span>
                </div>
                <BarrasDia dias={semana.dias} chave={e.chave} cor={e.cor} hoje={semana.hoje} />
              </div>
            ))}
          </div>

          {/* Tabela: os mesmos números, pra ler lado a lado */}
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-2">Dia</th>
                  {ETAPAS.map(e => <th key={e.chave} className="text-right font-medium pb-2">{e.label}</th>)}
                  <th className="text-right font-medium pb-2 pl-3">
                    <span className="inline-flex items-center gap-1">
                      Taxa de contato
                      <InfoTooltip text="Clicaram em contato ÷ pessoas diferentes, no dia." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {semana.dias.map(d => (
                  <tr key={d.dia}>
                    <td className="py-2 text-gray-700 capitalize">
                      {diaCurto(d.dia)} <span className="text-gray-400 tabular-nums">{diaNumero(d.dia)}</span>
                    </td>
                    {ETAPAS.map(e => (
                      <td key={e.chave} className="text-right tabular-nums text-gray-600">
                        {d[e.chave] === null ? <span className="text-gray-300">—</span> : fmt(d[e.chave]!)}
                      </td>
                    ))}
                    <td className="text-right tabular-nums text-gray-600 pl-3">
                      {d.visitantes ? fmtPct((d.clicaram ?? 0) / d.visitantes) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 font-medium">
                  <td className="py-2 text-gray-700">Semana</td>
                  {ETAPAS.map(e => (
                    <td key={e.chave} className="text-right tabular-nums text-gray-900">{fmt(semana.totais[e.chave])}</td>
                  ))}
                  <td className="text-right tabular-nums text-gray-900 pl-3">
                    {semana.totais.visitantes ? fmtPct(semana.totais.clicaram / semana.totais.visitantes) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            Na linha da semana, &quot;Pessoas&quot; e &quot;Clicaram&quot; contam cada pessoa uma vez só — por isso ficam
            menores que a soma dos dias (quem voltou em dois dias aparece nos dois).
          </p>
        </div>
      )}
    </div>
  )
}
