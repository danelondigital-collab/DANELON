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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Valida start/end (yyyy-mm-dd) e conta o tipo de registro pedido no período. */
export async function countForRoute(entity: Entity, start: string | null, end: string | null) {
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error('BAD_REQUEST: Parâmetros start/end (yyyy-mm-dd) são obrigatórios.')
  }
  const fromUnix = Math.floor(new Date(`${start}T00:00:00-03:00`).getTime() / 1000)
  const toUnix = Math.floor(new Date(`${end}T23:59:59-03:00`).getTime() / 1000)
  return countNewInRange(entity, fromUnix, toUnix)
}
