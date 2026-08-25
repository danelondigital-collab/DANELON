'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  Filter, Loader2, RefreshCw, MousePointerClick, Users, Eye, MessageCircle,
  UserPlus, HelpCircle, Briefcase, TrendingDown, AlertTriangle,
} from 'lucide-react'

const GOLD = '#B8924A'
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')
const fmt = (n: number) => n.toLocaleString('pt-BR')
const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Cor de cada plataforma — mantém a leitura consistente entre os quadros. */
const COR_FONTE: Record<string, string> = {
  'TikTok Ads': '#111827',
  'TikTok orgânico': '#4B5563',
  'Instagram': '#C13584',
  'Facebook': '#1877F2',
  'Google Ads': '#1A73E8',
  'Google busca': '#5F9EF0',
  'Acesso direto': '#9CA3AF',
  'Não identificado': '#D1D5DB',
  'Outros': '#D1D5DB',
}
const corFonte = (g: string) => COR_FONTE[g] || '#D1D5DB'

const COR_CANAL: Record<string, string> = {
  'WhatsApp': '#25D366',
  'Instagram (DM)': '#C13584',
  'TikTok (DM)': '#111827',
  'Facebook': '#1877F2',
  'Outro': '#9CA3AF',
}

interface FonteFunil {
  grupo: string
  pago: boolean
  sessoes: number
  visitantes: number
  cliques: number
  usuariosQueClicaram: number
  taxaContato: number
  origens: string[]
}

interface TrafegoFunil {
  updatedAt: string
  range: { startDate: string; endDate: string }
  totais: { sessoes: number; visitantes: number; pageViews: number; cliques: number; usuariosQueClicaram: number }
  home: { sessoes: number; visitantes: number; pageViews: number }
  porFonte: FonteFunil[]
  botoes: { nome: string; cliques: number }[]
  porPerfil: { perfil: string; sessoes: number; visitantes: number }[]
}

interface KommoFunil {
  conversas: {
    total: number
    porCanal: { canal: string; total: number }[]
    porPerfil: { perfil: string; total: number }[]
    capped: boolean
  }
  leads: {
    total: number
    comercial: number
    recrutamento: number
    outros: number
    detalhe: { pipeline: string; natureza: 'comercial' | 'recrutamento' | 'outro'; leads: number }[]
    capped: boolean
  }
}

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    throw new Error('O servidor demorou demais ou devolveu uma resposta inesperada — tente um período menor.')
  }
}

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

interface Etapa {
  label: string
  valor: number | null
  icon: React.ElementType
  cor: string
  tooltip: string
  /** origem do dado, pra deixar claro que o funil cruza dois sistemas */
  fonte: 'GA4' | 'Kommo'
}

/**
 * Funil visual: cada etapa é uma faixa centralizada cuja largura é proporcional
 * ao valor da primeira etapa — o estreitamento é o próprio funil. Entre as
 * faixas aparece a taxa de passagem de uma etapa pra próxima.
 */
