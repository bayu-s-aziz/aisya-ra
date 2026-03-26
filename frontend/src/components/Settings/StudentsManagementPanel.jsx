import { useEffect, useMemo, useState } from 'react'
import {
  fetchKelompok,
  fetchSiswa,
  importSiswaFromFile,
} from '../../lib/settingsManagement'

function StudentsManagementPanel() {
  const [kelompokList, setKelompokList] = useState([])
  const [siswaList, setSiswaList] = useState([])
  const [filterKelompokId, setFilterKelompokId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [importFile, setImportFile] = useState(null)
  const [importKelompokId, setImportKelompokId] = useState('')

  const kelompokMap = useMemo(() => {
    return new Map(kelompokList.map((item) => [item.id, item.nama_kelompok]))
  }, [kelompokList])

  const loadData = async (activeFilterKelompokId = filterKelompokId) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')
    try {
      const [kelompokData, siswaData] = await Promise.all([
        fetchKelompok(token),
        fetchSiswa(token, activeFilterKelompokId || undefined),
      ])
      setKelompokList(kelompokData)
      setSiswaList(siswaData)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat data siswa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadData(filterKelompokId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKelompokId])

  const handleImport = async () => {
    if (!importFile) {
      setError('Pilih file CSV/XLSX terlebih dahulu untuk import')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await importSiswaFromFile(token, importFile, importKelompokId || undefined)
      setSuccess(result?.message || 'Import siswa berhasil')
      setImportFile(null)
      setImportKelompokId('')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal import siswa')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Import Siswa dari EMIS (CSV/XLSX)</p>
        <p className="mt-1 text-xs text-[#64748b]">Gunakan kolom seperti: Nama Lengkap, NISN, NIK, Tempat Lahir, Tanggal Lahir, Tingkat - Rombel, Status, dan lainnya.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xlsm"
            className={inputClass}
            onChange={(ev) => setImportFile(ev.target.files?.[0] || null)}
          />
          <select className={inputClass} value={importKelompokId} onChange={(ev) => setImportKelompokId(ev.target.value)}>
            <option value="">Auto dari Tingkat - Rombel</option>
            {kelompokList.map((item) => (
              <option key={item.id} value={item.id}>
                Paksa ke: {item.nama_kelompok}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleImport}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Memproses...' : 'Import File'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">Filter Kelompok</label>
            <select
              className={inputClass}
              value={filterKelompokId}
              onChange={(ev) => setFilterKelompokId(ev.target.value)}
            >
              <option value="">Semua Kelompok</option>
              {kelompokList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama_kelompok}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">NIS</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Kelompok</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>
                  Memuat data siswa...
                </td>
              </tr>
            ) : null}

            {!loading && siswaList.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={4}>
                  Belum ada data siswa.
                </td>
              </tr>
            ) : null}

            {!loading
              ? siswaList.map((siswa) => {
                  return (
                    <tr key={siswa.id}>
                      <td className="px-3 py-2">{siswa.nis || '-'}</td>
                      <td className="px-3 py-2">{siswa.nama}</td>
                      <td className="px-3 py-2">{kelompokMap.get(siswa.kelompok_id) || '-'}</td>
                      <td className="px-3 py-2">
                        {siswa.status_aktif ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Aktif</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Nonaktif</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

StudentsManagementPanel.propTypes = {}

export default StudentsManagementPanel
