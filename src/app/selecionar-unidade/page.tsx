import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SelecionarUnidadeClient from './selecionar-unidade-client'

export default async function SelecionarUnidadePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: acessos } = await supabase
    .from('usuario_unidades')
    .select('*, unidade:unidades(*)')
    .eq('usuario_id', user.id)
    .order('created_at')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nome, perfil')
    .eq('id', user.id)
    .single()

  if (!acessos || acessos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-pink-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-500">Nenhuma unidade disponível para seu usuário.</p>
          <p className="text-sm text-gray-400 mt-2">Contate o administrador do sistema.</p>
        </div>
      </div>
    )
  }

  if (acessos.length === 1) {
    redirect(`/dashboard?unidade=${acessos[0].unidade_id}`)
  }

  return <SelecionarUnidadeClient acessos={acessos} usuario={usuario} />
}
