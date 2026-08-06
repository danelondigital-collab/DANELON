import { Globe } from 'lucide-react'

const EMBED_URL = 'https://datastudio.google.com/embed/reporting/5fe0bab3-3587-492b-ac8b-ba3c8967ba43/page/m0h5F'

export default function TrafegoSitePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Globe className="w-5 h-5 text-violet-600" /> Tráfego do Site
        </h1>
        <p className="text-sm text-slate-500">Visitas, cliques em botões e origem de tráfego de elainedanelon.com.br (Google Analytics).</p>
      </div>

      <div
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}
      >
        <iframe
          src={EMBED_URL}
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  )
}
