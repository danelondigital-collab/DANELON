export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ProfissionaisClient from './profissionais-client'

export default async function ProfissionaisPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const unidadeId = cookieStore.get('unidade_id')?.value!

  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuario } = user
    ? await supabase.from('usuarios').select('perfil').eq('id', user.id).single()
    : { data: null }
  const perfil = usuario?.perfil || 'operador'

  const { data: profissionais } = await supabase
    .from('profissionais')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('nome')

  return <ProfissionaisClient profissionais={profissionais || []} unidadeId={unidadeId} perfil={perfil} />
}
