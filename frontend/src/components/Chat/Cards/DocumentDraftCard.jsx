import { DocumentTextIcon, ArrowDownTrayIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'

export default function DocumentDraftCard({ type = 'Surat', title = 'Draf Dokumen', excerpt = '', date = '' }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3 border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-[#e2e8f0]">
          <DocumentTextIcon className="h-5 w-5 text-[#3b82f6]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[#0f172a]">{title}</p>
          <p className="text-[11px] font-medium text-[#64748b]">Format: {type} {date ? `• ${date}` : ''}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="prose prose-sm max-w-none text-[#334155] bg-[#fafafa] p-4 rounded border border-dashed border-[#d1d5db]">
          <p className="font-serif leading-relaxed line-clamp-4">{excerpt || 'Memuat isi dokumen...'}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 bg-[#f8fafc] px-4 py-3 border-t border-[#f1f5f9]">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#475467] transition-all hover:bg-[#f1f5f9] active:scale-95"
        >
          <ClipboardDocumentIcon className="h-3.5 w-3.5" /> Salin Teks
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#1e293b] active:scale-95"
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Unduh PDF
        </button>
      </div>
    </div>
  )
}
