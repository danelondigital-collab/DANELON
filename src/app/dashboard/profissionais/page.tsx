import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ProfissionaisClient from './profissionais-client'

export default async function ProfissionaisPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const { data: profissionais } = await supabase
    .from('profissionais')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('nome')

  return <ProfissionaisClient profissionais={profissionais || []} unidadeId={unidadeId} />
}
