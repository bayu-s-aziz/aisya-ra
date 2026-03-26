import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function DashboardKepalaPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const token = localStorage.getItem('aisya_access_token')

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true)
      setError('')
      try {
        const me = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const role = (me?.data?.data?.profile?.role || '').toLowerCase()
        if (!['kepala_ra', 'kepala', 'admin', 'admin_ra'].includes(role)) {
          setError('Halaman ini hanya untuk Kepala RA/Admin')
          setLoading(false)
          return
        }

        const response = await api.get('/dashboard/kepala', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setData(response?.data?.data || null)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat dashboard kepala')
      } finally {
        setLoading(false)
      }
    }

    if (token) fetchDashboard()
  }, [token])

  const chartData = useMemo(() => {
    return (data?.summary_per_kelas || []).map((k) => ({
      nama: k.nama_kelas,
      siswa: k.jumlah_siswa || 0,
      rpph: k.jumlah_rpph_minggu_ini || 0,
      presensi: k.jumlah_presensi_hari_ini || 0,
    }))
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Kepala RA</h1>
          <p className="mt-1 text-sm text-slate-600">Ringkasan performa guru dan kelas</p>

          {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">Memuat dashboard...</p>
          ) : data ? (
            <>
              <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Ringkasan Guru</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2">RPPH Hari Ini</th>
                        <th className="px-3 py-2">RPPH Minggu Ini</th>
                        <th className="px-3 py-2">Catatan Minggu Ini</th>
                        <th className="px-3 py-2">Presensi Dicatat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.summary_per_guru || []).map((g) => (
                        <tr key={g.guru_id} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{g.nama || '-'}</p>
                            <p className="text-xs text-slate-500">{g.email || '-'}</p>
                          </td>
                          <td className="px-3 py-2">{g.rpph_hari_ini || 0}</td>
                          <td className="px-3 py-2">{g.rpph_minggu_ini || 0}</td>
                          <td className="px-3 py-2">{g.catatan_minggu_ini || 0}</td>
                          <td className="px-3 py-2">{g.presensi_dicatat_hari_ini || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Grafik Ringkasan Kelas</h2>
                <p className="mt-1 text-xs text-slate-500">Perbandingan jumlah siswa, RPPH minggu ini, dan presensi hari ini.</p>
                <div className="mt-4 h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nama" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="siswa" fill="#334155" name="Siswa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rpph" fill="#0ea5e9" name="RPPH" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="presensi" fill="#10b981" name="Presensi" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Ringkasan Kelas</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-3 py-2">Kelas</th>
                        <th className="px-3 py-2">Jumlah Siswa</th>
                        <th className="px-3 py-2">RPPH Minggu Ini</th>
                        <th className="px-3 py-2">Presensi Hari Ini</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.summary_per_kelas || []).map((k) => (
                        <tr key={k.kelompok_id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{k.nama_kelas}</td>
                          <td className="px-3 py-2">{k.jumlah_siswa || 0}</td>
                          <td className="px-3 py-2">{k.jumlah_rpph_minggu_ini || 0}</td>
                          <td className="px-3 py-2">{k.jumlah_presensi_hari_ini || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default DashboardKepalaPage
