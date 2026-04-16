'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Plus, Pencil, Trash2, X, Check, Eye, EyeOff, AlertTriangle, KeyRound } from 'lucide-react'

interface Unidade {
  id: string
  nome: string
  cidade: string
}

interface UsuarioUnidade {
  unidade_id: string
  unidade: Unidade
}

interface Usuario {
  id: string
  nome: string
  email: string
  perfil: 'admin' | 'operador'
  ativo: boolean
  created_at: string
  usuario_unidades: UsuarioUnidade[]
}

interface Props {
  unidades: Unidade[]
}

const perfilLabel: Record<string, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  gerente: 'Gerente',
  recepcionista: 'Recepcionista',
}

const perfilCor: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-800',
  operador: 'bg-blue-100 text-blue-800',
  gerente: 'bg-purple-100 text-purple-800',
  recepcionista: 'bg-green-100 text-green-800',
}

export default function UsuariosClient({ unidades }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [resetModal, setResetModal] = useState<Usuario | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)
  const [resetando, setResetando] = useState(false)
  const [resetErro, setResetErro] = useState('')
  const [resetSucesso, setResetSucesso] = useState(false)

  // Campos do form
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [perfil, setPerfil] = useState<'admin' | 'operador'>('operador')
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([])

  const buscarUsuarios = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    if (res.ok) {
      const data = await res.json()
      setUsuarios(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    buscarUsuarios()
  }, [buscarUsuarios])

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setEmail('')
    setSenha('')
    setPerfil('operador')
    setUnidadesSelecionadas(unidades.length === 1 ? [unidades[0].id] : [])
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setNome(u.nome)
    setEmail(u.email)
    setSenha('')
    setPerfil(u.perfil === 'admin' ? 'admin' : 'operador')
    setUnidadesSelecionadas(u.usuario_unidades?.map(uu => uu.unidade_id) || [])
    setErro('')
    setModalAberto(true)
  }

  function toggleUnidade(uid: string) {
    setUnidadesSelecionadas(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    )
  }

  async function salvar() {
    if (!nome.trim() || (!editando && (!email.trim() || !senha.trim()))) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    if (!editando && senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (unidadesSelecionadas.length === 0) {
      setErro('Selecione ao menos uma unidade.')
      return
    }

    setSalvando(true)
    setErro('')

    const res = await fetch('/api/usuarios', {
      method: editando ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editando
          ? { id: editando.id, nome, perfil, unidadeIds: unidadesSelecionadas }
          : { nome, email, senha, perfil, unidadeIds: unidadesSelecionadas }
      ),
    })

    const data = await res.json()
    if (!res.ok) {
      setErro(data.error || 'Erro ao salvar usuário.')
      setSalvando(false)
      return
    }

    setModalAberto(false)
    setSalvando(false)
    buscarUsuarios()
  }

  async function deletar(id: string) {
    const res = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Erro ao excluir usuário.')
      return
    }
    setConfirmandoDelete(null)
    buscarUsuarios()
  }

  async function abrirReset(u: Usuario) {
    setResetModal(u)
    setNovaSenha('')
    setResetErro('')
    setResetSucesso(false)
  }

  async function salvarNovaSenha() {
    if (!resetModal) return
    if (novaSenha.length < 6) { setResetErro('Mínimo 6 caracteres.'); return }
    setResetando(true)
    setResetErro('')
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetModal.id, novaSenha }),
    })
    const data = await res.json()
    if (!res.ok) { setResetErro(data.error || 'Erro ao redefinir senha.'); setResetando(false); return }
    setResetSucesso(true)
    setResetando(false)
  }

  async function toggleAtivo(u: Usuario) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, ativo: !u.ativo }),
    })
    buscarUsuarios()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie os acessos ao sistema</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          style={{ backgroundColor: '#B8924A' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo usuário</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum usuário cadastrado</p>
        </div>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Nome</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Perfil</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Unidades</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: u.perfil === 'admin' ? '#B8924A' : '#6366f1' }}>
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfilCor[u.perfil] || 'bg-gray-100 text-gray-600'}`}>
                        {perfilLabel[u.perfil] || u.perfil}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.usuario_unidades?.length > 0
                          ? u.usuario_unidades.map(uu => (
                            <span key={uu.unidade_id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              {uu.unidade?.nome || uu.unidade_id}
                            </span>
                          ))
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAtivo(u)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${u.ativo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {u.ativo ? <><Check className="w-3 h-3" />Ativo</> : <>Inativo</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => abrirReset(u)}
                          title="Redefinir senha"
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-gray-400 hover:text-blue-600">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => abrirEditar(u)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {confirmandoDelete === u.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => deletar(u.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                              Confirmar
                            </button>
                            <button onClick={() => setConfirmandoDelete(null)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmandoDelete(u.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {usuarios.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: u.perfil === 'admin' ? '#B8924A' : '#6366f1' }}>
                    {u.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{u.nome}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${perfilCor[u.perfil] || 'bg-gray-100 text-gray-600'}`}>
                        {perfilLabel[u.perfil] || u.perfil}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.usuario_unidades?.map(uu => (
                        <span key={uu.unidade_id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {uu.unidade?.nome || uu.unidade_id}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirEditar(u)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmandoDelete(confirmandoDelete === u.id ? null : u.id)}
                      className={`p-1.5 rounded-lg transition-colors ${confirmandoDelete === u.id ? 'bg-red-100 text-red-600' : 'hover:bg-red-50 text-gray-400 hover:text-red-600'}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {confirmandoDelete === u.id && (
                  <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-gray-600 flex-1">Excluir {u.nome}?</p>
                    <button onClick={() => deletar(u.id)}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium">
                      Excluir
                    </button>
                    <button onClick={() => setConfirmandoDelete(null)}
                      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg font-medium">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal redefinir senha */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResetModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Redefinir senha</h2>
              <button onClick={() => setResetModal(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Definindo nova senha para <strong>{resetModal.nome}</strong>
              </p>
              {resetSucesso ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700">Senha redefinida com sucesso!</p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <input
                      type={mostrarNovaSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      autoFocus
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <button type="button" onClick={() => setMostrarNovaSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetErro && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{resetErro}</p>
                  )}
                </>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setResetModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                {resetSucesso ? 'Fechar' : 'Cancelar'}
              </button>
              {!resetSucesso && (
                <button onClick={salvarNovaSenha} disabled={resetando}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: '#B8924A' }}>
                  {resetando ? 'Salvando...' : 'Salvar senha'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalAberto(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editando ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <button onClick={() => setModalAberto(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {/* Email — só no cadastro */}
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              )}

              {/* Senha — só no cadastro */}
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Perfil */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Perfil de acesso <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['operador', 'admin'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPerfil(p)}
                      className={`flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                        perfil === p
                          ? 'border-amber-600 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900">
                        {p === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        {p === 'admin'
                          ? 'Acesso total + relatórios + usuários'
                          : 'Agenda, comandas e clientes'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Unidades */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidades com acesso <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {unidades.map(u => (
                    <label key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      unidadesSelecionadas.includes(u.id)
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        unidadesSelecionadas.includes(u.id)
                          ? 'bg-amber-600 border-amber-600'
                          : 'border-gray-300'
                      }`}>
                        {unidadesSelecionadas.includes(u.id) && (
                          <Check className="w-2.5 h-2.5 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={unidadesSelecionadas.includes(u.id)}
                        onChange={() => toggleUnidade(u.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{u.nome}</p>
                        <p className="text-xs text-gray-500">{u.cidade}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {erro && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setModalAberto(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#B8924A' }}
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
