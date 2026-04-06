import { useEffect, useMemo, useState } from 'react'
import {
  fetchKelompok,
  fetchPresensiRekap,
  savePresensiBatch,
} from '../../lib/settingsManagement'
import { fetchAuthMeData } from '../../lib/authMe'
import { saveRAProfile } from '../../lib/raProfile'

const MANAGE_RA_ROLES = ['kepala_ra', 'kepala', 'admin', 'admin_ra']

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
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [rekap, setRekap] = useState(null)
  const [statusMap, setStatusMap] = useState({})
  const [keteranganMap, setKeteranganMap] = useState({})
  const [activeTahunAjaran, setActiveTahunAjaran] = useState('')
  const [tahunAjaranDraft, setTahunAjaranDraft] = useState('')
  const [canManageAcademicYear, setCanManageAcademicYear] = useState(false)
  const [savingAcademicYear, setSavingAcademicYear] = useState(false)

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  useEffect(() => {
    const loadKelompok = async () => {
      const token = localStorage.getItem('aisya_access_token')
      if (!token) return

      setLoading(true)
      setError('')
      try {
        const [kelompokData, me] = await Promise.all([
          fetchKelompok(token),
          fetchAuthMeData(token),
        ])

        setKelompokList(kelompokData)
        if (kelompokData.length > 0) {
          setSelectedKelompokId(kelompokData[0].id)
        }

        const nextTahunAjaran = me?.ra_profile?.tahun_ajaran || ''
        setActiveTahunAjaran(nextTahunAjaran)
        setTahunAjaranDraft(nextTahunAjaran)

        const roleLower = (me?.profile?.role || '').toLowerCase()
        setCanManageAcademicYear(MANAGE_RA_ROLES.includes(roleLower))
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
      const nextKeteranganMap = {}
      ;(data?.detail || []).forEach((item) => {
        nextStatusMap[item.siswa_id] = item.status || 'belum_dicatat'
        nextKeteranganMap[item.siswa_id] = item.keterangan || ''
      })
      setStatusMap(nextStatusMap)
      setKeteranganMap(nextKeteranganMap)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat rekap presensi')
      setRekap(null)
      setStatusMap({})
      setKeteranganMap({})
    } finally {
      setLoading(false)
    }
  }

  const recordsToSave = useMemo(() => {
    return Object.entries(statusMap)
      .filter(([, status]) => status && status !== 'belum_dicatat')
      .map(([siswaId, status]) => ({
        siswa_id: siswaId,
        status,
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

  const statusSummary = useMemo(() => {
    const summaryMap = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0,
      belum_dicatat: 0,
    }

    ;(rekap?.detail || []).forEach((item) => {
      const currentStatus = statusMap[item.siswa_id] || 'belum_dicatat'
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
  }

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

  const handleSaveTahunAjaranAktif = async () => {
    if (!tahunAjaranDraft.trim()) {
      setError('Tahun pelajaran aktif wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSavingAcademicYear(true)
    setError('')
    setSuccess('')
    try {
      await saveRAProfile(token, { tahun_ajaran: tahunAjaranDraft.trim() })
      setActiveTahunAjaran(tahunAjaranDraft.trim())
      setSuccess('Tahun pelajaran aktif berhasil diperbarui')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memperbarui tahun pelajaran aktif')
    } finally {
      setSavingAcademicYear(false)
    }
  }

  const summary = rekap
    ? `Hadir: ${statusSummary.hadir} | Sakit: ${statusSummary.sakit} | Izin: ${statusSummary.izin} | Alpha: ${statusSummary.alpha} | Belum dicatat: ${statusSummary.belum_dicatat}`
    : ''

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Tahun Pelajaran Aktif</p>
        <p className="mt-1 text-xs text-[#64748b]">
          Pengaturan ini dipakai lintas modul operasional AISYA.
        </p>

        {canManageAcademicYear ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className={inputClass}
              value={tahunAjaranDraft}
              onChange={(ev) => setTahunAjaranDraft(ev.target.value)}
              placeholder="Contoh: 2026/2027"
            />
            <button
              type="button"
              onClick={handleSaveTahunAjaranAktif}
              disabled={savingAcademicYear}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
            >
              {savingAcademicYear ? 'Menyimpan...' : 'Simpan Tahun Aktif'}
            </button>
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#334155]">
              Aktif saat ini: <span className="font-medium text-[#0f172a]">{activeTahunAjaran || '-'}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#334155]">
            Tahun pelajaran aktif: <span className="font-medium text-[#0f172a]">{activeTahunAjaran || '-'}</span>
          </div>
        )}
      </div>

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

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
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
            onClick={() => handleBulkStatus('izin')}
            disabled={!rekap || filteredDetail.length === 0}
            className="rounded-full border border-amber-200 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60"
          >
            Tandai Semua Izin
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus('belum_dicatat')}
            disabled={!rekap || filteredDetail.length === 0}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-60"
          >
            Kosongkan Status
          </button>
        </div>
      </div>

      {rekap ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#334155] shadow-sm">
          <p className="font-semibold text-[#0f172a]">{rekap.kelompok_nama} - {rekap.tanggal}</p>
          {activeTahunAjaran ? <p className="mt-1 text-xs text-[#64748b]">Tahun aktif: {activeTahunAjaran}</p> : null}
          <p className="mt-1 text-xs text-[#64748b]">{summary}</p>
        </div>
      ) : null}

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
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={keteranganMap[item.siswa_id] || ''}
                        onChange={(ev) => {
                          const value = ev.target.value
                          setKeteranganMap((prev) => ({ ...prev, [item.siswa_id]: value }))
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
    </div>
  )
}

export default PresensiManagementPanel
