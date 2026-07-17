'use client'

import { useEffect } from 'react'

export default function ComandasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ComandasError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-lg font-semibold text-red-600">Erro ao carregar comandas</h2>
      <p className="text-sm text-gray-600 max-w-md text-center">{error.message}</p>
      {error.digest && <p className="text-xs text-gray-400">digest: {error.digest}</p>}
      {error.stack && (
        <pre className="text-xs text-gray-400 max-w-xl overflow-auto bg-gray-100 p-3 rounded text-left">
          {error.stack}
        </pre>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700"
      >
        Tentar novamente
      </button>
    </div>
  )
}
