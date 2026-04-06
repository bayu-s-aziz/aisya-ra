import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchKelompok,
  fetchPresensiRekap,
  fetchPresensiRekapPeriode,
  savePresensiBatch,
} from '../../lib/settingsManagement'

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'izin', label: 'Izin' },
  { value: 'alpha', label: 'Alpha' },
]

const DEFAULT_STATUS = 'hadir'
const VALID_STATUS = new Set(STATUS_OPTIONS.map((item) => item.value))
const MODE_OPTIONS = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
]

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
  return VALID_STATUS.has(status) ? status : DEFAULT_STATUS
}

function formatDateLabel(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateCompact(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
  })
}

function getPeriodStatusBadge(status) {
  if (status === 'hadir') {
    return { label: 'H', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'sakit') {
    return { label: 'S', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  if (status === 'izin') {
    return { label: 'I', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (status === 'alpha') {
    return { label: 'A', className: 'border-slate-300 bg-slate-100 text-slate-700' }
  }
  return { label: '-', className: 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]' }
}

function PresensiManagementPanel() {
  const [kelompokList, setKelompokList] = useState([])
  const [selectedKelompokId, setSelectedKelompokId] = useState('')
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate())
  const [selectedMode, setSelectedMode] = useState('harian')
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [rekap, setRekap] = useState(null)
  const [periodeRekap, setPeriodeRekap] = useState(null)
  const [statusMap, setStatusMap] = useState({})
  const [keteranganMap, setKeteranganMap] = useState({})

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  useEffect(() => {
    const loadKelompok = async () => {
      const token = localStorage.getItem('aisya_access_token')
      if (!token) return

      setLoading(true)
      setError('')
      try {
        const kelompokData = await fetchKelompok(token)

        setKelompokList(kelompokData)
        if (kelompokData.length > 0) {
          setSelectedKelompokId(kelompokData[0].id)
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Gagal memuat kelompok')
      } finally {
        setLoading(false)
      }
    }

    loadKelompok()
  }, [])

  const loadRekap = useCallback(async (options = {}) => {
    const { resetMessage = true } = options

    if (!selectedKelompokId || !selectedDate) {
      setError('Pilih tanggal dan kelompok terlebih dahulu')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    if (resetMessage) {
      setError('')
      setSuccess('')
    }
    try {
      const data = await fetchPresensiRekap(token, selectedKelompokId, selectedDate)
      setRekap(data)
      setPeriodeRekap(null)

      const nextStatusMap = {}
      const nextKeteranganMap = {}
      ;(data?.detail || []).forEach((item) => {
        nextStatusMap[item.siswa_id] = normalizeStatus(item.status)
        nextKeteranganMap[item.siswa_id] = item.keterangan || ''
      })
      setStatusMap(nextStatusMap)
      setKeteranganMap(nextKeteranganMap)
      setIsDirty(false)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat rekap presensi')
      setRekap(null)
      setStatusMap({})
      setKeteranganMap({})
      setIsDirty(false)
    } finally {
      setLoading(false)
    }
  }, [selectedKelompokId, selectedDate])

  const loadPeriodeRekap = useCallback(async () => {
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
      const data = await fetchPresensiRekapPeriode(token, selectedKelompokId, selectedDate, selectedMode)
      setPeriodeRekap(data)
      setRekap(null)
      setStatusMap({})
      setKeteranganMap({})
      setIsDirty(false)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat rekap periode presensi')
      setPeriodeRekap(null)
      setRekap(null)
      setStatusMap({})
      setKeteranganMap({})
      setIsDirty(false)
    } finally {
      setLoading(false)
    }
  }, [selectedKelompokId, selectedDate, selectedMode])

  useEffect(() => {
    if (!selectedKelompokId || !selectedDate) return
    if (selectedMode === 'harian') {
      loadRekap()
      return
    }

    loadPeriodeRekap()
  }, [selectedKelompokId, selectedDate, selectedMode, loadRekap, loadPeriodeRekap])

  const recordsToSave = useMemo(() => {
    return Object.entries(statusMap)
      .map(([siswaId, status]) => ({
        siswa_id: siswaId,
        status: normalizeStatus(status),
        keterangan: keteranganMap[siswaId]?.trim() || undefined,
        sumber_pencatatan: 'manual_panel',
      }))
  }, [statusMap, keteranganMap])

  const filteredDetail = useMemo(() => {
    const detail = rekap?.detail || []
    const search = searchQuery.trim().toLowerCase()
    if (!search) return detail

    return detail.filter((item) => (item.nama || '').toLowerCase().includes(search))
  }, [rekap, searchQuery])

  const filteredPeriodSiswa = useMemo(() => {
    const detail = periodeRekap?.detail_siswa || []
    const search = searchQuery.trim().toLowerCase()
    if (!search) return detail

    return detail.filter((item) => (item.nama || '').toLowerCase().includes(search))
  }, [periodeRekap, searchQuery])

  const periodHeaders = useMemo(() => {
    return (periodeRekap?.detail_harian || []).map((item) => item.tanggal)
  }, [periodeRekap])

  const periodTableColSpan = periodHeaders.length + 7

  const selectedKelompokName = useMemo(() => {
    return kelompokList.find((item) => item.id === selectedKelompokId)?.nama_kelompok || '-'
  }, [kelompokList, selectedKelompokId])

  const statusSummary = useMemo(() => {
    const summaryMap = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0,
    }

    ;(rekap?.detail || []).forEach((item) => {
      const currentStatus = normalizeStatus(statusMap[item.siswa_id])
      summaryMap[currentStatus] = (summaryMap[currentStatus] || 0) + 1
    })

    return summaryMap
  }, [rekap, statusMap])

  const handleBulkStatus = (statusValue) => {
    if (!rekap?.detail || filteredDetail.length === 0) return
    setStatusMap((prev) => {
      const next = { ...prev }
      filteredDetail.forEach((item) => {
        next[item.siswa_id] = statusValue
      })
      return next
    })
    setIsDirty(true)
  }

  const handleStatusChange = (siswaId, statusValue) => {
    const normalized = normalizeStatus(statusValue)
    setStatusMap((prev) => ({ ...prev, [siswaId]: normalized }))
    setIsDirty(true)
  }

  const handleSave = useCallback(async () => {
    if (!selectedKelompokId || !selectedDate) {
      setError('Pilih tanggal dan kelompok terlebih dahulu')
      return
    }

    const confirmed = window.confirm(
      `Simpan presensi ${recordsToSave.length} siswa untuk kelompok "${selectedKelompokName}" pada tanggal ${selectedDate}?`,
    )
    if (!confirmed) return

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

      setIsDirty(false)
      await loadRekap({ resetMessage: false })
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Gagal menyimpan presensi'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [selectedKelompokId, selectedDate, recordsToSave, selectedKelompokName, loadRekap])

  const summary = rekap
    ? `Total siswa: ${rekap.total_siswa} | Hadir: ${statusSummary.hadir} | Sakit: ${statusSummary.sakit} | Izin: ${statusSummary.izin} | Alpha: ${statusSummary.alpha}`
    : ''

  const summaryPeriode = periodeRekap
    ? `Periode: ${formatDateLabel(periodeRekap.tanggal_mulai)} - ${formatDateLabel(periodeRekap.tanggal_selesai)} | Total siswa: ${periodeRekap.total_siswa} | Slot presensi: ${periodeRekap.summary.total_slot_presensi} | Hadir: ${periodeRekap.summary.hadir} | Sakit: ${periodeRekap.summary.sakit} | Izin: ${periodeRekap.summary.izin} | Alpha: ${periodeRekap.summary.alpha} | Belum dicatat: ${periodeRekap.summary.belum_dicatat} | Persentase hadir: ${periodeRekap.summary.persentase_hadir}%`
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

          <select
            className={inputClass}
            value={selectedMode}
            onChange={(ev) => setSelectedMode(ev.target.value)}
          >
            {MODE_OPTIONS.map((modeItem) => (
              <option key={modeItem.value} value={modeItem.value}>
                {modeItem.label}
              </option>
            ))}
          </select>

          {selectedMode === 'harian' ? (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !rekap || loading}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Presensi'}
            </button>
          ) : (
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
              Mode {selectedMode} hanya untuk melihat hasil rekap presensi.
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-[#64748b]">Data otomatis dimuat saat mode, tanggal, atau kelompok diubah.</p>

        {selectedMode === 'harian' ? <p className="mt-2 text-xs text-[#64748b]">Setiap simpan presensi memerlukan konfirmasi.</p> : null}

        {selectedMode === 'harian' ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
            <input
              className={inputClass}
              value={searchQuery}
              onChange={(ev) => setSearchQuery(ev.target.value)}
              placeholder="Cari nama siswa"
            />
            <button
              type="button"
              onClick={() => handleBulkStatus('hadir')}
              disabled={!rekap || filteredDetail.length === 0}
              className="rounded-full border border-emerald-200 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              Tandai Semua Hadir
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('sakit')}
              disabled={!rekap || filteredDetail.length === 0}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              Tandai Semua Sakit
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('izin')}
              disabled={!rekap || filteredDetail.length === 0}
              className="rounded-full border border-amber-200 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60"
            >
              Tandai Semua Izin
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus('alpha')}
              disabled={!rekap || filteredDetail.length === 0}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Tandai Semua Alpha
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <input
              className={inputClass}
              value={searchQuery}
              onChange={(ev) => setSearchQuery(ev.target.value)}
              placeholder="Cari nama siswa"
            />
          </div>
        )}
      </div>

      {rekap ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#334155] shadow-sm">
          <p className="font-semibold text-[#0f172a]">{rekap.kelompok_nama} - {rekap.tanggal}</p>
          <p className="mt-1 text-xs text-[#64748b]">{summary}</p>
        </div>
      ) : null}

      {periodeRekap ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#334155] shadow-sm">
          <p className="font-semibold text-[#0f172a]">{periodeRekap.kelompok_nama} - Rekap {selectedMode}</p>
          <p className="mt-1 text-xs text-[#64748b]">{summaryPeriode}</p>
        </div>
      ) : null}

      {selectedMode === 'harian' ? (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
          <table className="min-w-full divide-y divide-[#e2e8f0]">
            <thead className="bg-[#f8fafc]">
              <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                <th className="px-3 py-2">Nama Siswa</th>
                <th className="px-3 py-2">Status Presensi</th>
                <th className="px-3 py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={3}>Memuat data presensi...</td>
                </tr>
              ) : null}

              {!loading && filteredDetail.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={3}>Belum ada data presensi untuk filter ini.</td>
                </tr>
              ) : null}

              {!loading && filteredDetail.length > 0
                ? filteredDetail.map((item) => (
                    <tr key={item.siswa_id}>
                      <td className="px-3 py-2">{item.nama}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((statusItem) => {
                            const isActive = normalizeStatus(statusMap[item.siswa_id]) === statusItem.value
                            const tone = STATUS_BUTTON_STYLE[statusItem.value] || STATUS_BUTTON_STYLE.hadir
                            const buttonClass = isActive ? tone.active : tone.inactive

                            return (
                              <button
                                key={statusItem.value}
                                type="button"
                                onClick={() => handleStatusChange(item.siswa_id, statusItem.value)}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${buttonClass}`}
                              >
                                {statusItem.label}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClass}
                          value={keteranganMap[item.siswa_id] || ''}
                          onChange={(ev) => {
                            const value = ev.target.value
                            setKeteranganMap((prev) => ({ ...prev, [item.siswa_id]: value }))
                            setIsDirty(true)
                          }}
                          placeholder="Catatan singkat"
                        />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
          <table className="min-w-full divide-y divide-[#e2e8f0]">
            <thead className="bg-[#f8fafc]">
              <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                <th className="px-3 py-2">Nama Siswa</th>
                {periodHeaders.map((tanggal) => (
                  <th key={tanggal} className="px-3 py-2">{formatDateCompact(tanggal)}</th>
                ))}
                <th className="px-3 py-2">Hadir</th>
                <th className="px-3 py-2">Sakit</th>
                <th className="px-3 py-2">Izin</th>
                <th className="px-3 py-2">Alpha</th>
                <th className="px-3 py-2">Belum Dicatat</th>
                <th className="px-3 py-2">% Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
              {loading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={periodTableColSpan}>Memuat data rekap presensi siswa...</td>
                </tr>
              ) : null}

              {!loading && filteredPeriodSiswa.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={periodTableColSpan}>Belum ada data presensi siswa pada periode ini.</td>
                </tr>
              ) : null}

              {!loading
                ? filteredPeriodSiswa.map((item) => (
                    <tr key={item.siswa_id}>
                      <td className="px-3 py-2 font-medium">{item.nama}</td>
                      {(item.status_per_tanggal || []).map((statusItem) => {
                        const badge = getPeriodStatusBadge(statusItem.status)
                        return (
                          <td key={`${item.siswa_id}-${statusItem.tanggal}`} className="px-3 py-2">
                            <span className={`inline-flex min-w-6 items-center justify-center rounded-full border px-2 py-0.5 text-xs ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2">{item.hadir}</td>
                      <td className="px-3 py-2">{item.sakit}</td>
                      <td className="px-3 py-2">{item.izin}</td>
                      <td className="px-3 py-2">{item.alpha}</td>
                      <td className="px-3 py-2">{item.belum_dicatat}</td>
                      <td className="px-3 py-2">{item.persentase_hadir}%</td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PresensiManagementPanel
