import { useEffect, useMemo, useState } from 'react'
import {
  createKelompok,
  deleteKelompok,
  fetchKelompok,
  fetchManagedUsers,
  updateKelompok,
} from '../../lib/settingsManagement'

function KelompokManagementPanel() {
  const [kelompokList, setKelompokList] = useState([])
  const [guruList, setGuruList] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [namaKelompok, setNamaKelompok] = useState('')
  const [waliKelasId, setWaliKelasId] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    nama_kelompok: '',
    wali_kelas_id: '',
  })

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const loadData = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')
    try {
      const [kelompokData, usersData] = await Promise.all([
        fetchKelompok(token),
        fetchManagedUsers(token),
      ])
      setKelompokList(kelompokData)
      const gurus = usersData.filter((item) => (item?.role || '').toLowerCase() === 'guru')
      setGuruList(gurus)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat data kelompok')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredKelompokList = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    if (!search) return kelompokList

    return kelompokList.filter((item) => {
      const waliName = guruList.find((guru) => guru.id === item.wali_kelas_id)?.nama || ''
      return `${item.nama_kelompok || ''} ${waliName}`.toLowerCase().includes(search)
    })
  }, [kelompokList, guruList, searchQuery])

  const summary = useMemo(() => {
    const total = kelompokList.length
    const denganWali = kelompokList.filter((item) => Boolean(item.wali_kelas_id)).length
    return {
      total,
      tanpaWali: total - denganWali,
      denganWali,
      tampil: filteredKelompokList.length,
    }
  }, [kelompokList, filteredKelompokList])

  const handleCreate = async (ev) => {
    ev.preventDefault()
    if (!namaKelompok.trim()) {
      setError('Nama kelompok wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createKelompok(token, {
        nama_kelompok: namaKelompok.trim(),
        wali_kelas_id: waliKelasId || null,
      })
      setSuccess('Kelompok berhasil ditambahkan')
      setNamaKelompok('')
      setWaliKelasId('')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menambah kelompok')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({
      nama_kelompok: item.nama_kelompok || '',
      wali_kelas_id: item.wali_kelas_id || '',
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ nama_kelompok: '', wali_kelas_id: '' })
  }

  const handleUpdate = async (kelompokId) => {
    if (!editForm.nama_kelompok.trim()) {
      setError('Nama kelompok wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateKelompok(token, kelompokId, {
        nama_kelompok: editForm.nama_kelompok.trim(),
        wali_kelas_id: editForm.wali_kelas_id || null,
      })
      setSuccess('Kelompok berhasil diperbarui')
      cancelEdit()
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memperbarui kelompok')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (kelompokId) => {
    const agree = window.confirm('Hapus kelompok ini?')
    if (!agree) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteKelompok(token, kelompokId)
      setSuccess('Kelompok berhasil dihapus')
      if (editingId === kelompokId) {
        cancelEdit()
      }
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menghapus kelompok')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Buat Kelompok Baru</p>
        <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" onSubmit={handleCreate}>
          <input
            className={inputClass}
            placeholder="Nama kelompok"
            value={namaKelompok}
            onChange={(ev) => setNamaKelompok(ev.target.value)}
          />
          <select className={inputClass} value={waliKelasId} onChange={(ev) => setWaliKelasId(ev.target.value)}>
            <option value="">Pilih wali kelas (opsional)</option>
            {guruList.map((guru) => (
              <option key={guru.id} value={guru.id}>
                {guru.nama}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Tambah Kelompok'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Filter Kelompok</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            value={searchQuery}
            onChange={(ev) => setSearchQuery(ev.target.value)}
            placeholder="Cari nama kelompok atau wali kelas"
          />
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
          >
            Reset Filter
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[#334155]">Total: {summary.total}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Dengan wali: {summary.denganWali}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Tanpa wali: {summary.tanpaWali}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Tampil: {summary.tampil}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Kelompok</th>
              <th className="px-3 py-2">Wali Kelas</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>
                  Memuat data kelompok...
                </td>
              </tr>
            ) : null}

            {!loading && filteredKelompokList.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>
                  Belum ada data kelompok.
                </td>
              </tr>
            ) : null}

            {!loading
              ? filteredKelompokList.map((item) => {
                  const isEditing = editingId === item.id
                  const waliName = guruList.find((guru) => guru.id === item.wali_kelas_id)?.nama || '-'

                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className={inputClass}
                            value={editForm.nama_kelompok}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, nama_kelompok: ev.target.value }))}
                          />
                        ) : (
                          item.nama_kelompok
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            className={inputClass}
                            value={editForm.wali_kelas_id}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, wali_kelas_id: ev.target.value }))}
                          >
                            <option value="">Tanpa wali kelas</option>
                            {guruList.map((guru) => (
                              <option key={guru.id} value={guru.id}>
                                {guru.nama}
                              </option>
                            ))}
                          </select>
                        ) : (
                          waliName
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdate(item.id)}
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
                              onClick={() => startEdit(item)}
                              className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc]"
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={saving}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            Hapus
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

export default KelompokManagementPanel
