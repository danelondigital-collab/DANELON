import { NextRequest, NextResponse } from 'next/server'
import { runReport, hostFilter, hostAndButtonClicksFilter, DEFAULT_START, DEFAULT_END } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

function num(v: string | undefined) {
  return Number(v || 0)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const startDate = startParam && DATE_RE.test(startParam) ? startParam : DEFAULT_START
    const endDate = endParam && DATE_RE.test(endParam) ? endParam : DEFAULT_END
    const dateRanges = [{ startDate, endDate }]

    const [totals, timeseries, events, trafficSource, buttonClicks, homeAccess, campaignBreakdown] = await Promise.all([
      runReport({
        dateRanges,
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'engagementRate' }, { name: 'sessions' }],
        dimensionFilter: hostFilter(),
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '15',
      }),
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '8',
      }),
      runReport({
        dateRanges,
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: hostAndButtonClicksFilter(),
      }),
      // Acessos na home (landingPage = '/'): quantas pessoas chegaram no site,
      // antes de qualquer clique em botão. É uma métrica diferente de
      // "cliques em botões" -- uma é chegada, outra é ação dentro da página.
      runReport({
        dateRanges,
        metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'EXACT' as const, value: '/' } } },
            ],
          },
        },
      }),
      // Sessões vindas de link com utm_medium=bio (link na bio do Instagram),
      // quebradas por utm_campaign -- cada perfil (unidade) usa uma campanha
      // diferente, então isso mostra quantas pessoas cada perfil está trazendo.
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionCampaignName' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT' as const, value: 'bio' } } },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '10',
      }),
    ])

    const totalsRow = totals.rows?.[0]?.metricValues
    const buttonClicksTotal = num(buttonClicks.rows?.[0]?.metricValues?.[0]?.value)
    const homeAccessRow = homeAccess.rows?.[0]?.metricValues

    const payload = {
      updatedAt: new Date().toISOString(),
      range: { startDate, endDate },
      totals: {
        pageViews: num(totalsRow?.[0]?.value),
        activeUsers: num(totalsRow?.[1]?.value),
        engagementRate: num(totalsRow?.[2]?.value),
        sessions: num(totalsRow?.[3]?.value),
        buttonClicks: buttonClicksTotal,
      },
      homeAccess: {
        pageViews: num(homeAccessRow?.[0]?.value),
        sessions: num(homeAccessRow?.[1]?.value),
        activeUsers: num(homeAccessRow?.[2]?.value),
      },
      timeseries: (timeseries.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        date: r.dimensionValues[0].value,
        activeUsers: num(r.metricValues[0].value),
      })),
      events: (events.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        name: r.dimensionValues[0].value,
        count: num(r.metricValues[0].value),
      })),
      trafficSource: (trafficSource.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        source: r.dimensionValues[0].value,
        sessions: num(r.metricValues[0].value),
      })),
      campaignBreakdown: (campaignBreakdown.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        campaign: r.dimensionValues[0].value,
        sessions: num(r.metricValues[0].value),
      })),
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro ao buscar dados do GA4:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Google Analytics.' }, { status: 500 })
  }
}
