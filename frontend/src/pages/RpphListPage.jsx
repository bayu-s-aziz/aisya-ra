import { useEffect, useState } from 'react'
import api from '../lib/api'

function RpphListPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchRpph = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/rpph', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setItems(response?.data?.data || [])
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat daftar RPPH')
      } finally {
        setLoading(false)
      }
    }

    fetchRpph()
  }, [])

  const downloadPdf = async (id) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    try {
      const response = await api.get(`/rpph/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'blob',
      })

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `rpph-${id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      setError('Gagal mengunduh PDF RPPH')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Daftar RPPH</h1>

        {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <p className="mt-6 text-slate-500">Memuat data...</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-slate-500">Belum ada data RPPH.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Tema</th>
                  <th className="px-3 py-2">Subtema</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{item.tanggal}</td>
                    <td className="px-3 py-2">{item.tema}</td>
                    <td className="px-3 py-2">{item.subtema}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => downloadPdf(item.id)}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
                      >
                        Download PDF
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
  )
}

export default RpphListPage
