import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const profissionalId = form.get('profissional_id') as string
  const unidadeId = form.get('unidade_id') as string

  if (!file || !profissionalId || !unidadeId) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Planilha vazia ou sem dados reconhecíveis.' }, { status: 400 })
  }

  // Retornar preview das primeiras linhas + cabeçalhos detectados
  const headers = Object.keys(rows[0])
  const preview = rows.slice(0, 5).map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
  )

  return NextResponse.json({ headers, preview, total: rows.length, rows: rows.map(r =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
  )})
}
