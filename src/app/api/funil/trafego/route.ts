import { NextRequest, NextResponse } from 'next/server'
import { runReport, hostFilter, DEFAULT_START, DEFAULT_END } from '@/lib/ga4'

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

/**
 * Todo o tráfego pago do TikTok fica fora deste relatório.
 *
 * Por quê: essas sessões clicam em 4 a 5 botões diferentes cada uma, contra
 * ~1,2 de qualquer outra origem, e respondem por 97% dos cliques do site. O
 * volume também é desproporcional — 98% das sessões — então qualquer quadro
 * que as inclua vira um retrato do TikTok, não do negócio.
 *
 * O que NÃO se pode concluir daí é que seja tráfego falso: engajamento de
 * 43,5% e 88s de permanência são de gente real (tráfego de robô fica em ~0%,
 * como a linha "(not set)" do próprio relatório). O padrão de recarregar a
 * mesma página 1,8 vez por sessão sugere que o link do WhatsApp não abre pelo
 * navegador interno do TikTok e a pessoa fica tentando outro botão — problema
 * a investigar no site, não no relatório.
 *
 * O gasto continua visível na seção de investimento, marcado como fora do
 * funil. TikTok orgânico (link na bio, perfil) não é afetado: o filtro só pega
 * mídia paga.
 */
const SEM_TIKTOK_PAGO = {
  notExpression: {
    filter: {
      fieldName: 'sessionSourceMedium',
      stringFilter: { matchType: 'FULL_REGEXP' as const, value: '^tiktok / (paid|cpc|ppc).*' },
    },
  },
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

type Expressao = Record<string, unknown>

/** Host + fora o TikTok pago: é a base de TODO número deste relatório. */
function base(...extras: Expressao[]) {
  return { andGroup: { expressions: [hostFilter(), SEM_TIKTOK_PAGO, ...extras] } }
}

/** Só os eventos de clique em botão de contato. */
const BOTAO = {
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'BEGINS_WITH' as const, value: 'Botão' } },
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
      cliquesTotalRaw, tiktokQueClicouRaw, bioTikTokRaw,
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
      // A home (elainedanelon.com.br/) isolada. Este é o único quadro que conta
      // TODAS as fontes, TikTok pago incluído: ele se chama "total da página",
      // então excluir alguém aqui seria mentir sobre o que a página recebeu.
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
      // TikTok pago, mas SÓ quem chegou a clicar num botão de contato.
      // É essa fatia que volta pro relatório: das ~92 mil sessões que a fonte
      // traz, as que demonstraram alguma intenção. O resto (visita que não
      // clicou) fica de fora porque é volume demais pra comparar com qualquer
      // outra origem — 98% das sessões do site.
      runReport({
        dateRanges,
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              hostFilter(),
              {
                filter: {
                  fieldName: 'sessionSourceMedium',
                  stringFilter: { matchType: 'FULL_REGEXP' as const, value: '^tiktok / (paid|cpc|ppc).*' },
                },
              },
              BOTAO,
            ],
          },
        },
      }),
      // links de bio do TikTok: identificados pela página de entrada, porque
      // foram criados como páginas próprias e não carregam utm
      runReport({
        dateRanges,
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        dimensionFilter: base({
          filter: {
            fieldName: 'landingPage',
            inListFilter: { values: Object.keys(PAGINAS_BIO_TIKTOK) },
          },
        }),
        limit: '10',
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

    // A fatia do TikTok pago que clicou entra como uma fonte própria. Ela conta
    // PESSOAS, não sessões: o problema dessa fonte é a mesma pessoa gerar várias
    // sessões (recarrega a página 1,8 vez por sessão), e pessoa única não carrega
    // essa inflação.
    const ttRow = tiktokQueClicouRaw.rows?.[0]?.metricValues
    const ttPessoas = num(ttRow?.[1]?.value)
    if (ttPessoas > 0) {
      acc.set('TikTok Ads', {
        grupo: 'TikTok Ads',
        pago: true,
        sessoes: num(ttRow?.[0]?.value),
        visitantes: ttPessoas,
        pageViews: 0, // não dá pra recortar "visualização de quem clicou"
        cliques: num(ttRow?.[2]?.value),
        usuariosQueClicaram: ttPessoas,
        origens: ['tiktok / paid'],
      })
    }

    const porFonte = Array.from(acc.values())
      .map(f => ({
        ...f,
        // % dos visitantes daquela fonte que chegaram a clicar num botão de contato
        taxaContato: f.visitantes > 0 ? f.usuariosQueClicaram / f.visitantes : 0,
        // no TikTok pago a linha já entra filtrada por quem clicou, então a taxa
        // dá 100% por construção e não se compara com a das outras fontes
        somenteQuemClicou: f.grupo === 'TikTok Ads',
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    const totaisRow = totais.rows?.[0]?.metricValues
    const homeRow = homeRaw.rows?.[0]?.metricValues
    // Vem da consulta sem dimensão: é gente distinta de verdade, não a soma das
    // linhas por fonte (que contava duas vezes quem visitou por origens diferentes).
    const cliquesTotalRow = cliquesTotalRaw.rows?.[0]?.metricValues
    const totalCliques = num(cliquesTotalRow?.[0]?.value)
    const totalUsuariosQueClicaram = num(cliquesTotalRow?.[1]?.value)

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      range: { startDate, endDate },
      totais: {
        // visitas e pessoas somam a fatia do TikTok que clicou; visualizações
        // não, porque o GA4 não dá como recortar "views de quem clicou"
        sessoes: num(totaisRow?.[0]?.value) + num(ttRow?.[0]?.value),
        visitantes: num(totaisRow?.[1]?.value) + ttPessoas,
        pageViews: num(totaisRow?.[2]?.value),
        cliques: totalCliques + num(ttRow?.[2]?.value),
        usuariosQueClicaram: totalUsuariosQueClicaram + ttPessoas,
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
