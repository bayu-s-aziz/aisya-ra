import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

function StatCard({ title, value, subtitle, tone = 'slate' }) {
  const tones = {
    emerald: 'border-l-4 border-emerald-600 bg-emerald-50 text-emerald-900',
    blue: 'border-l-4 border-blue-600 bg-blue-50 text-blue-900',
    amber: 'border-l-4 border-amber-500 bg-amber-50 text-amber-900',
    red: 'border-l-4 border-red-600 bg-red-50 text-red-900',
    slate: 'border-l-4 border-slate-500 bg-slate-50 text-slate-900',
  }

  return (
    <div className={`rounded-md p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {subtitle ? <p className="mt-1 text-xs font-medium opacity-80">{subtitle}</p> : null}
    </div>
  )
}

function DashboardGuruPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/dashboard/guru')
        setData(response?.data?.data || null)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat dashboard guru')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const totalPresensi = useMemo(() => {
    if (!data?.rekap_presensi_hari_ini?.total) return 0
    const total = data.rekap_presensi_hari_ini.total
    return (total.hadir || 0) + (total.sakit || 0) + (total.izin || 0) + (total.alpha || 0)
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-emerald-800 px-6 py-5 text-white">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Guru</h1>
            <p className="mt-1 text-sm text-emerald-100">Ringkasan aktivitas harian dan mingguan</p>
          </div>
          <div className="p-6">

          {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">Memuat dashboard...</p>
          ) : data ? (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="RPPH Hari Ini"
                  value={data?.rpph_hari_ini?.sudah_buat ? 'Sudah' : 'Belum'}
                  subtitle={`Jumlah: ${data?.rpph_hari_ini?.jumlah || 0}`}
                  tone={data?.rpph_hari_ini?.sudah_buat ? 'emerald' : 'amber'}
                />
                <StatCard
                  title="Catatan Minggu Ini"
                  value={data?.jumlah_catatan_minggu_ini || 0}
                  subtitle="Total catatan minggu berjalan"
                  tone="blue"
                />
                <StatCard
                  title="Siswa Tanpa Catatan (7 Hari)"
                  value={data?.siswa_tanpa_catatan_7_hari?.jumlah || 0}
                  subtitle="Perlu ditindaklanjuti"
                  tone="red"
                />
                <StatCard
                  title="Presensi Tercatat Hari Ini"
                  value={totalPresensi}
                  subtitle={`Dari ${data?.rekap_presensi_hari_ini?.total?.total_siswa || 0} siswa`}
                  tone="slate"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-900">Rekap Presensi Hari Ini (Total)</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <StatCard title="Hadir" value={data?.rekap_presensi_hari_ini?.total?.hadir || 0} tone="emerald" />
                    <StatCard title="Sakit" value={data?.rekap_presensi_hari_ini?.total?.sakit || 0} tone="amber" />
                    <StatCard title="Izin" value={data?.rekap_presensi_hari_ini?.total?.izin || 0} tone="blue" />
                    <StatCard title="Alpha" value={data?.rekap_presensi_hari_ini?.total?.alpha || 0} tone="red" />
                    <StatCard title="Belum" value={data?.rekap_presensi_hari_ini?.total?.belum_dicatat || 0} tone="slate" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-slate-900">Siswa Tanpa Catatan 7 Hari</h2>
                  {data?.siswa_tanpa_catatan_7_hari?.items?.length ? (
                    <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
                      {data.siswa_tanpa_catatan_7_hari.items.map((item) => (
                        <li key={item.siswa_id} className="rounded-md bg-slate-50 px-3 py-2">
                          <p className="font-medium text-slate-800">{item.nama}</p>
                          <p className="text-xs text-slate-500">{item.kelompok_nama || '-'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Semua siswa sudah memiliki catatan.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Rekap Presensi Per Kelompok</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-emerald-700 text-white">
                      <tr className="text-left">
                        <th className="px-3 py-3 font-semibold">Kelompok</th>
                        <th className="px-3 py-3 font-semibold">Total</th>
                        <th className="px-3 py-3 font-semibold">Hadir</th>
                        <th className="px-3 py-3 font-semibold">Sakit</th>
                        <th className="px-3 py-3 font-semibold">Izin</th>
                        <th className="px-3 py-3 font-semibold">Alpha</th>
                        <th className="px-3 py-3 font-semibold">Belum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.rekap_presensi_hari_ini?.per_kelompok || []).map((k) => (
                        <tr key={k.kelompok_id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-medium">{k.kelompok_nama}</td>
                          <td className="px-3 py-2">{k.total_siswa}</td>
                          <td className="px-3 py-2">{k.hadir}</td>
                          <td className="px-3 py-2">{k.sakit}</td>
                          <td className="px-3 py-2">{k.izin}</td>
                          <td className="px-3 py-2">{k.alpha}</td>
                          <td className="px-3 py-2">{k.belum_dicatat}</td>
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
    </div>
  )
}

export default DashboardGuruPage
