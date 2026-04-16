export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ProdutosClient from './produtos-client'

export default async function ProdutosPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const { data: produtos } = await supabase
    .from('produtos')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('nome')

  return <ProdutosClient produtos={produtos || []} unidadeId={unidadeId} />
}
