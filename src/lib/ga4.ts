const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REPORT_URL = (propertyId: string) =>
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
    body: new URLSearchParams({
      client_id: process.env.GA4_CLIENT_ID!,
      client_secret: process.env.GA4_CLIENT_SECRET!,
      refresh_token: process.env.GA4_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new Error(`Falha ao renovar token do GA4 (${res.status}): ${await res.text()}`)
  }

  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.value
}

export async function runReport(body: Record<string, unknown>) {
  const propertyId = process.env.GA4_PROPERTY_ID!
  const token = await getAccessToken()

  const res = await fetch(REPORT_URL(propertyId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    next: { revalidate: 300 },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Erro na API do GA4 (${res.status}): ${await res.text()}`)
  }

  return res.json()
}

export function hostFilter() {
  return {
    filter: {
      fieldName: 'hostName',
      stringFilter: { matchType: 'EXACT' as const, value: process.env.GA4_SITE_HOST || 'elainedanelon.com.br' },
    },
  }
}

export function hostAndButtonClicksFilter() {
  return {
    andGroup: {
      expressions: [
        hostFilter(),
        {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'BEGINS_WITH' as const, value: 'Botão' },
          },
        },
      ],
    },
  }
}

export const DATE_RANGE_28D = [{ startDate: '28daysAgo', endDate: 'yesterday' }]
