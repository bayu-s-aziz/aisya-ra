import { useCallback, useEffect, useState } from 'react'
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import api from '../lib/api'

function RpphView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('aisya_access_token')

  const fetchRpph = useCallback(async () => {
    if (!token) return

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
  }, [token])

  useEffect(() => {
    fetchRpph()
  }, [fetchRpph])

  const downloadPdf = async (id) => {
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
    <div className="h-full overflow-y-auto bg-[#f8fafc] px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <section className="rounded-3xl border border-[#e2e8f0] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Modul RPPH</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">Daftar Dokumen RPPH</h2>
              <p className="mt-2 text-sm text-[#64748b]">Akses riwayat RPPH dan unduh PDF tanpa mengubah alur backend yang sudah ada.</p>
            </div>

            <button
              type="button"
              onClick={fetchRpph}
              className="inline-flex items-center gap-2 rounded-full border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Muat Ulang
            </button>
          </div>

          {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <p className="mt-4 text-sm text-[#64748b]">Memuat data RPPH...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-10 text-center">
              <p className="text-sm text-[#64748b]">Belum ada data RPPH.</p>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e2e8f0]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-left">
                    <th className="px-3 py-2.5 font-semibold text-[#334155]">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold text-[#334155]">Tema</th>
                    <th className="px-3 py-2.5 font-semibold text-[#334155]">Subtema</th>
                    <th className="px-3 py-2.5 font-semibold text-[#334155]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[#eef2f7] bg-white hover:bg-[#f8fafc]">
                      <td className="px-3 py-2.5 text-[#334155]">{item.tanggal}</td>
                      <td className="px-3 py-2.5 text-[#0f172a]">{item.tema}</td>
                      <td className="px-3 py-2.5 text-[#334155]">{item.subtema}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => downloadPdf(item.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#020617]"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default RpphView
