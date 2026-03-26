import { useEffect, useMemo, useState } from 'react'
import {
  fetchKelompok,
  fetchPresensiRekap,
  savePresensiBatch,
} from '../../lib/settingsManagement'

const STATUS_OPTIONS = [
  { value: 'belum_dicatat', label: 'Belum dicatat' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
  { value: 'alpha', label: 'Alpha' },
]

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function PresensiManagementPanel() {
  const [kelompokList, setKelompokList] = useState([])
  const [selectedKelompokId, setSelectedKelompokId] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate())

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [rekap, setRekap] = useState(null)
  const [statusMap, setStatusMap] = useState({})

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  useEffect(() => {
    const loadKelompok = async () => {
      const token = localStorage.getItem('aisya_access_token')
      if (!token) return

      setLoading(true)
      setError('')
      try {
        const data = await fetchKelompok(token)
        setKelompokList(data)
        if (data.length > 0) {
          setSelectedKelompokId(data[0].id)
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Gagal memuat kelompok')
      } finally {
        setLoading(false)
      }
    }

    loadKelompok()
  }, [])

  const loadRekap = async () => {
    if (!selectedKelompokId || !selectedDate) {
      setError('Pilih tanggal dan kelompok terlebih dahulu')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const data = await fetchPresensiRekap(token, selectedKelompokId, selectedDate)
      setRekap(data)

      const nextStatusMap = {}
      ;(data?.detail || []).forEach((item) => {
        nextStatusMap[item.siswa_id] = item.status || 'belum_dicatat'
      })
      setStatusMap(nextStatusMap)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat rekap presensi')
      setRekap(null)
      setStatusMap({})
    } finally {
      setLoading(false)
    }
  }

  const recordsToSave = useMemo(() => {
    return Object.entries(statusMap)
      .filter(([, status]) => status && status !== 'belum_dicatat')
      .map(([siswaId, status]) => ({ siswa_id: siswaId, status }))
  }, [statusMap])

  const handleSave = async () => {
    if (!selectedKelompokId || !selectedDate) {
      setError('Pilih tanggal dan kelompok terlebih dahulu')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await savePresensiBatch(token, {
        tanggal: selectedDate,
        kelompok_id: selectedKelompokId,
        records: recordsToSave,
      })
      setSuccess(result?.message || 'Presensi berhasil disimpan')
      await loadRekap()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menyimpan presensi')
    } finally {
      setSaving(false)
    }
  }

  const summary = rekap
    ? `Hadir: ${rekap.hadir} | Sakit: ${rekap.sakit} | Izin: ${rekap.izin} | Alpha: ${rekap.alpha} | Belum dicatat: ${rekap.belum_dicatat}`
    : ''

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Filter Rekap Presensi</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="date"
            className={inputClass}
            value={selectedDate}
            onChange={(ev) => setSelectedDate(ev.target.value)}
          />

          <select
            className={inputClass}
            value={selectedKelompokId}
            onChange={(ev) => setSelectedKelompokId(ev.target.value)}
          >
            <option value="">Pilih kelompok</option>
            {kelompokList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama_kelompok}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadRekap}
            disabled={loading}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-60"
          >
            {loading ? 'Memuat...' : 'Muat Rekap'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !rekap}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Presensi'}
          </button>
        </div>
      </div>

      {rekap ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#334155] shadow-sm">
          <p className="font-semibold text-[#0f172a]">{rekap.kelompok_nama} - {rekap.tanggal}</p>
          <p className="mt-1 text-xs text-[#64748b]">{summary}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Nama Siswa</th>
              <th className="px-3 py-2">Status Presensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={2}>Memuat data presensi...</td>
              </tr>
            ) : null}

            {!loading && (!rekap?.detail || rekap.detail.length === 0) ? (
              <tr>
                <td className="px-3 py-3" colSpan={2}>Belum ada data presensi untuk filter ini.</td>
              </tr>
            ) : null}

            {!loading && rekap?.detail
              ? rekap.detail.map((item) => (
                  <tr key={item.siswa_id}>
                    <td className="px-3 py-2">{item.nama}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClass}
                        value={statusMap[item.siswa_id] || 'belum_dicatat'}
                        onChange={(ev) => {
                          const value = ev.target.value
                          setStatusMap((prev) => ({ ...prev, [item.siswa_id]: value }))
                        }}
                      >
                        {STATUS_OPTIONS.map((statusItem) => (
                          <option key={statusItem.value} value={statusItem.value}>
                            {statusItem.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PresensiManagementPanel
