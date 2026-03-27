import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import api from '../../lib/api'
import UploadDocumentModal from './UploadDocumentModal'

function formatUploadDate(doc) {
  const raw = doc?.created_at || doc?.uploaded_at || doc?.tanggal_upload || doc?.updated_at || ''
  if (!raw) return '-'

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function KnowledgeBaseSidebar({ selectedDocId, onSelectDocId, onDocumentsLoaded, onCloseSidebar }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const token = localStorage.getItem('aisya_access_token')

  const fetchDocuments = useCallback(async () => {
    if (!token) {
      setDocuments([])
      onDocumentsLoaded?.([])
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await api.get('/knowledge/documents', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const docs = Array.isArray(response?.data) ? response.data : []
      setDocuments(docs)
      onDocumentsLoaded?.(docs)

      const hasSelected = docs.some((doc) => String(doc.id) === String(selectedDocId))
      if (docs.length > 0 && (!selectedDocId || !hasSelected)) {
        onSelectDocId?.(String(docs[0].id))
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal memuat daftar dokumen')
      setDocuments([])
      onDocumentsLoaded?.([])
    } finally {
      setLoading(false)
    }
  }, [onDocumentsLoaded, onSelectDocId, selectedDocId, token])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const selectedExists = useMemo(
    () => documents.some((doc) => String(doc.id) === String(selectedDocId)),
    [documents, selectedDocId],
  )

  useEffect(() => {
    if (documents.length > 0 && !selectedExists) {
      onSelectDocId?.(String(documents[0].id))
    }
  }, [documents, onSelectDocId, selectedExists])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
      <div className="border-b border-[#e2e8f0] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">Knowledge Base</p>
        <p className="mt-1 text-xs text-[#94a3b8]">Pilih dokumen untuk lihat detail</p>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="mt-3 w-full rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617]"
        >
          Upload Dokumen
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="px-4 py-3 text-xs text-[#94a3b8]">Memuat dokumen...</div> : null}
        {error ? <div className="px-4 py-3 text-xs text-red-700">{error}</div> : null}

        {documents.map((doc) => {
          const isActive = String(selectedDocId) === String(doc.id)
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                onSelectDocId?.(String(doc.id))
                onCloseSidebar?.()
              }}
              className={[
                'w-full border-b border-[#eef2f7] px-4 py-3 text-left transition-colors',
                isActive ? 'bg-[#f1f5f9]' : 'bg-transparent hover:bg-[#f8fafc]',
              ].join(' ')}
            >
              <p className="line-clamp-1 text-sm font-medium text-[#0f172a]">{doc.nama_file}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{formatUploadDate(doc)}</p>
            </button>
          )
        })}

        {documents.length === 0 && !loading ? (
          <div className="px-4 py-5 text-sm text-[#94a3b8]">Belum ada dokumen</div>
        ) : null}
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={fetchDocuments}
      />
    </div>
  )
}

KnowledgeBaseSidebar.propTypes = {
  selectedDocId: PropTypes.string,
  onSelectDocId: PropTypes.func.isRequired,
  onDocumentsLoaded: PropTypes.func,
  onCloseSidebar: PropTypes.func,
}

KnowledgeBaseSidebar.defaultProps = {
  selectedDocId: '',
  onDocumentsLoaded: undefined,
  onCloseSidebar: undefined,
}

export default KnowledgeBaseSidebar