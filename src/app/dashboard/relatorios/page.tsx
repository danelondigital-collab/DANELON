export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import RelatoriosClient from './relatorios-client'

export default async function RelatoriosPage() {
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
    <RelatoriosClient
      profissionais={profissionais || []}
      unidadeId={unidadeId}
    />
  )
}
