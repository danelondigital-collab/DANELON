import { NextRequest, NextResponse } from 'next/server'
import { runReport, DEFAULT_START, DEFAULT_END } from '@/lib/ga4'
import { base, BOTAO } from '@/lib/funil-ga4'

export const dynamic = 'force-dynamic'

function num(v: string | undefined) {
  return Number(v || 0)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Agrupa o "origem / meio" cru do GA4 nas plataformas que a DANELON usa.
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

/** Nome amigável da plataforma do link de bio (o utm_source do link curto). */
const PLATAFORMA_BIO: Record<string, string> = {
  instagram: 'Instagram',
  ig: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
}

interface Row {
  dimensionValues: { value: string }[]
  metricValues: { value: string }[]
}

/**
 * Páginas dedicadas dos links de bio do TikTok. Foram criadas como páginas
 * próprias (e não como redirecionamento com utm), então não chegam com
 * medium=bio como as do Instagram — a única forma de identificá-las é pela
 * página de entrada.
 */
const PAGINAS_BIO_TIKTOK: Record<string, string> = {
  '/tiktok': 'danelonoficial',
  '/tiktok/': 'danelonoficial',
  '/tiktok-elaine': 'elainedanelon',
  '/tiktok-elaine/': 'elainedanelon',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const startDate = startParam && DATE_RE.test(startParam) ? startParam : DEFAULT_START
    const endDate = endParam && DATE_RE.test(endParam) ? endParam : DEFAULT_END
    const dateRanges = [{ startDate, endDate }]

    const [
      totais, porFonteRaw, cliquesPorFonteRaw, botoesRaw, perfilRaw, homeRaw,
      cliquesTotalRaw, bioTikTokRaw, paginasBioRaw,
    ] = await Promise.all([
      // topo do funil, sem fatiar
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: base(),
      }),
      // sessões, visitantes e visualizações por origem
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: base(),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '40',
      }),
      // quem clicou em botão de contato, por origem -- é o que liga o topo
      // (visita) ao fundo (conversa), e revela a qualidade de cada fonte
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: base(BOTAO),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '40',
      }),
      // cliques por botão (qual unidade a pessoa procurou)
      runReport({
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: base(BOTAO),
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: '20',
      }),
      // link na bio por perfil (utm_campaign) e por plataforma (utm_source).
      // A plataforma entra como dimensão porque o mesmo perfil pode ter link de
      // bio no Instagram e no TikTok — sem ela os dois viram um número só.
      runReport({
        dateRanges,
        dimensions: [{ name: 'sessionCampaignName' }, { name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: base({
          filter: { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT' as const, value: 'bio' } },
        }),
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '30',
      }),
      // a home (elainedanelon.com.br/) isolada: é a página que está no link da
      // bio de todos os perfis, então é nela que o tráfego de Instagram cai
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        dimensionFilter: base({
          filter: { fieldName: 'landingPage', stringFilter: { matchType: 'EXACT' as const, value: '/' } },
        }),
      }),
      // Pessoas DISTINTAS que clicaram em qualquer botão de contato — sem
      // nenhuma dimensão de propósito. "Usuários" não é somável: quem clica em
      // Morumbi e em Goiânia aparece nas duas linhas, então somar as linhas por
      // botão inflava o total em mais de 4x (22.630 contra 5.364 reais).
      // Serve tanto pro funil quanto pro card de ranking: os dois olham a mesma
      // população (sem TikTok pago), então o número é o mesmo.
      runReport({
        dateRanges,
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: base(BOTAO),
      }),
      // links de bio do TikTok: identificados pela página de entrada, porque
      // foram criados como páginas próprias e não carregam utm. Sessão sem
      // origem ("(not set)" / "(data not available)") fica de fora: nessas
      // páginas ela só aparece junto com campanha paga apontada pra elas
      // (0% de engajamento), não com gente vindo do perfil.
      runReport({
        dateRanges,
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: base(
          {
            filter: {
              fieldName: 'landingPage',
              inListFilter: { values: Object.keys(PAGINAS_BIO_TIKTOK) },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'sessionSource',
                inListFilter: { values: ['(not set)', '(data not available)'] },
              },
            },
          },
        ),
        limit: '10',
      }),
      // Total das páginas de entrada do link na bio: a home (onde caem os links
      // do Instagram) + as páginas do TikTok. Só a home não servia de total pra
      // lista de perfis — os links do TikTok caem em outra página, então a lista
      // chegava a somar mais que o "total". Sem dimensão: pessoa distinta de
      // verdade. Nas páginas do TikTok aplica a mesma exclusão de sessão sem
      // origem da lista por perfil, pra os dois números olharem a mesma coisa.
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: base({
          orGroup: {
            expressions: [
              { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'EXACT' as const, value: '/' } } },
              {
                andGroup: {
                  expressions: [
                    { filter: { fieldName: 'landingPage', inListFilter: { values: Object.keys(PAGINAS_BIO_TIKTOK) } } },
                    {
                      notExpression: {
                        filter: { fieldName: 'sessionSource', inListFilter: { values: ['(not set)', '(data not available)'] } },
                      },
                    },
                  ],
                },
              },
            ],
          },
        }),
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
    const paginasBioRow = paginasBioRaw.rows?.[0]?.metricValues
    // Vem da consulta sem dimensão: é gente distinta de verdade, não a soma das
    // linhas por fonte (que contava duas vezes quem visitou por origens diferentes).
    const cliquesTotalRow = cliquesTotalRaw.rows?.[0]?.metricValues
    const totalCliques = num(cliquesTotalRow?.[0]?.value)
    const totalUsuariosQueClicaram = num(cliquesTotalRow?.[1]?.value)

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
      paginasBio: {
        sessoes: num(paginasBioRow?.[0]?.value),
        visitantes: num(paginasBioRow?.[1]?.value),
      },
      porFonte,
      botoes: ((botoesRaw.rows || []) as Row[]).map(r => ({
        nome: r.dimensionValues[0].value.replace('Botão_', '').replace(/_/g, ' '),
        cliques: num(r.metricValues[0]?.value),
        pessoas: num(r.metricValues[1]?.value),
      })),
      /** total que casa com a lista de botões acima (sem nenhum TikTok pago) */
      botoesTotal: { cliques: totalCliques, pessoas: totalUsuariosQueClicaram },
      porPerfil: (() => {
        // Instagram: identificado pela etiqueta (utm_campaign + utm_source)
        const perfis = ((perfilRaw.rows || []) as Row[]).map(r => ({
          perfil: r.dimensionValues[0].value.replace('perfil_', ''),
          fonte: PLATAFORMA_BIO[r.dimensionValues[1]?.value?.toLowerCase()] || r.dimensionValues[1]?.value || '—',
          sessoes: num(r.metricValues[0]?.value),
          visitantes: num(r.metricValues[1]?.value),
        }))

        // TikTok: identificado pela página de entrada. Como /tiktok e /tiktok/
        // são a mesma coisa pro GA4, agrupa antes de somar.
        const tiktok = new Map<string, { sessoes: number; visitantes: number }>()
        for (const r of (bioTikTokRaw.rows || []) as Row[]) {
          const perfil = PAGINAS_BIO_TIKTOK[r.dimensionValues[0].value]
          if (!perfil) continue
          const cur = tiktok.get(perfil) || { sessoes: 0, visitantes: 0 }
          cur.sessoes += num(r.metricValues[0]?.value)
          cur.visitantes += num(r.metricValues[1]?.value)
          tiktok.set(perfil, cur)
        }
        for (const [perfil, v] of tiktok) {
          perfis.push({ perfil, fonte: 'TikTok', sessoes: v.sessoes, visitantes: v.visitantes })
        }

        return perfis.sort((a, b) => b.sessoes - a.sessoes)
      })(),
    })
  } catch (error) {
    console.error('Erro ao montar o funil de tráfego (GA4):', error)
    return NextResponse.json({ error: 'Não foi possível carregar os dados do Google Analytics.' }, { status: 500 })
  }
}
