'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import type { Unidade } from '@/types'

interface Props {
  unidade: Unidade
  unidades: { id: string; nome: string; cidade: string }[]
  userName: string
  children: React.ReactNode
}

export default function DashboardShell({ unidade, unidades, userName, children }: Props) {
  const [sidebarAberto, setSidebarAberto] = useState(false)

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F5F3EE' }}>
      {/* Overlay escuro no mobile */}
      {sidebarAberto && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarAberto(false)}
        />
      )}

      {/* Sidebar — drawer no mobile, fixo no desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transition-transform duration-300
        md:relative md:translate-x-0 md:flex-shrink-0
        ${sidebarAberto ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          unidade={unidade}
          unidades={unidades}
          userName={userName}
          onClose={() => setSidebarAberto(false)}
        />
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col min-w-0">
        {/* Barra superior mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20 flex-shrink-0">
          <button
            onClick={() => setSidebarAberto(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#B8924A' }}>
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Danelon</span>
          </div>
          <span className="ml-auto text-xs text-gray-400 truncate max-w-[140px]">{unidade.nome}</span>
        </div>

        {children}
      </main>
    </div>
  )
}
