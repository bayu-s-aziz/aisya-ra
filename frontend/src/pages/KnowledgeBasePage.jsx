import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '../lib/api'

function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchDocuments = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')
    try {
      const response = await api.get('/knowledge/documents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setDocuments(response?.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal memuat daftar dokumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setUploading(true)
    setUploadProgress('Mengupload file...')
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      setUploadProgress('Memproses dokumen dan generate embeddings...')
      
      const response = await api.post('/knowledge/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      setSuccess(response?.data?.message || 'Dokumen berhasil diupload')
      setUploadProgress('')
      
      // Refresh document list
      fetchDocuments()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal mengupload dokumen')
      setUploadProgress('')
    } finally {
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const handleDelete = async (id, nama_file) => {
    if (!confirm(`Hapus dokumen "${nama_file}"?`)) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setError('')
    setSuccess('')

    try {
      await api.delete(`/knowledge/documents/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSuccess('Dokumen berhasil dihapus')
      // Refresh document list
      fetchDocuments()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal menghapus dokumen')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
              <p className="mt-1 text-sm text-slate-600">
                Upload dokumen untuk meningkatkan kemampuan AI assistant
              </p>
            </div>
          </div>

          {/* Upload Area */}
          <div className="mt-6">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive
                  ? 'border-emerald-500 bg-emerald-50'
                  : uploading
                  ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50'
              }`}
            >
              <input {...getInputProps()} />
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {uploading ? (
                <div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{uploadProgress}</p>
                  <div className="mx-auto mt-3 h-2 w-48 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-full animate-pulse bg-emerald-500"></div>
                  </div>
                </div>
              ) : isDragActive ? (
                <p className="mt-2 text-sm font-medium text-emerald-700">Lepas file untuk upload...</p>
              ) : (
                <div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Klik atau drag & drop file di sini
                  </p>
                  <p className="mt-1 text-xs text-slate-500">PDF, DOCX, atau TXT (max 1 file)</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
          )}

          {/* Document List */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Dokumen Tersimpan</h2>

            {loading ? (
              <p className="mt-4 text-sm text-slate-500">Memuat data...</p>
            ) : documents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Belum ada dokumen. Upload dokumen pertama Anda!</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-2 font-semibold text-slate-900">Nama File</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Chunks</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Upload</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {doc.nama_file.endsWith('.pdf') && (
                              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                              </svg>
                            )}
                            {doc.nama_file.endsWith('.docx') && (
                              <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                              </svg>
                            )}
                            {doc.nama_file.endsWith('.txt') && (
                              <svg className="h-5 w-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                              </svg>
                            )}
                            <span className="font-medium text-slate-700">{doc.nama_file}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                            {doc.total_chunks} chunks
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {new Date(doc.uploaded_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => handleDelete(doc.id, doc.nama_file)}
                            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">Tentang Knowledge Base</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Dokumen yang diupload akan diproses menggunakan AI untuk meningkatkan kemampuan assistant
                  menjawab pertanyaan yang spesifik untuk sekolah Anda.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Format yang didukung: PDF, DOCX, dan TXT</li>
                  <li>Dokumen akan dipecah menjadi chunks dan di-embed menggunakan Gemini AI</li>
                  <li>Chat AI akan otomatis mencari informasi relevan dari dokumen</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeBasePage
