'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail } from 'lucide-react'

export default function RecuperarSenhaPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nova-senha`,
    })

    if (error) {
      setErro('Não foi possível enviar o email. Verifique o endereço e tente novamente.')
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-pink-50">
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-4">
              <span className="text-2xl font-bold text-amber-700">D</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Recuperar senha</h1>
            <p className="text-gray-500 text-sm mt-1">
              {enviado ? 'Verifique seu email' : 'Informe seu email para receber o link de redefinição'}
            </p>
          </div>

          {enviado ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">
                Enviamos um link para <strong>{email}</strong>. Clique no link do email para criar uma nova senha.
              </p>
              <p className="text-xs text-gray-400">
                Não recebeu? Verifique a caixa de spam ou tente novamente.
              </p>
              <button
                onClick={() => { setEnviado(false); setEmail('') }}
                className="text-sm text-amber-700 hover:underline"
              >
                Tentar com outro email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent text-sm"
                />
              </div>

              {erro && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>
          )}

          <a
            href="/auth/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </a>
        </div>
      </div>
    </div>
  )
}
