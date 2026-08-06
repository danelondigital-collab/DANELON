const SUBDOMAIN = process.env.KOMMO_SUBDOMAIN
const ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN
const PAGE_LIMIT = 250
const MAX_PAGES = 8 // teto de segurança: evita estourar o tempo da função serverless

function baseUrl() {
  return `https://${SUBDOMAIN}.kommo.com/api/v4`
}

async function fetchLeadsPage(page: number, fromUnix: number, toUnix: number) {
  const url = `${baseUrl()}/leads?limit=${PAGE_LIMIT}&page=${page}&filter[created_at][from]=${fromUnix}&filter[created_at][to]=${toUnix}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    next: { revalidate: 300 },
  })
  if (res.status === 204) return { count: 0, hasNext: false }
  if (!res.ok) throw new Error(`Erro na API do Kommo (${res.status}): ${await res.text()}`)
  const data = await res.json()
  const items = data._embedded?.leads || []
  return { count: items.length, hasNext: Boolean(data._links?.next) && items.length === PAGE_LIMIT }
}

/** Conta leads criados no período, paginando em lotes paralelos até um teto de segurança. */
export async function countNewLeads(fromUnix: number, toUnix: number): Promise<{ count: number; capped: boolean }> {
  if (!SUBDOMAIN || !ACCESS_TOKEN) {
    throw new Error('KOMMO_SUBDOMAIN e KOMMO_ACCESS_TOKEN são obrigatórios')
  }

  let total = 0
  let page = 1
  const BATCH = 4

  while (page <= MAX_PAGES) {
    const pagesToFetch = Array.from({ length: Math.min(BATCH, MAX_PAGES - page + 1) }, (_, i) => page + i)
    const results = await Promise.all(pagesToFetch.map(p => fetchLeadsPage(p, fromUnix, toUnix)))

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
