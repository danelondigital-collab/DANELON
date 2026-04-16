import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const unidadeId = cookieStore.get('unidade_id')?.value
  if (!unidadeId) redirect('/selecionar-unidade')

  const { data: unidade } = await supabase
    .from('unidades')
    .select('*')
    .eq('id', unidadeId)
    .single()

  if (!unidade) redirect('/selecionar-unidade')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome, perfil')
    .eq('id', user.id)
    .single()

  const { data: acessos } = await supabase
    .from('usuario_unidades')
    .select('unidade_id, unidade:unidades(id, nome, cidade)')
    .eq('usuario_id', user.id)

  const unidades = (acessos || [])
    .map((a: { unidade_id: string; unidade: unknown }) => a.unidade)
    .filter(Boolean) as { id: string; nome: string; cidade: string }[]

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      <Sidebar
        unidade={unidade}
        unidades={unidades}
        userName={usuario?.nome || user.email || ''}
      />
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {children}
      </main>
    </div>
  )
}
