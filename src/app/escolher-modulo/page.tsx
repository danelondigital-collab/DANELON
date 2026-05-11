'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ClipboardList, LayoutDashboard, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function EscolherModuloPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'unidade_id=; path=/; max-age=0'
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/logo.png"
            alt="Danelon"
            width={180}
            height={20}
            className="brightness-0 invert opacity-90"
            priority
          />
        </div>

        <p className="text-center text-stone-400 text-sm mb-8 tracking-wide uppercase font-medium">
          Selecione o módulo
        </p>

        {/* Botões */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/selecionar-unidade')}
            className="group flex flex-col items-center gap-4 p-8 bg-white/5 hover:bg-amber-600 border border-white/10 hover:border-amber-500 rounded-2xl transition-all duration-200 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-600/20 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <ClipboardList className="w-7 h-7 text-amber-400 group-hover:text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-base text-center">Sistema de Comanda</p>
              <p className="text-stone-400 group-hover:text-white/70 text-xs text-center mt-1 transition-colors">
                Operação, agenda e atendimento
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push('/crm')}
            className="group flex flex-col items-center gap-4 p-8 bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 rounded-2xl transition-all duration-200 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-violet-600/20 group-hover:bg-white/20 flex items-center justify-center transition-colors">
              <LayoutDashboard className="w-7 h-7 text-violet-400 group-hover:text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-base text-center">CRM Admin</p>
              <p className="text-stone-400 group-hover:text-white/70 text-xs text-center mt-1 transition-colors">
                Gestão, relatórios e CRM
              </p>
            </div>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto mt-10 text-stone-500 hover:text-stone-300 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  )
}
