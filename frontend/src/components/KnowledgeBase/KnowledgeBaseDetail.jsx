import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import api from '../../lib/api'

function KnowledgeBaseDetail({ selectedDocId, selectedDoc, onDocDeleted }) {
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (!selectedDocId) {
      setChunks([])
      setError('')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchChunks = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/knowledge/documents/${selectedDocId}/chunks`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const nextChunks = Array.isArray(response?.data?.data?.chunks)
          ? response.data.data.chunks
          : []

        setChunks(nextChunks)
      } catch (err) {
        setChunks([])
        setError(err?.response?.data?.detail || 'Gagal memuat detail dokumen')
      } finally {
        setLoading(false)
      }
    }

    fetchChunks()
  }, [selectedDocId])

  const firstChunkText = useMemo(() => {
    if (chunks.length === 0) return '-'
    return chunks[0]?.content || '-'
  }, [chunks])

  const handleDelete = async () => {
    if (!selectedDocId) return
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return false

    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/knowledge/documents/${selectedDocId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      onDocDeleted?.(selectedDocId)
      return true
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || 'Gagal menghapus dokumen')
      return false
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#64748b]">Dokumen terpilih</p>
          <p className="text-base font-medium text-[#0f172a]">{selectedDoc?.nama_file || '-'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDeleteError('')
            setIsDeleteConfirmOpen(true)
          }}
          disabled={deleting}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? 'Menghapus...' : 'Hapus'}
        </button>
      </div>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {deleteError ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}

      {loading ? <p className="text-sm text-[#64748b]">Memuat chunks...</p> : null}

      {!loading ? (
        <>
          <div>
            <p className="text-sm font-medium text-[#0f172a]">Daftar Chunk</p>
            {chunks.length === 0 ? (
              <p className="mt-1 text-sm text-[#64748b]">Belum ada chunk.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {chunks.map((chunk, index) => {
                  const embeddingSize = Array.isArray(chunk?.embedding) ? chunk.embedding.length : 0
                  return (
                    <li key={chunk.id || `${chunk.doc_id}-${index}`} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-sm font-medium text-[#0f172a]">Chunk #{index + 1}</p>
                      <p className="text-xs text-[#64748b]">Embedding dimensi: {embeddingSize}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[#0f172a]">Konten teks chunk pertama</p>
            <p className="mt-1 whitespace-pre-wrap rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#334155]">{firstChunkText}</p>
          </div>
        </>
      ) : null}

      {isDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5">
            <h3 className="text-base font-semibold text-[#111b21]">Konfirmasi Hapus</h3>
            <p className="mt-2 text-sm text-[#41525d]">
              Dokumen <span className="font-medium">{selectedDoc?.nama_file || '-'}</span> akan dihapus permanen.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={deleting}
                className="rounded-full border border-[#d1d7db] px-4 py-2 text-sm text-[#41525d] hover:bg-[#f5f6f6]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const isDeleted = await handleDelete()
                  if (isDeleted) {
                    setIsDeleteConfirmOpen(false)
                  }
                }}
                disabled={deleting}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

KnowledgeBaseDetail.propTypes = {
  selectedDocId: PropTypes.string,
  selectedDoc: PropTypes.shape({
    nama_file: PropTypes.string,
  }),
  onDocDeleted: PropTypes.func,
}

KnowledgeBaseDetail.defaultProps = {
  selectedDocId: '',
  selectedDoc: null,
  onDocDeleted: undefined,
}

export default KnowledgeBaseDetail
