'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart3, TrendingUp, Settings,
  LogOut, ChevronDown, Building2, LayoutGrid, Menu, X,
  Target, Truck, UserCog
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Unidade { id: string; nome: string; cidade: string }

interface Props {
  children: React.ReactNode
  userName: string
  unidadeAtual: Unidade | null
  unidades: Unidade[]
}

const NAV = [
  { href: '/crm',               label: 'Visão Geral',    icon: LayoutDashboard },
  { href: '/crm/clientes',      label: 'Clientes',       icon: Users },
  { href: '/crm/metas',         label: 'Metas',          icon: Target },
  { href: '/crm/fornecedores',  label: 'Fornecedores',   icon: Truck },
  { href: '/crm/rh',            label: 'RH',             icon: UserCog },
  { href: '/crm/desempenho',    label: 'Desempenho',     icon: TrendingUp },
  { href: '/crm/relatorios',    label: 'Relatórios',     icon: BarChart3 },
  { href: '/crm/configuracoes', label: 'Configurações',  icon: Settings },
]

export default function CrmShell({ children, userName, unidadeAtual, unidades }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [unidadeOpen, setUnidadeOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function trocarUnidade(id: string) {
    document.cookie = `unidade_id=${id}; path=/; max-age=86400`
    setUnidadeOpen(false)
    router.refresh()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <Image src="/logo.png" alt="Danelon" width={140} height={16} className="brightness-0 invert" />
        <span className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1 block">CRM Admin</span>
      </div>

      {/* Seletor de unidade */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="relative">
          <button
            onClick={() => setUnidadeOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-left"
          >
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{unidadeAtual?.nome || 'Selecionar unidade'}</p>
              {unidadeAtual?.cidade && <p className="text-xs text-slate-400">{unidadeAtual.cidade}</p>}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${unidadeOpen ? 'rotate-180' : ''}`} />
          </button>
          {unidadeOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              {unidades.map(u => (
                <button key={u.id} onClick={() => trocarUnidade(u.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 transition-colors ${u.id === unidadeAtual?.id ? 'text-violet-400 font-semibold' : 'text-slate-300'}`}>
                  {u.nome}
                </button>
              ))}
              <div className="border-t border-slate-700">
                <button onClick={() => { setUnidadeOpen(false); router.push('/escolher-modulo') }}
                  className="w-full text-left px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5" /> Escolher módulo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/crm' ? pathname === '/crm' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Usuário */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-xs text-violet-400">Administrador</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-slate-900 flex-col">
        {sidebar}
      </aside>

      {/* Sidebar mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-slate-900 flex flex-col z-50">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setMobileOpen(true)} className="text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="Danelon" width={120} height={14} />
          <div className="w-5" />
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
