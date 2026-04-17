'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Scissors,
  Package,
  CalendarDays,
  ClipboardList,
  BarChart3,
  LogOut,
  ChevronDown,
  Building2,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Unidade } from '@/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users, adminOnly: false },
  { href: '/dashboard/profissionais', label: 'Profissionais', icon: UserCog, adminOnly: false },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Scissors, adminOnly: false },
  { href: '/dashboard/produtos', label: 'Produtos', icon: Package, adminOnly: false },
  { href: '/dashboard/agenda', label: 'Agenda', icon: CalendarDays, adminOnly: false },
  { href: '/dashboard/comandas', label: 'Comandas', icon: ClipboardList, adminOnly: false },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart3, adminOnly: true },
  { href: '/dashboard/usuarios', label: 'Usuários', icon: ShieldCheck, adminOnly: true },
]

interface Props {
  unidade: Unidade
  unidades: { id: string; nome: string; cidade: string }[]
  userName: string
  perfil: string
  onClose?: () => void
}

export default function Sidebar({ unidade, unidades, userName, perfil, onClose }: Props) {
  const isAdmin = perfil === 'admin'
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function trocarUnidade(novaUnidadeId: string) {
    document.cookie = `unidade_id=${novaUnidadeId}; path=/; max-age=86400`
    setDropdownAberto(false)
    router.push('/dashboard')
    router.refresh()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'unidade_id=; path=/; max-age=0'
    router.push('/auth/login')
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-screen sticky top-0" style={{ backgroundColor: '#1C1917' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="Danelon"
          width={140}
          height={16}
          className="brightness-0 invert opacity-90"
          priority
        />
      </div>

      {/* Seletor de unidade */}
      <div className="mx-3 mt-3 relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownAberto(prev => !prev)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left border border-white/10"
        >
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#B8924A' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/90 truncate">{unidade.nome}</p>
            <p className="text-xs text-white/40">{unidade.cidade}</p>
          </div>
          <ChevronDown className={cn(
            'w-3 h-3 text-white/40 flex-shrink-0 transition-transform',
            dropdownAberto && 'rotate-180'
          )} />
        </button>

        {dropdownAberto && unidades.length > 1 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-white/10 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
            {unidades.map(u => (
              <button
                key={u.id}
                onClick={() => trocarUnidade(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/90 truncate">{u.nome}</p>
                  <p className="text-xs text-white/40">{u.cidade}</p>
                </div>
                {u.id === unidade.id && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#B8924A' }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive ? 'text-white font-medium' : 'text-white/50 hover:text-white/80 hover:bg-white/8'
              )}
              style={isActive ? { backgroundColor: '#B8924A' } : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-white/80 truncate">{userName}</p>
          <span className={cn(
            'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5',
            isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/40'
          )}>
            {isAdmin ? 'Administrador' : 'Operador'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
