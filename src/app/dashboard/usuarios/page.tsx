export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UsuariosClient from './usuarios-client'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: me } = await supabase.from('usuarios').select('perfil').eq('id', user.id).single()
  if (me?.perfil !== 'admin') redirect('/dashboard')

  const { data: unidades } = await supabase
    .from('unidades')
    .select('id, nome, cidade')
    .eq('ativo', true)
    .order('nome')

  return <UsuariosClient unidades={unidades || []} />
}
