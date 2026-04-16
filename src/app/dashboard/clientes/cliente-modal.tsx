'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, Trash2, FileImage, Loader2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Cliente } from '@/types'

interface Props {
  cliente: Cliente | null
  unidadeId: string
  onClose: () => void
  onSalvo: (cliente: Cliente) => void
}

interface Documento {
  id: string
  nome: string
  storage_path: string
  url: string
  created_at: string
}

type Aba = 'cadastro' | 'documentos' | 'configuracoes'

export default function ClienteModal({ cliente, unidadeId, onClose, onSalvo }: Props) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('cadastro')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    telefone: cliente?.telefone || '',
    email: cliente?.email || '',
    cpf: cliente?.cpf || '',
    data_nascimento: cliente?.data_nascimento || '',
    observacoes: cliente?.observacoes || '',
    ativo: cliente?.ativo ?? true,
  })

  // Documentos
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregandoDocs, setCarregandoDocs] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [deletando, setDeletando] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function set(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function carregarDocumentos() {
    if (!cliente) return
    setCarregandoDocs(true)
    const { data } = await supabase
      .from('cliente_documentos')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at')

    if (data && data.length > 0) {
      const docs = await Promise.all(
        data.map(async (doc) => {
          const { data: signed } = await supabase.storage
            .from('clientes')
            .createSignedUrl(doc.storage_path, 3600)
          return { ...doc, url: signed?.signedUrl || '' }
        })
      )
      setDocumentos(docs)
    } else {
      setDocumentos([])
    }
    setCarregandoDocs(false)
  }

  useEffect(() => {
    if (aba === 'documentos' && cliente) {
      carregarDocumentos()
    }
  }, [aba, cliente])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !cliente) return
    setUploadando(true)

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${cliente.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('clientes')
        .upload(path, file)

      if (uploadError) continue

      await supabase.from('cliente_documentos').insert({
        cliente_id: cliente.id,
        nome: file.name,
        storage_path: path,
      })
    }

    await carregarDocumentos()
    setUploadando(false)
  }

  async function deletarDocumento(doc: Documento) {
    setDeletando(doc.id)
    await supabase.storage.from('clientes').remove([doc.storage_path])
    await supabase.from('cliente_documentos').delete().eq('id', doc.id)
    setDocumentos(prev => prev.filter(d => d.id !== doc.id))
    setDeletando(null)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    setLoading(true)
    setErro('')

    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      data_nascimento: form.data_nascimento || null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
      unidade_id: unidadeId,
    }

    if (cliente) {
      const { data, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', cliente.id)
        .select()
        .single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert(payload)
        .select()
        .single()
      if (error) { setErro(error.message); setLoading(false); return }
      onSalvo(data)
    }
    setLoading(false)
  }

  const isImage = (nome: string) =>
    /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(nome)

  const abas: [Aba, string][] = [
    ['cadastro', 'Cadastro'],
    ['documentos', 'Documentos'],
    ['configuracoes', 'Configurações'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{cliente ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar abas */}
          <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-4 px-3 space-y-0.5">
            {abas.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  aba === key
                    ? 'text-amber-700 font-medium border-l-2 border-amber-700 bg-amber-50 rounded-l-none'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-6">
            {aba === 'cadastro' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={e => set('nome', e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                    <input
                      type="tel"
                      value={form.telefone}
                      onChange={e => set('telefone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={form.cpf}
                      onChange={e => set('cpf', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aniversário</label>
                    <input
                      type="date"
                      value={form.data_nascimento}
                      onChange={e => set('data_nascimento', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={form.observacoes}
                    onChange={e => set('observacoes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 resize-none"
                    placeholder="Anotações sobre o cliente..."
                  />
                </div>
              </div>
            )}

            {aba === 'documentos' && (
              <div className="space-y-4">
                {!cliente ? (
                  <div className="text-center py-10 text-gray-400">
                    <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Salve o cliente primeiro para adicionar documentos.</p>
                  </div>
                ) : (
                  <>
                    {/* Área de upload */}
                    <div
                      onClick={() => !uploadando && inputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragging(true) }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => {
                        e.preventDefault()
                        setDragging(false)
                        handleUpload(e.dataTransfer.files)
                      }}
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                        dragging
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50/50'
                      }`}
                    >
                      {uploadando ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                          <p className="text-sm text-amber-700 font-medium">Enviando...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-8 h-8 text-gray-400" />
                          <p className="text-sm font-medium text-gray-700">
                            Clique ou arraste arquivos aqui
                          </p>
                          <p className="text-xs text-gray-400">
                            Fotos e documentos (JPG, PNG, PDF)
                          </p>
                        </div>
                      )}
                      <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        className="sr-only"
                        onChange={e => handleUpload(e.target.files)}
                      />
                    </div>

                    {/* Grid de documentos */}
                    {carregandoDocs ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                      </div>
                    ) : documentos.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <FileImage className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum documento enviado ainda.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {documentos.map(doc => (
                          <div key={doc.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                            {isImage(doc.nome) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={doc.url}
                                alt={doc.nome}
                                className="w-full h-28 object-cover"
                              />
                            ) : (
                              <div className="w-full h-28 flex flex-col items-center justify-center gap-1 bg-gray-100">
                                <FileImage className="w-8 h-8 text-gray-400" />
                                <span className="text-xs text-gray-500 px-2 text-center truncate w-full text-center">PDF</span>
                              </div>
                            )}
                            <div className="px-2 py-1.5 bg-white">
                              <p className="text-xs text-gray-600 truncate">{doc.nome}</p>
                            </div>
                            {/* Botões ao hover */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {isImage(doc.nome) && (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-white rounded-lg hover:bg-gray-100"
                                  title="Ver imagem"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ImageIcon className="w-4 h-4 text-gray-700" />
                                </a>
                              )}
                              <button
                                onClick={() => deletarDocumento(doc)}
                                disabled={deletando === doc.id}
                                className="p-1.5 bg-white rounded-lg hover:bg-red-50"
                                title="Excluir"
                              >
                                {deletando === doc.id
                                  ? <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                                  : <Trash2 className="w-4 h-4 text-red-500" />
                                }
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {aba === 'configuracoes' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cliente inativo não aparece em agendamentos e comandas</p>
                  </div>
                  <button
                    onClick={() => set('ativo', !form.ativo)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.ativo ? 'bg-amber-700' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.ativo ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancelar
            </button>
            {aba !== 'documentos' && (
              <button
                onClick={handleSalvar}
                disabled={loading}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
