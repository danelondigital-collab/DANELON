import { NextRequest, NextResponse } from 'next/server'
import { runReport } from '@/lib/ga4'
import { base, BOTAO } from '@/lib/funil-ga4'
import { funilFundoForRoute } from '@/lib/kommo'

export const dynamic = 'force-dynamic'
// a varredura do Kommo pagina a caixa de entrada inteira até sair do período
export const maxDuration = 60

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface Row {
  dimensionValues?: { value: string }[]
  metricValues: { value: string }[]
}

const num = (v: string | undefined) => Number(v || 0)
/** GA4 devolve a data como yyyymmdd. */
const isoDoGa4 = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`

/** Todos os dias de start a end, inclusive (datas yyyy-mm-dd, sem fuso). */
function diasEntre(start: string, end: string) {
  const dias: string[] = []
  const d = new Date(`${start}T12:00:00Z`)
  const fim = new Date(`${end}T12:00:00Z`)
  while (d <= fim) {
    dias.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dias
}

/**
 * Funil completo dia a dia: as mesmas 5 etapas do funil do período (3 do GA4,
 * 2 do Kommo), com as mesmas exclusões (sem TikTok pago), quebradas por dia.
 *
 * "Pessoas" e "clicaram" do total da semana vêm de consulta própria, sem
 * dimensão de data: quem visitou na segunda e na quarta é uma pessoa só na
 * semana, e somar os dias contaria duas.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return NextResponse.json({ error: 'Informe start e end (yyyy-mm-dd).' }, { status: 400 })
  }
  if (diasEntre(start, end).length > 31) {
    return NextResponse.json({ error: 'Período máximo de 31 dias.' }, { status: 400 })
  }

  // Dia futuro E o dia de hoje ficam sem dado (null), diferente de 0 (houve o
  // dia e não teve nada). Hoje fica de fora porque o GA4 leva 24-48h pra
  // atribuir a origem da sessão: em 18/09/2026 o dia corrente mostrava ~1.300
  // sessões "(not set)"/"(data not available)" com 0% de engajamento — anúncio
  // do TikTok ainda não classificado, que depois cai no filtro de TikTok pago.
  // Mesma regra do filtro principal, que termina em "ontem". A consulta vai só
  // até ontem pra que o total da semana bata com as barras.
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
  const ontem = new Date(Date.now() - 27 * 3600 * 1000).toISOString().slice(0, 10)
  const fim = end < ontem ? end : ontem
  const semDado = (dia: string) => ({ dia, sessoes: null, visitantes: null, clicaram: null, conversas: null, leadsComerciais: null })

  if (start > fim) {
    return NextResponse.json({
      start, end, hoje,
      dias: diasEntre(start, end).map(semDado),
      totais: { sessoes: 0, visitantes: 0, clicaram: 0, conversas: 0, leadsComerciais: 0 },
      parcial: false,
      updatedAt: new Date().toISOString(),
    })
  }

  try {
    const dateRanges = [{ startDate: start, endDate: fim }]
    const [visitasDia, cliquesDia, visitasTotal, cliquesTotal, kommo] = await Promise.all([
      runReport({
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: base(),
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: base(BOTAO),
      }),
      runReport({ dateRanges, metrics: [{ name: 'sessions' }, { name: 'activeUsers' }], dimensionFilter: base() }),
      runReport({ dateRanges, metrics: [{ name: 'activeUsers' }], dimensionFilter: base(BOTAO) }),
      funilFundoForRoute(start, fim),
    ])

    const porDia = new Map<string, { sessoes: number; visitantes: number; clicaram: number }>()
    for (const r of (visitasDia.rows || []) as Row[]) {
      const dia = isoDoGa4(r.dimensionValues![0].value)
      porDia.set(dia, { sessoes: num(r.metricValues[0].value), visitantes: num(r.metricValues[1].value), clicaram: 0 })
    }
    for (const r of (cliquesDia.rows || []) as Row[]) {
      const dia = isoDoGa4(r.dimensionValues![0].value)
      const atual = porDia.get(dia) || { sessoes: 0, visitantes: 0, clicaram: 0 }
      porDia.set(dia, { ...atual, clicaram: num(r.metricValues[0].value) })
    }

    const dias = diasEntre(start, end).map(dia => {
      if (dia > fim) return semDado(dia)
      const ga = porDia.get(dia)
      return {
        dia,
        sessoes: ga?.sessoes ?? 0,
        visitantes: ga?.visitantes ?? 0,
        clicaram: ga?.clicaram ?? 0,
        conversas: kommo.conversas.porDia[dia] ?? 0,
        leadsComerciais: kommo.leads.comercialPorDia[dia] ?? 0,
      }
    })

    const vt = (visitasTotal.rows?.[0] as Row | undefined)?.metricValues
    const ct = (cliquesTotal.rows?.[0] as Row | undefined)?.metricValues
    return NextResponse.json({
      start,
      end,
      hoje,
      dias,
      totais: {
        sessoes: num(vt?.[0]?.value),
        visitantes: num(vt?.[1]?.value),
        clicaram: num(ct?.[0]?.value),
        conversas: kommo.conversas.total,
        leadsComerciais: kommo.leads.comercial,
      },
      parcial: kommo.conversas.capped || kommo.leads.capped,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erro ao montar o funil semanal:', error)
    return NextResponse.json({ error: 'Não foi possível carregar a semana.' }, { status: 500 })
  }
}
