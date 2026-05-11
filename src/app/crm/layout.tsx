import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import CrmShell from '@/components/crm/CrmShell'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const unidadeId = cookieStore.get('unidade_id')?.value
  if (!unidadeId) redirect('/selecionar-unidade')
  // 'all' is a valid value meaning "Todas as Unidades"

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome, perfil, ativo')
    .eq('id', user.id)
    .single()

  if (usuario?.perfil !== 'admin') redirect('/dashboard')

  const { data: unidades } = await supabase
    .from('unidades')
    .select('id, nome, cidade')
    .eq('ativo', true)
    .order('nome')

  const unidadeAtual = (unidades || []).find(u => u.id === unidadeId) || null

  return (
    <CrmShell
      userName={usuario.nome || user.email || ''}
      unidadeAtual={unidadeAtual}
      unidades={unidades || []}
    >
      {children}
    </CrmShell>
  )
}
