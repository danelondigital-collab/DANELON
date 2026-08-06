import { NextResponse } from 'next/server'
import { runReport, hostFilter, hostAndButtonClicksFilter, DATE_RANGE_28D } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

function num(v: string | undefined) {
  return Number(v || 0)
}

export async function GET() {
  try {
    const [totals, timeseries, events, topPages, trafficSource, buttonClicks] = await Promise.all([
      runReport({
        dateRanges: DATE_RANGE_28D,
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'engagementRate' }, { name: 'sessions' }],
        dimensionFilter: hostFilter(),
      }),
      runReport({
        dateRanges: DATE_RANGE_28D,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      runReport({
        dateRanges: DATE_RANGE_28D,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '15',
      }),
      runReport({
        dateRanges: DATE_RANGE_28D,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: '8',
      }),
      runReport({
        dateRanges: DATE_RANGE_28D,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '8',
      }),
      runReport({
        dateRanges: DATE_RANGE_28D,
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: hostAndButtonClicksFilter(),
      }),
    ])

    const totalsRow = totals.rows?.[0]?.metricValues
    const buttonClicksTotal = num(buttonClicks.rows?.[0]?.metricValues?.[0]?.value)

    const payload = {
      updatedAt: new Date().toISOString(),
      totals: {
        pageViews: num(totalsRow?.[0]?.value),
        activeUsers: num(totalsRow?.[1]?.value),
        engagementRate: num(totalsRow?.[2]?.value),
        sessions: num(totalsRow?.[3]?.value),
        buttonClicks: buttonClicksTotal,
      },
      timeseries: (timeseries.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        date: r.dimensionValues[0].value,
        activeUsers: num(r.metricValues[0].value),
      })),
      events: (events.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        name: r.dimensionValues[0].value,
        count: num(r.metricValues[0].value),
      })),
      topPages: (topPages.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        path: r.dimensionValues[0].value,
        views: num(r.metricValues[0].value),
      })),
      trafficSource: (trafficSource.rows || []).map((r: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
        source: r.dimensionValues[0].value,
        sessions: num(r.metricValues[0].value),
      })),
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Erro ao buscar dados do GA4:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Google Analytics.' }, { status: 500 })
  }
}
