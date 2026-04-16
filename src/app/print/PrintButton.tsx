'use client'

import { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

export default function PrintButton({ titulo }: { titulo: string }) {
  useEffect(() => {
    // Pequeno delay para garantir que a página renderizou
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="print:hidden fixed bottom-6 right-6 flex gap-2 z-50">
      <button
        onClick={() => window.close()}
        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg shadow-md transition-colors"
      >
        <X className="w-4 h-4" />
        Fechar
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-md transition-colors"
        style={{ backgroundColor: '#B8924A' }}
      >
        <Printer className="w-4 h-4" />
        Imprimir / PDF
      </button>
    </div>
  )
}
