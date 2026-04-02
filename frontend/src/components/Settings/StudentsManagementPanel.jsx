import { useEffect, useMemo, useState } from 'react'
import {
  createSiswa,
  deactivateSiswa,
  fetchKelompok,
  fetchSiswa,
  importSiswaFromFile,
  updateSiswa,
} from '../../lib/settingsManagement'

function StudentsManagementPanel() {
  const [kelompokList, setKelompokList] = useState([])
  const [siswaList, setSiswaList] = useState([])
  const [filterKelompokId, setFilterKelompokId] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [createForm, setCreateForm] = useState({
    nama: '',
    nis: '',
    kelompok_id: '',
    status_aktif: true,
  })
  const [editForm, setEditForm] = useState({
    nama: '',
    nis: '',
    kelompok_id: '',
    status_aktif: true,
  })

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
    loadData(filterKelompokId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKelompokId])

  const filteredSiswaList = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    return siswaList.filter((item) => {
      const matchStatus = filterStatus === 'all'
        ? true
        : filterStatus === 'aktif'
          ? item.status_aktif
          : !item.status_aktif

      const matchSearch = !search
        ? true
        : `${item.nama || ''} ${item.nis || ''} ${kelompokMap.get(item.kelompok_id) || ''}`
          .toLowerCase()
          .includes(search)

      return matchStatus && matchSearch
    })
  }, [siswaList, filterStatus, searchQuery, kelompokMap])

  const summary = useMemo(() => {
    const total = siswaList.length
    const aktif = siswaList.filter((item) => item.status_aktif).length
    return {
      total,
      aktif,
      nonaktif: total - aktif,
      tampil: filteredSiswaList.length,
    }
  }, [siswaList, filteredSiswaList])

  const resetCreateForm = () => {
    setCreateForm({
      nama: '',
      nis: '',
      kelompok_id: '',
      status_aktif: true,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({
      nama: '',
      nis: '',
      kelompok_id: '',
      status_aktif: true,
    })
  }

  const handleCreate = async () => {
    if (!createForm.nama.trim()) {
      setError('Nama siswa wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createSiswa(token, {
        nama: createForm.nama.trim(),
        nis: createForm.nis.trim() || undefined,
        kelompok_id: createForm.kelompok_id || undefined,
        status_aktif: createForm.status_aktif,
      })
      setSuccess('Data siswa berhasil ditambahkan')
      resetCreateForm()
      await loadData(filterKelompokId)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menambah siswa')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (siswa) => {
    setEditingId(siswa.id)
    setEditForm({
      nama: siswa.nama || '',
      nis: siswa.nis || '',
      kelompok_id: siswa.kelompok_id || '',
      status_aktif: Boolean(siswa.status_aktif),
    })
    setError('')
    setSuccess('')
  }

  const handleUpdate = async (siswaId) => {
    if (!editForm.nama.trim()) {
      setError('Nama siswa wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateSiswa(token, siswaId, {
        nama: editForm.nama.trim(),
        nis: editForm.nis.trim() || null,
        kelompok_id: editForm.kelompok_id || null,
        status_aktif: editForm.status_aktif,
      })
      setSuccess('Data siswa berhasil diperbarui')
      cancelEdit()
      await loadData(filterKelompokId)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memperbarui siswa')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (siswa) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    if (siswa.status_aktif) {
      const agree = window.confirm(`Nonaktifkan siswa ${siswa.nama}?`)
      if (!agree) return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (siswa.status_aktif) {
        await deactivateSiswa(token, siswa.id)
        setSuccess('Siswa berhasil dinonaktifkan')
      } else {
        await updateSiswa(token, siswa.id, { status_aktif: true })
        setSuccess('Siswa berhasil diaktifkan kembali')
      }
      if (editingId === siswa.id) {
        cancelEdit()
      }
      await loadData(filterKelompokId)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal mengubah status siswa')
    } finally {
      setSaving(false)
    }
  }

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
        <p className="text-sm font-semibold text-[#0f172a]">Import Data Siswa (CSV/XLSX)</p>
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
        <p className="text-sm font-semibold text-[#0f172a]">Tambah Siswa Manual</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            className={inputClass}
            value={createForm.nama}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nama: ev.target.value }))}
            placeholder="Nama siswa"
          />
          <input
            className={inputClass}
            value={createForm.nis}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nis: ev.target.value }))}
            placeholder="NIS (opsional)"
          />
          <select
            className={inputClass}
            value={createForm.kelompok_id}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, kelompok_id: ev.target.value }))}
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
            value={createForm.status_aktif ? 'aktif' : 'nonaktif'}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, status_aktif: ev.target.value === 'aktif' }))}
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Tambah Siswa'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">Status</label>
            <select
              className={inputClass}
              value={filterStatus}
              onChange={(ev) => setFilterStatus(ev.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">Cari Cepat</label>
            <input
              className={inputClass}
              value={searchQuery}
              onChange={(ev) => setSearchQuery(ev.target.value)}
              placeholder="Cari nama atau NIS"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilterKelompokId('')
                setFilterStatus('all')
                setSearchQuery('')
              }}
              className="w-full rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
            >
              Reset Filter
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[#334155]">Total: {summary.total}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Aktif: {summary.aktif}</span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">Nonaktif: {summary.nonaktif}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Tampil: {summary.tampil}</span>
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
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={5}>
                  Memuat data siswa...
                </td>
              </tr>
            ) : null}

            {!loading && filteredSiswaList.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={5}>
                  Belum ada data siswa.
                </td>
              </tr>
            ) : null}

            {!loading
              ? filteredSiswaList.map((siswa) => {
                  const isEditing = editingId === siswa.id
                  return (
                    <tr key={siswa.id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className={inputClass}
                            value={editForm.nis}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, nis: ev.target.value }))}
                            placeholder="NIS"
                          />
                        ) : (
                          siswa.nis || '-'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className={inputClass}
                            value={editForm.nama}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, nama: ev.target.value }))}
                            placeholder="Nama siswa"
                          />
                        ) : (
                          siswa.nama
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            className={inputClass}
                            value={editForm.kelompok_id}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, kelompok_id: ev.target.value }))}
                          >
                            <option value="">Tanpa kelompok</option>
                            {kelompokList.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.nama_kelompok}
                              </option>
                            ))}
                          </select>
                        ) : (
                          kelompokMap.get(siswa.kelompok_id) || '-'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            className={inputClass}
                            value={editForm.status_aktif ? 'aktif' : 'nonaktif'}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, status_aktif: ev.target.value === 'aktif' }))}
                          >
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Nonaktif</option>
                          </select>
                        ) : (
                          siswa.status_aktif ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Aktif</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Nonaktif</span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdate(siswa.id)}
                                disabled={saving}
                                className="rounded-full bg-[#0f172a] px-3 py-1 text-xs font-medium text-white hover:bg-[#020617]"
                              >
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc]"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(siswa)}
                              className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc]"
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(siswa)}
                            disabled={saving}
                            className={[
                              'rounded-full px-3 py-1 text-xs disabled:opacity-50',
                              siswa.status_aktif
                                ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                            ].join(' ')}
                          >
                            {siswa.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
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
