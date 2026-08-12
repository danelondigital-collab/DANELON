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
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      next: { revalidate: 300 },
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    if (res.status === 204) return { count: 0, hasNext: false }
    if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const items = data._embedded?.[entity] || []
    return { count: items.length, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
  }
  throw new Error('Erro na API do Kommo: limite de requisições (429) excedido repetidamente')
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

// O endpoint /leads/unsorted da Kommo IGNORA filter[created_at] (confirmado testando
// direto na API: pedir um período de 2025 continua devolvendo as conversas de hoje).
// Não tem como filtrar por data no servidor aqui — a única forma correta é paginar a
// lista (que vem sempre em ordem decrescente de criação) e parar manualmente quando
// os itens caem abaixo do início do período pedido. Teto de segurança pra não rodar
// pra sempre se o período pedido for muito largo.
const UNSORTED_SAFETY_MAX_PAGES = 30

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
  created_at?: number
  metadata?: { service?: string; source_name?: string }
}

/** Busca uma página "crua" da lista (sem filtro de data — a API ignora esse filtro nesse endpoint). */
async function fetchUnsortedPage(page: number): Promise<{ items: UnsortedItem[]; hasNext: boolean }> {
  const url = `${baseUrl()}/leads/unsorted?limit=${PAGE_LIMIT}&page=${page}`
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      cache: 'no-store',
    })
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    if (res.status === 204) return { items: [], hasNext: false }
    if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const items = (data._embedded?.unsorted || []) as UnsortedItem[]
    return { items, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
  }
  throw new Error('Erro na API do Kommo: limite de requisições (429) excedido repetidamente')
}

/**
 * Distribuição canal x unidade das conversas recebidas no período informado.
 * Como a API não filtra por data nesse endpoint, pagina a lista completa (mais
 * recente primeiro) e para assim que os itens saem do período pedido — só soma
 * o que realmente cai dentro de [fromUnix, toUnix]. Se bater no teto de segurança
 * antes de sair do período, volta marcado como "capped" (contagem parcial).
 */
export async function channelsByUnidade(fromUnix: number, toUnix: number): Promise<{
  matrix: Record<string, Record<string, number>>
  channels: string[]
  unidades: string[]
  sampled: number
  capped: boolean
}> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  const unidades = [...UNIDADES, OUTRA_UNIDADE]
  const channels = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Outro']
  const matrix: Record<string, Record<string, number>> = {}
  for (const u of unidades) matrix[u] = Object.fromEntries(channels.map(c => [c, 0]))

  let sampled = 0
  let capped = false
  const t0 = Date.now()
  // Teto de tempo (bem abaixo do maxDuration=60s da rota) pra sempre devolver uma
  // resposta válida em vez de deixar a Vercel matar a função com timeout no meio.
  const TIME_BUDGET_MS = 45_000

  for (let page = 1; page <= UNSORTED_SAFETY_MAX_PAGES; page++) {
    const { items, hasNext } = await fetchUnsortedPage(page)
    if (items.length === 0) break

    let crossedLowerBound = false
    for (const item of items) {
      const createdAt = item.created_at ?? 0
      if (createdAt > toUnix) continue // ainda não entrou no período (mais recente que "até")
      if (createdAt < fromUnix) { crossedLowerBound = true; break } // já passou do início do período

      sampled += 1
      const unidade = unidadeFromSourceName(item.metadata?.source_name)
      const canal = CHANNEL_BY_SERVICE[item.metadata?.service || ''] || 'Outro'
      matrix[unidade][canal] += 1
    }

    if (crossedLowerBound) break
    if (!hasNext) break
    if (page === UNSORTED_SAFETY_MAX_PAGES || Date.now() - t0 > TIME_BUDGET_MS) {
      capped = true
      break
    }
  }

  return { matrix, channels, unidades, sampled, capped }
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

/** Valida start/end (yyyy-mm-dd) e busca a distribuição canal x unidade no período. */
export async function canaisForRoute(start: string | null, end: string | null) {
  const { fromUnix, toUnix } = parseDateRange(start, end)
  return channelsByUnidade(fromUnix, toUnix)
}
