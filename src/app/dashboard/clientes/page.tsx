export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ClientesClient from './clientes-client'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!
  const { q } = await searchParams

  let query = supabase
    .from('clientes')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('nome')
    .limit(100)

  if (q && q.trim()) {
    query = supabase
      .from('clientes')
      .select('*')
      .eq('unidade_id', unidadeId)
      .or(`nome.ilike.%${q.trim()}%,telefone.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
      .order('nome')
      .limit(100)
  }

  const { data: clientes } = await query

  return <ClientesClient clientes={clientes || []} unidadeId={unidadeId} busca={q || ''} />
}
