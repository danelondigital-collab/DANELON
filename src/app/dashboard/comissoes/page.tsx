export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ComissoesClient from './comissoes-client'

export default async function ComissoesPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const { data: profissionais } = await supabase
    .from('profissionais')
    .select('*')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('nome')

  return (
    <ComissoesClient
      profissionais={profissionais || []}
      unidadeId={unidadeId}
    />
  )
}
