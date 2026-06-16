export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserCog, Clock } from 'lucide-react'

export default function RhPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <UserCog className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">RH</h1>
          <p className="text-sm text-slate-500">Gestão de recursos humanos e equipe.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/crm/rh/espelho-ponto"
          className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-violet-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
            <Clock className="w-5 h-5 text-violet-600" />
          </div>
          <h2 className="font-bold text-slate-800 mb-1">Espelho de Ponto</h2>
          <p className="text-sm text-slate-500">Importe e analise os registros de ponto por profissional. Acompanhe atrasos e faltas.</p>
        </Link>
      </div>
    </div>
  )
}
