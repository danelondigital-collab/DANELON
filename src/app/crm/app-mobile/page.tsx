export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Smartphone } from 'lucide-react'
import AppMobileClient from './app-mobile-client'

export default async function AppMobilePage() {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('profissionais')
    .select('id, nome, telefone, email, app_acesso, app_email, unidade_id, unidades(nome)')
    .eq('ativo', true)
    .order('nome')

  const profissionais = (raw || []).map(p => ({
    id: p.id,
    nome: p.nome,
    telefone: p.telefone ?? null,
    email: p.email ?? null,
    app_acesso: (p as any).app_acesso ?? false,
    app_email: (p as any).app_email ?? null,
    unidade_nome: (p.unidades as unknown as { nome: string } | null)?.nome ?? '',
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">App Mobile</h1>
          <p className="text-sm text-slate-500">Gerencie o acesso das profissionais ao aplicativo Danelon.</p>
        </div>
      </div>

      <AppMobileClient profissionais={profissionais} />
    </div>
  )
}