function Funil({ etapas }: { etapas: Etapa[] }) {
  const base = etapas[0]?.valor || 1
  const LARGURA_MIN = 22

  return (
    <div className="space-y-1">
      {etapas.map((e, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null
        const taxa = anterior && anterior > 0 && e.valor !== null ? e.valor / anterior : null
        const largura = e.valor === null
          ? 100
          : Math.max(LARGURA_MIN, (e.valor / base) * 100)
        const Icon = e.icon

        return (
          <div key={e.label}>
            {i > 0 && (
              <div className="flex items-center justify-center py-1">
                {taxa === null ? (
                  <span className="text-[10px] text-gray-300">—</span>
                ) : (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    {fmtPct(taxa)} seguiram
                  </span>
                )}
              </div>
            )}
            <div className="flex justify-center">
              <div
                className="rounded-lg px-4 py-3 flex items-center justify-between gap-4 transition-all min-w-0"
                style={{ width: `${largura}%`, backgroundColor: e.cor }}
              >
                <span className="flex items-center gap-2 text-white/90 text-xs font-medium truncate">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{e.label}</span>
                  <span className="text-[9px] uppercase tracking-wide bg-white/20 rounded px-1 py-0.5 shrink-0">
                    {e.fonte}
                  </span>
                </span>
                <span className="text-white font-bold text-lg tabular-nums shrink-0">
                  {e.valor === null ? '—' : fmt(e.valor)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Barra({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = max > 0 ? (valor / max) * 100 : 0
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
    </div>
  )
}

export default function FunilClient() {
  const [range, setRange] = useState(() => ({
    start: fmtDate(subDays(new Date(), 28)),
    end: fmtDate(subDays(new Date(), 1)),
  }))

  const [trafego, setTrafego] = useState<TrafegoFunil | null>(null)
  const [kommo, setKommo] = useState<KommoFunil | null>(null)
  const [erroTrafego, setErroTrafego] = useState<string | null>(null)
  const [erroKommo, setErroKommo] = useState<string | null>(null)
  const [carregandoTrafego, setCarregandoTrafego] = useState(true)
  const [carregandoKommo, setCarregandoKommo] = useState(true)

  const buscarTrafego = useCallback(async () => {
    setCarregandoTrafego(true)
    setErroTrafego(null)
    try {
      const res = await fetch(`/api/funil/trafego?start=${range.start}&end=${range.end}`, { cache: 'no-store' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar tráfego.')
      setTrafego(json)
    } catch (e) {
      setErroTrafego(e instanceof Error ? e.message : 'Erro ao carregar tráfego.')
    } finally {
      setCarregandoTrafego(false)
    }
  }, [range])

  const buscarKommo = useCallback(async () => {
    setCarregandoKommo(true)
    setErroKommo(null)
    try {
      const res = await fetch(`/api/funil/kommo?start=${range.start}&end=${range.end}`, { cache: 'no-store' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar Kommo.')
      setKommo(json)
    } catch (e) {
      setErroKommo(e instanceof Error ? e.message : 'Erro ao carregar Kommo.')
    } finally {
      setCarregandoKommo(false)
    }
  }, [range])

  useEffect(() => { buscarTrafego() }, [buscarTrafego])
  useEffect(() => { buscarKommo() }, [buscarKommo])

  function preset(start: Date, end: Date) {
    setRange({ start: fmtDate(start), end: fmtDate(end) })
  }

  const periodo = useMemo(() => {
    try {
      return `${format(new Date(range.start + 'T12:00:00'), 'dd/MM/yyyy')} a ${format(new Date(range.end + 'T12:00:00'), 'dd/MM/yyyy')}`
    } catch { return '' }
  }, [range])

  const etapas: Etapa[] = useMemo(() => [
    {
      label: 'Visitas ao site', valor: trafego?.totais.sessoes ?? null, icon: Eye, cor: '#1F2937', fonte: 'GA4',
      tooltip: 'Sessões no site no período — cada "visita". A mesma pessoa pode gerar mais de uma se voltar depois de ~30 min parada.',
    },
    {
      label: 'Pessoas diferentes', valor: trafego?.totais.visitantes ?? null, icon: Users, cor: '#374151', fonte: 'GA4',
      tooltip: 'Visitantes únicos: cada pessoa conta uma vez só, independente de quantas visitas fez.',
    },
    {
      label: 'Clicaram em contato', valor: trafego?.totais.usuariosQueClicaram ?? null, icon: MousePointerClick, cor: GOLD, fonte: 'GA4',
      tooltip: 'Pessoas que clicaram em algum botão de contato do site (unidade, curso, loja). É a ponte entre visitar o site e puxar conversa.',
    },
    {
      label: 'Conversas recebidas', valor: kommo?.conversas.total ?? null, icon: MessageCircle, cor: '#0F766E', fonte: 'Kommo',
      tooltip: 'Conversas que chegaram na caixa de entrada do Kommo no período, por qualquer canal (WhatsApp, DM de Instagram, TikTok, Facebook) — inclusive quem não passou pelo site. Enquanto ninguém aceita a conversa no Kommo, ela fica parada nessa caixa.',
    },
    {
      label: 'Leads comerciais', valor: kommo?.leads.comercial ?? null, icon: Briefcase, cor: '#134E4A', fonte: 'Kommo',
      tooltip: 'Leads efetivamente criados nos pipelines de venda (Funil de vendas, Atendimento Geral, Fluxo já clientes) — ou seja, conversa que alguém aceitou e virou oportunidade. Não inclui candidatas a vaga: essas aparecem separadas logo abaixo.',
    },
  ], [trafego, kommo])

  const maxSessoes = Math.max(...(trafego?.porFonte.map(f => f.sessoes) || [1]), 1)
  const maxCanal = Math.max(...(kommo?.conversas.porCanal.map(c => c.total) || [1]), 1)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Filter className="w-5 h-5" style={{ color: GOLD }} />
            Funil de Tráfego Pago
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Do anúncio até a conversa: onde cada fonte entrega gente de verdade.
          </p>
        </div>
        <button
          onClick={() => { buscarTrafego(); buscarKommo() }}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregandoTrafego || carregandoKommo ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-500">De:</label>
          <input type="date" value={range.start} max={range.end}
            onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          <label className="text-sm text-gray-500">Até:</label>
          <input type="date" value={range.end} min={range.start}
            onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => preset(subDays(new Date(), 7), subDays(new Date(), 1))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">Últimos 7 dias</button>
            <button onClick={() => preset(subDays(new Date(), 28), subDays(new Date(), 1))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">Últimos 28 dias</button>
            <button onClick={() => preset(startOfMonth(new Date()), subDays(new Date(), 1))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">Este mês</button>
            <button onClick={() => preset(startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1)))}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">Mês passado</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Período: {periodo}</p>
      </div>

      {erroTrafego && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{erroTrafego}</div>
      )}

      {/* ── O FUNIL ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            Funil completo
            <InfoTooltip text="As três primeiras etapas vêm do Google Analytics (o que acontece no site). As três de baixo vêm do Kommo (o que acontece na conversa). Os dois sistemas não se conversam: uma conversa que chega no WhatsApp não carrega de qual anúncio a pessoa veio." />
          </p>
          {(carregandoTrafego || carregandoKommo) && (
            <span className="text-xs text-violet-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> carregando…
            </span>
          )}
        </div>
        <Funil etapas={etapas} />

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            As etapas de cima e de baixo <strong>não são o mesmo grupo de pessoas</strong>. Nem todo mundo que clica
            no site puxa conversa, e muita gente fala direto pelo Instagram sem passar pelo site — por isso
            &quot;Conversas recebidas&quot; pode ser maior que &quot;Clicaram em contato&quot;. Trate cada bloco como um
            estágio do processo, não como um filtro exato do bloco anterior.
          </p>
        </div>
      </div>

      {/* ── A PÁGINA DO LINK NA BIO ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-amber-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> elainedanelon.com.br — a página do link na bio
          <InfoTooltip text="Números da página inicial isolada. É ela que está no link da bio de todos os perfis, então é aqui que cai quem vem do Instagram. Praticamente todo o tráfego do site entra por essa página." />
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Só a página inicial, isolada do resto do site.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              Visitas
              <InfoTooltip text="Quantas vezes a página foi aberta como entrada no site (sessões). A mesma pessoa pode gerar várias se voltar depois de ~30 min parada." />
            </p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(trafego?.home.sessoes ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              Visitas únicas
              <InfoTooltip text="Pessoas diferentes que abriram essa página no período. Cada pessoa conta uma vez só, não importa quantas vezes voltou. É o número mais próximo de 'quantas pessoas de verdade'." />
            </p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>
              {fmt(trafego?.home.visitantes ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
              Visualizações
              <InfoTooltip text="Total de carregamentos da página, incluindo recarregar e voltar. Sempre o maior dos três — é o número que menos serve pra medir gente." />
            </p>
            <p className="text-2xl font-bold text-gray-500 tabular-nums">{fmt(trafego?.home.pageViews ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* ── QUALIDADE POR FONTE ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          Qualidade por fonte de tráfego
          <InfoTooltip text="Volume não é qualidade. A coluna que importa é a taxa de contato: de cada 100 pessoas que aquela fonte trouxe, quantas chegaram a clicar num botão de contato." />
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Ordenado por volume. A última coluna mostra quem realmente vira conversa.
        </p>

        {carregandoTrafego && !trafego ? (
          <p className="text-sm text-gray-400 py-6 text-center">Carregando dados do Analytics…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium pb-2">
                    <span className="inline-flex items-center gap-1">
                      Fonte
                      <InfoTooltip text="De onde a pessoa veio antes de entrar no site. Agrupa os vários endereços que a mesma plataforma usa: o Instagram, por exemplo, chega como ig/social, l.instagram.com e instagram.com — separados, cada um parece pequeno." />
                    </span>
                  </th>
                  <th className="text-right font-medium pb-2">
                    <span className="inline-flex items-center gap-1">
                      Visitas
                      <InfoTooltip text="Sessões: quantas vezes alguém entrou no site vindo dessa fonte. A mesma pessoa pode gerar mais de uma visita." />
                    </span>
                  </th>
                  <th className="text-right font-medium pb-2">
                    <span className="inline-flex items-center gap-1">
                      Pessoas
                      <InfoTooltip text="Visitas únicas: pessoas diferentes que vieram dessa fonte. Cada uma conta uma vez só. É o número real de gente." />
                    </span>
                  </th>
                  <th className="text-right font-medium pb-2">
                    <span className="inline-flex items-center gap-1">
                      Clicaram
                      <InfoTooltip text="Dessas pessoas, quantas clicaram em algum botão de contato (unidade, curso, loja) — ou seja, demonstraram intenção de falar com a Danelon." />
                    </span>
                  </th>
                  <th className="text-right font-medium pb-2 pl-4">
                    <span className="inline-flex items-center gap-1">
                      Taxa de contato
                      <InfoTooltip text="Clicaram ÷ Pessoas. De cada 100 pessoas que essa fonte trouxe, quantas chegaram a clicar em contato. Verde acima de 30%, vermelho abaixo de 10%. É a métrica que separa volume de resultado." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(trafego?.porFonte || []).map(f => (
                  <tr key={f.grupo} className="hover:bg-gray-50/60">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: corFonte(f.grupo) }} />
                        <span className="text-gray-700">{f.grupo}</span>
                        {f.pago && (
                          <span className="text-[9px] uppercase tracking-wide bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">
                            pago
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 max-w-[220px]">
                        <Barra valor={f.sessoes} max={maxSessoes} cor={corFonte(f.grupo)} />
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-gray-700 align-top pt-3">{fmt(f.sessoes)}</td>
                    <td className="text-right tabular-nums text-gray-500 align-top pt-3">{fmt(f.visitantes)}</td>
                    <td className="text-right tabular-nums text-gray-500 align-top pt-3">{fmt(f.usuariosQueClicaram)}</td>
                    <td className="text-right align-top pt-3 pl-4">
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: f.taxaContato >= 0.3 ? '#15803D' : f.taxaContato >= 0.1 ? GOLD : '#B91C1C' }}
                      >
                        {fmtPct(f.taxaContato)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            <strong>Por que o Instagram aparece com menos visitas que o TikTok:</strong> o anúncio do
            TikTok leva direto pro site, então cada clique no anúncio já vira uma visita aqui. O anúncio
            da Meta leva pro perfil do Instagram, e só quem clica no link da bio depois é que chega no
            site — é um passo a mais, e a maioria não dá esse passo. Por isso o número de visitas do
            Instagram é menor por natureza, não por falha de rastreamento (só 0,3% do tráfego do período
            ficou sem origem identificada). Repare que, mesmo com muito menos visitas, o Instagram
            entrega <strong>mais pessoas clicando em contato</strong> que o TikTok.
          </p>
        </div>
      </div>

      {/* ── LINK NA BIO POR PERFIL ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
            Link na bio, por perfil
            <InfoTooltip text="Sessões que entraram pelos links curtos configurados na bio de cada perfil do Instagram (elainedanelon.com.br/ig, /elaine, /morumbi etc). Só conta a partir do momento em que cada perfil trocou o link." />
          </p>
          {(trafego?.porPerfil.length || 0) === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhum acesso por link identificado ainda. Aparece assim que os perfis trocarem o link da bio.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {trafego?.porPerfil.map(p => (
                <li key={p.perfil}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{p.perfil}</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmt(p.sessoes)}</span>
                  </div>
                  <Barra
                    valor={p.sessoes}
                    max={Math.max(...(trafego?.porPerfil.map(x => x.sessoes) || [1]), 1)}
                    cor="#C13584"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Botões mais clicados */}
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
            Qual unidade a pessoa procurou
            <InfoTooltip text="Cliques por botão de contato do site. Mostra a demanda por unidade — qual está puxando mais interesse do tráfego." />
          </p>
          <ul className="space-y-2.5">
            {(trafego?.botoes || []).map(b => (
              <li key={b.nome}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{b.nome}</span>
                  <span className="font-semibold tabular-nums" style={{ color: GOLD }}>{fmt(b.cliques)}</span>
                </div>
                <Barra valor={b.cliques} max={Math.max(...(trafego?.botoes.map(x => x.cliques) || [1]), 1)} cor={GOLD} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── FUNDO DO FUNIL: KOMMO ──────────────────────────────── */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 font-medium">Fundo do funil · Kommo</p>

        {erroKommo && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">{erroKommo}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Conversas por canal */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> Conversas por canal
              <InfoTooltip text="Por onde a conversa chegou. DM de Instagram e TikTok já dizem a origem; WhatsApp não carrega de onde a pessoa veio antes de mandar mensagem." />
            </p>
            {carregandoKommo && !kommo ? (
              <p className="text-sm text-gray-400 py-4">Carregando conversas…</p>
            ) : (
              <ul className="space-y-2.5">
                {(kommo?.conversas.porCanal || []).map(c => (
                  <li key={c.canal}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{c.canal}</span>
                      <span className="font-semibold text-gray-900 tabular-nums">{fmt(c.total)}</span>
                    </div>
                    <Barra valor={c.total} max={maxCanal} cor={COR_CANAL[c.canal] || '#9CA3AF'} />
                  </li>
                ))}
              </ul>
            )}
            {kommo?.conversas.capped && (
              <p className="text-[11px] text-amber-600 mt-3">
                Contagem parcial: o período é longo demais pra varrer inteiro dentro do tempo limite. Use um período menor pro número exato.
              </p>
            )}
          </div>

          {/* Conversa que virou lead */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Da conversa ao lead
              <InfoTooltip text="Toda conversa cai numa caixa de entrada do Kommo e fica lá até alguém aceitar e transformar em lead. Este quadro mostra quanto dessa caixa de entrada realmente virou oportunidade comercial no período." />
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Quanto da caixa de entrada virou oportunidade comercial.
            </p>
            {carregandoKommo && !kommo ? (
              <p className="text-sm text-gray-400 py-4">Carregando…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-2xl font-bold text-gray-700 tabular-nums">{fmt(kommo?.conversas.total ?? 0)}</p>
                    <p className="text-xs text-gray-500">conversas chegaram</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-teal-700 tabular-nums">{fmt(kommo?.leads.comercial ?? 0)}</p>
                    <p className="text-xs text-gray-500">viraram lead comercial</p>
                  </div>
                </div>
                {(kommo?.conversas.total ?? 0) > 0 && (
                  <>
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className="bg-teal-600 h-full rounded-full"
                        style={{
                          width: `${Math.min(100, ((kommo?.leads.comercial ?? 0) / (kommo?.conversas.total || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {fmtPct((kommo?.leads.comercial ?? 0) / (kommo?.conversas.total || 1))} das conversas
                      viraram lead comercial no Kommo. O resto segue na caixa de entrada, sem ninguém ter
                      aceitado a conversa no sistema — o que não quer dizer que a pessoa não foi atendida
                      por fora, só que o CRM não registrou.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Leads: comercial x recrutamento */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Leads criados, por natureza
            <InfoTooltip text="Leads de venda e de recrutamento vêm do mesmo tráfego mas são resultados diferentes. Somados num número só, o volume de candidatas a vaga esconde o resultado comercial." />
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Separado porque candidata a vaga não é resultado comercial — mas também vem do tráfego.
          </p>

          {carregandoKommo && !kommo ? (
            <p className="text-sm text-gray-400 py-4">Carregando leads…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                  <p className="text-2xl font-bold text-teal-800 tabular-nums">{fmt(kommo?.leads.comercial ?? 0)}</p>
                  <p className="text-xs text-teal-700">comerciais</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-2xl font-bold text-gray-600 tabular-nums">{fmt(kommo?.leads.recrutamento ?? 0)}</p>
                  <p className="text-xs text-gray-500">recrutamento</p>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <p className="text-2xl font-bold text-gray-400 tabular-nums">{fmt(kommo?.leads.total ?? 0)}</p>
                  <p className="text-xs text-gray-400">total no Kommo</p>
                </div>
              </div>

              <ul className="space-y-2">
                {(kommo?.leads.detalhe || []).map(d => (
                  <li key={d.pipeline} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: d.natureza === 'comercial' ? '#0F766E' : '#9CA3AF' }}
                      />
                      {d.pipeline}
                      <span className="text-[10px] uppercase tracking-wide text-gray-400">{d.natureza}</span>
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmt(d.leads)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {trafego && (
        <p className="text-xs text-gray-400 text-right">
          Atualizado em {new Date(trafego.updatedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  )
}
