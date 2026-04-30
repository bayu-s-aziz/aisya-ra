import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchRekapPresensiGTK,
  recordGTKPresence,
} from '../../lib/presensiGtk'

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
  { value: 'alpha', label: 'Alpha' },
]

const VALID_STATUS = new Set(STATUS_OPTIONS.map((item) => item.value))

const STATUS_BUTTON_STYLE = {
  hadir: {
    active: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    inactive: 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-emerald-50',
  },
  sakit: {
    active: 'border-rose-300 bg-rose-50 text-rose-700',
    inactive: 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-rose-50',
  },
  izin: {
    active: 'border-amber-300 bg-amber-50 text-amber-700',
    inactive: 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-amber-50',
  },
  alpha: {
    active: 'border-slate-400 bg-slate-100 text-slate-700',
    inactive: 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-slate-100',
  },
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeStatus(status) {
  return VALID_STATUS.has(status) ? status : null
}

function PresensiGTKPanel() {
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rekap, setRekap] = useState(null)

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const loadRekap = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchRekapPresensiGTK(selectedDate)
      setRekap(data)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat rekap presensi GTK')
      setRekap(null)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    loadRekap()
  }, [loadRekap])

  const filteredDetail = useMemo(() => {
    const detail = rekap?.detail || []
    const search = searchQuery.trim().toLowerCase()
    if (!search) return detail

    return detail.filter((item) => (item.nama || '').toLowerCase().includes(search))
  }, [rekap, searchQuery])

  const handleStatusChange = async (penggunaId, statusValue) => {
    const confirmed = window.confirm(`Catat status "${statusValue}" untuk GTK ini?`)
    if (!confirmed) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await recordGTKPresence({
        pengguna_id: penggunaId,
        tanggal: selectedDate,
        status: statusValue,
        sumber_pencatatan: 'manual_panel',
      })
      setSuccess('Kehadiran berhasil dicatat')
      await loadRekap()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal mencatat kehadiran')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Manajemen Presensi GTK (Kepala & Guru)</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            type="date"
            className={inputClass}
            value={selectedDate}
            onChange={(ev) => setSelectedDate(ev.target.value)}
          />
          <input
            className={`${inputClass} flex-1 min-w-[200px]`}
            value={searchQuery}
            onChange={(ev) => setSearchQuery(ev.target.value)}
            placeholder="Cari nama GTK..."
          />
        </div>
      </div>

      {rekap ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#334155] shadow-sm">
          <p className="font-semibold text-[#0f172a]">Rekap GTK - {selectedDate}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748b]">
            <span>Total GTK: {rekap.total_gtk}</span>
            <span className="text-emerald-600 font-medium">Hadir: {rekap.hadir}</span>
            <span className="text-rose-600 font-medium">Sakit: {rekap.sakit}</span>
            <span className="text-amber-600 font-medium">Izin: {rekap.izin}</span>
            <span className="text-slate-600 font-medium">Alpha: {rekap.alpha}</span>
            <span className="text-blue-600 font-medium">Belum Dicatat: {rekap.belum_dicatat}</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Nama GTK</th>
              <th className="px-3 py-2">Role / Jabatan</th>
              <th className="px-3 py-2">Status Presensi</th>
              <th className="px-3 py-2">Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>Memuat data presensi GTK...</td>
              </tr>
            ) : null}

            {!loading && filteredDetail.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>Belum ada data GTK untuk ditampilkan.</td>
              </tr>
            ) : null}

            {!loading && filteredDetail.map((item) => (
              <tr key={item.pengguna_id}>
                <td className="px-3 py-2 font-medium">{item.nama}</td>
                <td className="px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-[#64748b]">{item.role.replace('_', ' ')}</p>
                  <p className="text-xs text-[#64748b]">{item.jabatan || '-'}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((statusItem) => {
                      const isActive = item.status === statusItem.value
                      const tone = STATUS_BUTTON_STYLE[statusItem.value]
                      const buttonClass = isActive ? tone.active : tone.inactive

                      return (
                        <button
                          key={statusItem.value}
                          type="button"
                          onClick={() => handleStatusChange(item.pengguna_id, statusItem.value)}
                          disabled={saving}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${buttonClass} disabled:opacity-50`}
                        >
                          {statusItem.label}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-[#64748b]">
                  {item.status !== 'belum_dicatat' ? (
                    <>
                      <p>Oleh: {item.sumber_pencatatan === 'chat' ? 'Chat AI' : 'Panel'}</p>
                      {item.jam_masuk && <p>Masuk: {item.jam_masuk}</p>}
                    </>
                  ) : (
                    'Belum ada data'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PresensiGTKPanel
