import { useState } from 'react'
import PropTypes from 'prop-types'
import { Bars3Icon } from '@heroicons/react/24/outline'
import KnowledgeBaseSidebar from '../components/KnowledgeBase/KnowledgeBaseSidebar'
import KnowledgeBaseDetail from '../components/KnowledgeBase/KnowledgeBaseDetail'

function KnowledgeBaseView({ selectedDocId, selectedDoc, onSelectDocId, onDocumentsLoaded, onDocDeleted }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#f8fafc]">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
          aria-label="Tutup sidebar knowledge base"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[300px] max-w-[90vw] p-3 transition-transform duration-200 md:static md:w-[320px] md:max-w-none md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <KnowledgeBaseSidebar
          selectedDocId={selectedDocId}
          onSelectDocId={onSelectDocId}
          onDocumentsLoaded={onDocumentsLoaded}
          onCloseSidebar={() => setIsSidebarOpen(false)}
        />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-[#e2e8f0] bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Knowledge Base</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">Dokumen Pengetahuan</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[#d1d5db] px-3 py-1.5 text-sm text-[#334155] hover:bg-[#f8fafc] md:hidden"
            >
              <Bars3Icon className="h-4 w-4" />
              Dokumen
            </button>
          </div>

          {selectedDocId ? (
            <KnowledgeBaseDetail
              selectedDocId={selectedDocId}
              selectedDoc={selectedDoc}
              onDocDeleted={onDocDeleted}
            />
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-10 text-center">
              <p className="text-sm text-[#64748b]">Pilih dokumen untuk melihat detail chunk.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

KnowledgeBaseView.propTypes = {
  selectedDocId: PropTypes.string,
  selectedDoc: PropTypes.shape({
    nama_file: PropTypes.string,
    total_chunks: PropTypes.number,
  }),
  onSelectDocId: PropTypes.func,
  onDocumentsLoaded: PropTypes.func,
  onDocDeleted: PropTypes.func,
}

KnowledgeBaseView.defaultProps = {
  selectedDocId: '',
  selectedDoc: null,
  onSelectDocId: undefined,
  onDocumentsLoaded: undefined,
  onDocDeleted: undefined,
}

export default KnowledgeBaseView
