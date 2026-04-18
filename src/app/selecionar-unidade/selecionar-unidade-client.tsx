'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { MapPin, ChevronRight, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Acesso {
  unidade_id: string
  perfil: string
  unidade: {
    id: string
    nome: string
    cidade: string
    telefone?: string
  }
}

interface Props {
  acessos: Acesso[]
  usuario: { nome: string; perfil: string } | null
}

const perfilLabel: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  recepcionista: 'Recepcionista',
}

export default function SelecionarUnidadeClient({ acessos, usuario }: Props) {
  const router = useRouter()
  const supabase = createClient()

  function selecionar(unidadeId: string) {
    document.cookie = `unidade_id=${unidadeId}; path=/; max-age=86400`
    router.push('/dashboard')
    router.refresh()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-pink-50">
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-6">
              <Image
                src="/logo.png"
                alt="Danelon"
                width={200}
                height={22}
                priority
              />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Olá, {usuario?.nome || 'Usuário'}!
            </h1>
            <p className="text-gray-500 text-sm mt-1">Selecione a unidade para continuar</p>
          </div>

          <div className="space-y-2">
            {acessos.map((acesso) => (
              <button
                key={acesso.unidade_id}
                onClick={() => selecionar(acesso.unidade_id)}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all group text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <MapPin className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{acesso.unidade.nome}</p>
                  <p className="text-xs text-gray-500">{acesso.unidade.cidade} · {perfilLabel[acesso.perfil] || acesso.perfil}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
