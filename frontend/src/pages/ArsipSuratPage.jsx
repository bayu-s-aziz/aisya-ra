import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

function ArsipSuratPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('aisya_access_token')
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const fetchSurat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/surat/', { headers })
      setItems(res.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal memuat arsip surat')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    fetchSurat()
  }, [fetchSurat])

  const downloadPdf = async (surat) => {
    try {
      const res = await api.get(`/surat/${surat.id}/pdf`, { headers, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `surat-${surat.nomor_surat.replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Gagal mengunduh PDF')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus surat ini?')) return
    setError('')
    try {
      await api.delete(`/surat/${id}`, { headers })
      fetchSurat()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal menghapus surat')
    }
  }

  const jenisColor = {
    undangan: 'bg-blue-50 text-blue-700',
    keterangan: 'bg-amber-50 text-amber-700',
    tugas: 'bg-purple-50 text-purple-700',
    izin: 'bg-emerald-50 text-emerald-700',
    lainnya: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="h-full bg-[#f8fafc] px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Arsip Surat</h1>
              <p className="mt-1 text-sm text-slate-600">Daftar surat yang sudah di-generate</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {items.length} surat
            </span>
          </div>

          {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {loading ? (
            <p className="mt-6 text-center text-sm text-slate-500">Memuat arsip surat...</p>
          ) : items.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">Belum ada surat. Buat surat baru di halaman "Buat Surat".</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-3 py-2.5 font-semibold text-slate-900">Nomor Surat</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900">Judul</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900">Jenis</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900">Tanggal</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-900">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-medium text-slate-800">{s.nomor_surat}</span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{s.judul}</td>
                      <td className="px-3 py-3">
                        {s.jenis_surat ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${jenisColor[s.jenis_surat] || jenisColor.lainnya}`}>
                            {s.jenis_surat}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {new Date(s.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadPdf(s)}
                            className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Unduh PDF
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ArsipSuratPage
