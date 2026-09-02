import { NextRequest, NextResponse } from 'next/server'
import { runReport, hostFilter, hostAndButtonClicksFilter, DEFAULT_START, DEFAULT_END } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

function num(v: string | undefined) {
  return Number(v || 0)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Agrupa o "origem / meio" cru do GA4 nas plataformas que a Danelon usa.
 * Cada plataforma pode aparecer com vários source/medium diferentes (ex: o
 * Instagram chega como `ig / social`, `l.instagram.com / referral` e
 * `instagram.com / referral`), e olhar linha a linha esconde o total real.
 */
const GRUPOS: { grupo: string; pago: boolean; match: (sm: string) => boolean }[] = [
  { grupo: 'TikTok Ads', pago: true, match: sm => sm.startsWith('tiktok /') && /paid|cpc|ppc/.test(sm) },
  { grupo: 'TikTok orgânico', pago: false, match: sm => sm.startsWith('tiktok') },
  { grupo: 'Google Ads', pago: true, match: sm => sm.startsWith('google /') && /cpc|ppc|paid/.test(sm) },
  { grupo: 'Google busca', pago: false, match: sm => sm.startsWith('google') },
  { grupo: 'Instagram', pago: false, match: sm => /^(ig|instagram|l\.instagram)/.test(sm) },
  { grupo: 'Facebook', pago: false, match: sm => /facebook/.test(sm) },
  { grupo: 'Acesso direto', pago: false, match: sm => sm.startsWith('(direct)') },
]

function classificar(sourceMedium: string): { grupo: string; pago: boolean } {
  const sm = sourceMedium.toLowerCase()
  for (const g of GRUPOS) {
    if (g.match(sm)) return { grupo: g.grupo, pago: g.pago }
  }
  if (sm === '(not set)' || sm === '(data not available)') {
    return { grupo: 'Não identificado', pago: false }
  }
  return { grupo: 'Outros', pago: false }
}

interface Row {
  dimensionValues: { value: string }[]
  metricValues: { value: string }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const startDate = startParam && DATE_RE.test(startParam) ? startParam : DEFAULT_START
    const endDate = endParam && DATE_RE.test(endParam) ? endParam : DEFAULT_END
    const dateRanges = [{ startDate, endDate }]

    const [totais, porFonteRaw, cliquesPorFonteRaw, botoesRaw, perfilRaw, homeRaw] = await Promise.all([
      // topo do funil, sem fatiar
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: hostFilter(),
      }),
      // sessões, visitantes e visualizações por origem
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: hostFilter(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '40',
      }),
      // quem clicou em botão de contato, por origem -- é o que liga o topo
      // (visita) ao fundo (conversa), e revela a qualidade de cada fonte
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: hostAndButtonClicksFilter(),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '40',
      }),
      // cliques por botão (qual unidade a pessoa procurou)
      runReport({
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: hostAndButtonClicksFilter(),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '20',
      }),
      // link na bio por perfil (utm_campaign)
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionCampaignName' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              { filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT' as const, value: 'bio' } } },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '15',
      }),
      // a home (elainedanelon.com.br/) isolada: é a página que está no link da
      // bio de todos os perfis, então é nela que o tráfego de Instagram cai
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'EXACT' as const, value: '/' } } },
            ],
          },
        },
      }),
    ])

    // junta sessões + cliques na mesma chave de origem, depois agrupa por plataforma
    const acc = new Map<string, { grupo: string; pago: boolean; sessoes: number; visitantes: number; pageViews: number; cliques: number; usuariosQueClicaram: number; origens: string[] }>()
    const vazio = (grupo: string, pago: boolean) =>
      ({ grupo, pago, sessoes: 0, visitantes: 0, pageViews: 0, cliques: 0, usuariosQueClicaram: 0, origens: [] as string[] })

    for (const r of (porFonteRaw.rows || []) as Row[]) {
      const sm = r.dimensionValues[0].value
      const { grupo, pago } = classificar(sm)
      const cur = acc.get(grupo) || vazio(grupo, pago)
      cur.sessoes += num(r.metricValues[0]?.value)
      cur.visitantes += num(r.metricValues[1]?.value)
      cur.pageViews += num(r.metricValues[2]?.value)
      if (!cur.origens.includes(sm)) cur.origens.push(sm)
      acc.set(grupo, cur)
    }

    for (const r of (cliquesPorFonteRaw.rows || []) as Row[]) {
      const sm = r.dimensionValues[0].value
      const { grupo, pago } = classificar(sm)
      const cur = acc.get(grupo) || vazio(grupo, pago)
      cur.cliques += num(r.metricValues[0]?.value)
      cur.usuariosQueClicaram += num(r.metricValues[1]?.value)
      acc.set(grupo, cur)
    }

    const porFonte = Array.from(acc.values())
      .map(f => ({
        ...f,
        // % dos visitantes daquela fonte que chegaram a clicar num botão de contato
        taxaContato: f.visitantes > 0 ? f.usuariosQueClicaram / f.visitantes : 0,
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    const totaisRow = totais.rows?.[0]?.metricValues
    const homeRow = homeRaw.rows?.[0]?.metricValues
    const totalCliques = porFonte.reduce((s, f) => s + f.cliques, 0)
    const totalUsuariosQueClicaram = porFonte.reduce((s, f) => s + f.usuariosQueClicaram, 0)

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      range: { startDate, endDate },
      totais: {
        sessoes: num(totaisRow?.[0]?.value),
        visitantes: num(totaisRow?.[1]?.value),
        pageViews: num(totaisRow?.[2]?.value),
        cliques: totalCliques,
        usuariosQueClicaram: totalUsuariosQueClicaram,
      },
      home: {
        sessoes: num(homeRow?.[0]?.value),
        visitantes: num(homeRow?.[1]?.value),
        pageViews: num(homeRow?.[2]?.value),
      },
      porFonte,
      botoes: ((botoesRaw.rows || []) as Row[]).map(r => ({
        nome: r.dimensionValues[0].value.replace('Botão_', '').replace(/_/g, ' '),
        cliques: num(r.metricValues[0]?.value),
        pessoas: num(r.metricValues[1]?.value),
      })),
      porPerfil: ((perfilRaw.rows || []) as Row[]).map(r => ({
        perfil: r.dimensionValues[0].value.replace('perfil_', ''),
        sessoes: num(r.metricValues[0]?.value),
        visitantes: num(r.metricValues[1]?.value),
      })),
    })
  } catch (error) {
    console.error('Erro ao montar o funil de tráfego (GA4):', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Google Analytics.' }, { status: 500 })
  }
}
