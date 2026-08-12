const SUBDOMAIN = process.env.KOMMO_SUBDOMAIN
const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN
const PAGE_LIMIT = 250
const MAX_PAGES = 12 // teto de segurança: evita estourar o tempo da função serverless

type Entity = 'leads' | 'contacts'

function baseUrl() {
  return `https://${SUBDOMAIN}.kommo.com/api/v4`
}

async function fetchPage(entity: Entity, page: number, fromUnix: number, toUnix: number) {
  const url = `${baseUrl()}/${entity}?limit=${PAGE_LIMIT}&page=${page}&filter[created_at][from]=${fromUnix}&filter[created_at][to]=${toUnix}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    next: { revalidate: 300 },
  })
  if (res.status === 204) return { count: 0, hasNext: false }
  if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
  const data = await res.json()
  const items = data._embedded?.[entity] || []
  return { count: items.length, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
}

/** Conta registros criados no período, paginando em lotes paralelos até um teto de segurança. */
async function countNewInRange(entity: Entity, fromUnix: number, toUnix: number): Promise<{ count: number; capped: boolean }> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  let total = 0
  let page = 1
  const BATCH = 4

  while (page <= MAX_PAGES) {
    const pagesToFetch = Array.from({ length: Math.min(BATCH, MAX_PAGES - page + 1) }, (_, i) => page + i)
    const results = await Promise.all(pagesToFetch.map(p => fetchPage(entity, p, fromUnix, toUnix)))

    for (const r of results) total += r.count

    const lastFullBatch = results.every(r => r.count === PAGE_LIMIT)
    const anyHasNext = results[results.length - 1]?.hasNext

    if (!lastFullBatch || !anyHasNext) {
      return { count: total, capped: false }
    }

    page += pagesToFetch.length
  }

  return { count: total, capped: true }
}

export function countNewLeads(fromUnix: number, toUnix: number) {
  return countNewInRange('leads', fromUnix, toUnix)
}

export function countNewContacts(fromUnix: number, toUnix: number) {
  return countNewInRange('contacts', fromUnix, toUnix)
}

// Volume de "unsorted" (conversas recebidas ainda não triadas) é alto demais pra
// paginar tudo em períodos largos — mantemos um teto baixo (a função serverless no
// plano atual da Vercel corta em ~10s) e sinalizamos "capped" quando bate nele.
// Cada página desse endpoint específico do Kommo é lenta (~5-7s, mesmo sozinha),
// bem diferente de /leads e /contacts — por isso o teto aqui é bem mais conservador.
const UNSORTED_MAX_PAGES = 3 // 3 x 250 = até 750 conversas no período, tudo em 1 rodada paralela

const CHANNEL_BY_SERVICE: Record<string, string> = {
  waba: 'WhatsApp',
  instagram_business: 'Instagram',
  tiktok_kommo: 'TikTok',
  facebook: 'Facebook',
}

const UNIDADES = ['Santo André', 'Morumbi', 'Alphaville', 'Goiânia'] as const
const OUTRA_UNIDADE = 'Geral / outros'

function unidadeFromSourceName(sourceName: string | undefined): string {
  const s = (sourceName || '').toLowerCase()
  if (s.includes('santo')) return 'Santo André'
  if (s.includes('morumbi')) return 'Morumbi'
  if (s.includes('alphaville')) return 'Alphaville'
  if (s.includes('goi')) return 'Goiânia'
  return OUTRA_UNIDADE
}

interface UnsortedItem {
  metadata?: { service?: string; source_name?: string }
}

async function fetchUnsortedPage(page: number) {
  const url = `${baseUrl()}/leads/unsorted?limit=${PAGE_LIMIT}&page=${page}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    next: { revalidate: 300 },
  })
  if (res.status === 204) return { items: [] as UnsortedItem[], hasNext: false }
  if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
  const data = await res.json()
  const items = (data._embedded?.unsorted || []) as UnsortedItem[]
  return { items, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
}

/**
 * Distribuição canal x unidade das conversas recebidas mais recentes.
 * NÃO usa o filtro de período da página: o volume de mensagens (principalmente
 * WhatsApp) é tão alto que ~750 conversas já cobrem só 1-2 dias — ou seja, pra
 * praticamente qualquer período escolhido o resultado seria o mesmo de qualquer
 * forma. Fica como "as mais recentes", deixado explícito na UI.
 */
export async function channelsByUnidade(): Promise<{
  matrix: Record<string, Record<string, number>>
  channels: string[]
  unidades: string[]
  sampled: number
}> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  const unidades = [...UNIDADES, OUTRA_UNIDADE]
  const channels = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Outro']
  const matrix: Record<string, Record<string, number>> = {}
  for (const u of unidades) matrix[u] = Object.fromEntries(channels.map(c => [c, 0]))

  const pages = await Promise.all(
    Array.from({ length: UNSORTED_MAX_PAGES }, (_, i) => fetchUnsortedPage(i + 1))
  )
  const items = pages.flatMap(p => p.items)

  for (const item of items) {
    const unidade = unidadeFromSourceName(item.metadata?.source_name)
    const canal = CHANNEL_BY_SERVICE[item.metadata?.service || ''] || 'Outro'
    matrix[unidade][canal] += 1
  }

  return { matrix, channels, unidades, sampled: items.length }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDateRange(start: string | null, end: string | null) {
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('BAD_REQUEST: Parâmetros start/end (yyyy-mm-dd) são obrigatórios.')
  }
  return {
    fromUnix: Math.floor(new Date(`${start}T00:00:00-03:00`).getTime() / 1000),
    toUnix: Math.floor(new Date(`${end}T23:59:59-03:00`).getTime() / 1000),
  }
}

/** Valida start/end (yyyy-mm-dd) e conta o tipo de registro pedido no período. */
export async function countForRoute(entity: Entity, start: string | null, end: string | null) {
  const { fromUnix, toUnix } = parseDateRange(start, end)
  return countNewInRange(entity, fromUnix, toUnix)
}
