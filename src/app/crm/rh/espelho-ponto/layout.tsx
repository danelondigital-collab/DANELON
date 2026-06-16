import Link from 'next/link'
import { Clock, ArrowLeft } from 'lucide-react'

export default function EspelhoPontoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/crm/rh" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <Clock className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Espelho de Ponto</h1>
          <p className="text-sm text-slate-500">Importação e análise de registros por profissional</p>
        </div>
      </div>
      {children}
    </div>
  )
}
