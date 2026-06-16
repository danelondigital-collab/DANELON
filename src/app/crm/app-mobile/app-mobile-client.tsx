'use client'

import { useState } from 'react'
import { Smartphone, CheckCircle2, XCircle, KeyRound, UserPlus, Loader2, X, Eye, EyeOff } from 'lucide-react'
import { ativarAcessoApp, desativarAcessoApp, redefinirSenhaApp } from './actions'

interface Profissional {
  id: string
  nome: string
  unidade_nome: string
  telefone: string | null
  email: string | null
  app_acesso: boolean
  app_email: string | null
}

interface Props {
  profissionais: Profissional[]
}

type Modal =
  | { tipo: 'ativar'; prof: Profissional }
  | { tipo: 'desativar'; prof: Profissional }
  | { tipo: 'senha'; prof: Profissional }

export default function AppMobileClient({ profissionais }: Props) {
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  // campos do modal
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.unidade_nome.toLowerCase().includes(busca.toLowerCase())
  )

  const ativos = profissionais.filter(p => p.app_acesso).length

  function abrirAtivar(prof: Profissional) {
    setEmail(prof.email || '')
    setSenha('')
    setErro(null)
    setMostrarSenha(false)
    setModal({ tipo: 'ativar', prof })
  }

  function abrirSenha(prof: Profissional) {
    setSenha('')
    setErro(null)
    setMostrarSenha(false)
    setModal({ tipo: 'senha', prof })
  }

  function fechar() {
    setModal(null)
    setErro(null)
    setSucesso(null)
  }

  async function confirmar() {
    if (!modal) return
    setLoading(true)
    setErro(null)

    let res: { success?: boolean; error?: string }

    if (modal.tipo === 'ativar') {
      if (!email || !senha) { setErro('Preencha e-mail e senha.'); setLoading(false); return }
      res = await ativarAcessoApp(modal.prof.id, email, senha)
    } else if (modal.tipo === 'desativar') {
      res = await desativarAcessoApp(modal.prof.id)
    } else {
      if (!senha) { setErro('Informe a nova senha.'); setLoading(false); return }
      res = await redefinirSenhaApp(modal.prof.id, senha)
    }

    setLoading(false)
    if (res.error) { setErro(res.error); return }

    setSucesso(
      modal.tipo === 'ativar' ? 'Acesso ativado com sucesso!'
      : modal.tipo === 'desativar' ? 'Acesso removido.'
      : 'Senha redefinida com sucesso!'
    )
    setTimeout(() => { fechar() }, 1500)
  }

  return (
    <>
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total de profissionais</p>
          <p className="text-2xl font-bold text-slate-800">{profissionais.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Com acesso ao app</p>
          <p className="text-2xl font-bold text-emerald-600">{ativos}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Sem acesso</p>
          <p className="text-2xl font-bold text-slate-400">{profissionais.length - ativos}</p>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar profissional ou unidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Profissional</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Unidade</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Login do app</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">Nenhuma profissional encontrada.</td>
              </tr>
            )}
            {filtrados.map(prof => (
              <tr key={prof.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{prof.nome}</p>
                  <p className="text-xs text-slate-400 sm:hidden">{prof.unidade_nome}</p>
                </td>
                <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{prof.unidade_nome}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                  {prof.app_email || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {prof.app_acesso
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
                        <XCircle className="w-3 h-3" /> Inativo
                      </span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {prof.app_acesso ? (
                      <>
                        <button
                          onClick={() => abrirSenha(prof)}
                          title="Redefinir senha"
                          className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-500 transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'desativar', prof })}
                          title="Remover acesso"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => abrirAtivar(prof)}
                        title="Ativar acesso"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Ativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {modal.tipo === 'ativar' ? 'Ativar acesso ao app'
                  : modal.tipo === 'desativar' ? 'Remover acesso'
                  : 'Redefinir senha'}
              </h2>
              <button onClick={fechar} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              {modal.tipo === 'ativar'
                ? <>Defina o e-mail e senha para <strong>{modal.prof.nome}</strong> acessar o app mobile.</>
                : modal.tipo === 'desativar'
                ? <>O acesso de <strong>{modal.prof.nome}</strong> ao app será removido. Ela não conseguirá mais fazer login.</>
                : <>Nova senha para <strong>{modal.prof.nome}</strong> (<span className="text-violet-600">{modal.prof.app_email}</span>).</>
              }
            </p>

            {/* Campos */}
            {modal.tipo === 'ativar' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">E-mail de login</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="profissional@email.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Senha inicial</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <button type="button" onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {modal.tipo === 'senha' && (
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Nova senha</label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button type="button" onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}
            {sucesso && <p className="text-sm text-emerald-600 mb-3">{sucesso}</p>}

            <div className="flex gap-3 justify-end">
              <button onClick={fechar}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={loading}
                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors flex items-center gap-2 ${
                  modal.tipo === 'desativar'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-violet-600 hover:bg-violet-700'
                } disabled:opacity-60`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {modal.tipo === 'ativar' ? 'Ativar acesso'
                  : modal.tipo === 'desativar' ? 'Remover acesso'
                  : 'Salvar senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
