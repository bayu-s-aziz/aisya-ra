import { useEffect, useMemo, useState } from 'react'
import {
  createSiswa,
  deactivateSiswa,
  fetchKelompok,
  fetchSiswa,
  importSiswaFromFile,
  updateSiswa,
} from '../../lib/settingsManagement'
import AppModal from '../Modal/AppModal'

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false)
  const [targetSiswaStatus, setTargetSiswaStatus] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [createForm, setCreateForm] = useState({
    nama: '',
    nis: '',
    nisn: '',
    nik: '',
    jenis_kelamin: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    tingkat_rombel: '',
    no_telepon: '',
    alamat: '',
    kebutuhan_khusus: '',
    disabilitas: '',
    nomor_kip_pip: '',
    nama_ayah_kandung: '',
    nama_ibu_kandung: '',
    nama_wali: '',
    kelompok_id: '',
    status_aktif: true,
  })
  const [editForm, setEditForm] = useState({
    nama: '',
    nis: '',
    nisn: '',
    nik: '',
    jenis_kelamin: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    tingkat_rombel: '',
    no_telepon: '',
    alamat: '',
    kebutuhan_khusus: '',
    disabilitas: '',
    nomor_kip_pip: '',
    nama_ayah_kandung: '',
    nama_ibu_kandung: '',
    nama_wali: '',
    kelompok_id: '',
    status_aktif: true,
  })

  const [importFile, setImportFile] = useState(null)
  const [importKelompokId, setImportKelompokId] = useState('')

  const kelompokMap = useMemo(() => {
    return new Map(kelompokList.map((item) => [item.id, item.nama_kelompok]))
  }, [kelompokList])

  const getKelompokNameById = (kelompokId) => {
    if (!kelompokId) return 'Belum dipilih'
    return kelompokMap.get(kelompokId) || 'Tidak ditemukan'
  }

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
        : `${item.nama || ''} ${item.nis || ''} ${item.nisn || ''} ${item.nik || ''} ${kelompokMap.get(item.kelompok_id) || ''}`
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
      nisn: '',
      nik: '',
      jenis_kelamin: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      tingkat_rombel: '',
      no_telepon: '',
      alamat: '',
      kebutuhan_khusus: '',
      disabilitas: '',
      nomor_kip_pip: '',
      nama_ayah_kandung: '',
      nama_ibu_kandung: '',
      nama_wali: '',
      kelompok_id: '',
      status_aktif: true,
    })
  }

  const cancelEdit = () => {
    setIsEditModalOpen(false)
    setEditingId(null)
    setEditForm({
      nama: '',
      nis: '',
      nisn: '',
      nik: '',
      jenis_kelamin: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      tingkat_rombel: '',
      no_telepon: '',
      alamat: '',
      kebutuhan_khusus: '',
      disabilitas: '',
      nomor_kip_pip: '',
      nama_ayah_kandung: '',
      nama_ibu_kandung: '',
      nama_wali: '',
      kelompok_id: '',
      status_aktif: true,
    })
  }

  const handleCreate = async () => {
    const nama = createForm.nama.trim()
    if (!nama) {
      setError('Nama siswa wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const agree = window.confirm(
      `Simpan siswa baru "${nama}" dengan kelompok "${getKelompokNameById(createForm.kelompok_id)}"?`,
    )
    if (!agree) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createSiswa(token, {
        nama,
        nis: createForm.nis.trim() || undefined,
        nisn: createForm.nisn.trim() || undefined,
        nik: createForm.nik.trim() || undefined,
        jenis_kelamin: createForm.jenis_kelamin || undefined,
        tempat_lahir: createForm.tempat_lahir.trim() || undefined,
        tanggal_lahir: createForm.tanggal_lahir || undefined,
        tingkat_rombel: createForm.tingkat_rombel.trim() || undefined,
        no_telepon: createForm.no_telepon.trim() || undefined,
        alamat: createForm.alamat.trim() || undefined,
        kebutuhan_khusus: createForm.kebutuhan_khusus.trim() || undefined,
        disabilitas: createForm.disabilitas.trim() || undefined,
        nomor_kip_pip: createForm.nomor_kip_pip.trim() || undefined,
        nama_ayah_kandung: createForm.nama_ayah_kandung.trim() || undefined,
        nama_ibu_kandung: createForm.nama_ibu_kandung.trim() || undefined,
        nama_wali: createForm.nama_wali.trim() || undefined,
        kelompok_id: createForm.kelompok_id || undefined,
        status_aktif: createForm.status_aktif,
      })
      setSuccess('Data siswa berhasil ditambahkan')
      resetCreateForm()
      setIsCreateModalOpen(false)
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
      nisn: siswa.nisn || '',
      nik: siswa.nik || '',
      jenis_kelamin: siswa.jenis_kelamin || '',
      tempat_lahir: siswa.tempat_lahir || '',
      tanggal_lahir: siswa.tanggal_lahir || '',
      tingkat_rombel: siswa.tingkat_rombel || '',
      no_telepon: siswa.no_telepon || '',
      alamat: siswa.alamat || '',
      kebutuhan_khusus: siswa.kebutuhan_khusus || '',
      disabilitas: siswa.disabilitas || '',
      nomor_kip_pip: siswa.nomor_kip_pip || '',
      nama_ayah_kandung: siswa.nama_ayah_kandung || '',
      nama_ibu_kandung: siswa.nama_ibu_kandung || '',
      nama_wali: siswa.nama_wali || '',
      kelompok_id: siswa.kelompok_id || '',
      status_aktif: Boolean(siswa.status_aktif),
    })
    setIsEditModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleUpdate = async (siswaId) => {
    const nama = editForm.nama.trim()
    if (!nama) {
      setError('Nama siswa wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const agree = window.confirm(
      `Simpan perubahan siswa "${nama}" dengan kelompok "${getKelompokNameById(editForm.kelompok_id)}"?`,
    )
    if (!agree) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateSiswa(token, siswaId, {
        nama,
        nis: editForm.nis.trim() || null,
        nisn: editForm.nisn.trim() || null,
        nik: editForm.nik.trim() || null,
        jenis_kelamin: editForm.jenis_kelamin || null,
        tempat_lahir: editForm.tempat_lahir.trim() || null,
        tanggal_lahir: editForm.tanggal_lahir || null,
        tingkat_rombel: editForm.tingkat_rombel.trim() || null,
        no_telepon: editForm.no_telepon.trim() || null,
        alamat: editForm.alamat.trim() || null,
        kebutuhan_khusus: editForm.kebutuhan_khusus.trim() || null,
        disabilitas: editForm.disabilitas.trim() || null,
        nomor_kip_pip: editForm.nomor_kip_pip.trim() || null,
        nama_ayah_kandung: editForm.nama_ayah_kandung.trim() || null,
        nama_ibu_kandung: editForm.nama_ibu_kandung.trim() || null,
        nama_wali: editForm.nama_wali.trim() || null,
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

  const runToggleStatus = async (siswa) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

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

  const handleToggleStatus = async (siswa) => {
    if (siswa.status_aktif) {
      setTargetSiswaStatus(siswa)
      setIsDeactivateConfirmOpen(true)
      return
    }

    await runToggleStatus(siswa)
  }

  const handleConfirmDeactivate = async () => {
    if (!targetSiswaStatus) return

    const selectedSiswa = targetSiswaStatus
    setIsDeactivateConfirmOpen(false)
    setTargetSiswaStatus(null)
    await runToggleStatus(selectedSiswa)
  }

  const handleImport = async () => {
    if (!importFile) {
      setError('Pilih file CSV/XLSX terlebih dahulu untuk import')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const agree = window.confirm(
      `Lanjutkan import data siswa dari file "${importFile.name}" ke kelompok "${getKelompokNameById(importKelompokId)}"?`,
    )
    if (!agree) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await importSiswaFromFile(token, importFile, importKelompokId || undefined)
      setSuccess(result?.message || 'Import siswa berhasil')
      setImportFile(null)
      setImportKelompokId('')
      setIsImportModalOpen(false)
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
        <p className="text-sm font-semibold text-[#0f172a]">Aksi Data Siswa</p>
        <p className="mt-1 text-xs text-[#64748b]">Semua tambah dan ubah data siswa dibuka dalam modal terpisah dengan konfirmasi sebelum menyimpan.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setImportFile(null)
              setImportKelompokId('')
              setIsImportModalOpen(true)
            }}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
          >
            Import Data Siswa
          </button>
          <button
            type="button"
            onClick={() => {
              resetCreateForm()
              setIsCreateModalOpen(true)
            }}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617]"
          >
            Tambah Siswa Manual
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
              ? filteredSiswaList.map((siswa) => (
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
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(siswa)}
                          className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc]"
                        >
                          Edit
                        </button>

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
                ))
              : null}
          </tbody>
        </table>
      </div>

      <AppModal
        isOpen={isDeactivateConfirmOpen}
        onClose={() => {
          if (!saving) {
            setIsDeactivateConfirmOpen(false)
            setTargetSiswaStatus(null)
          }
        }}
        title="Konfirmasi Nonaktifkan Siswa"
        description={`Status siswa ${targetSiswaStatus?.nama || ''} akan diubah menjadi nonaktif.`}
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setIsDeactivateConfirmOpen(false)
              setTargetSiswaStatus(null)
            }}
            disabled={saving}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmDeactivate}
            disabled={saving || !targetSiswaStatus}
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {saving ? 'Memproses...' : 'Ya, Nonaktifkan'}
          </button>
        </div>
      </AppModal>

      <AppModal
        isOpen={isImportModalOpen}
        onClose={() => {
          if (!saving) {
            setIsImportModalOpen(false)
          }
        }}
        title="Import Data Siswa"
        description="Unggah file CSV/XLSX, lalu konfirmasi sebelum data diproses."
      >
        <div className="space-y-3">
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
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              disabled={saving}
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              Batal
            </button>
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
      </AppModal>

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!saving) {
            setIsCreateModalOpen(false)
          }
        }}
        title="Tambah Siswa"
        description="Isi data siswa pada form ini, lalu lakukan konfirmasi sebelum menyimpan."
        size="lg"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <input
            className={inputClass}
            value={createForm.nisn}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nisn: ev.target.value }))}
            placeholder="NISN (opsional)"
          />
          <input
            className={inputClass}
            value={createForm.nik}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nik: ev.target.value }))}
            placeholder="NIK (opsional)"
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
          <select
            className={inputClass}
            value={createForm.jenis_kelamin}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, jenis_kelamin: ev.target.value }))}
          >
            <option value="">Jenis Kelamin (opsional)</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
          <input
            className={inputClass}
            value={createForm.tempat_lahir}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, tempat_lahir: ev.target.value }))}
            placeholder="Tempat lahir"
          />
          <input
            className={inputClass}
            type="date"
            value={createForm.tanggal_lahir}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, tanggal_lahir: ev.target.value }))}
          />
          <input
            className={inputClass}
            value={createForm.tingkat_rombel}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, tingkat_rombel: ev.target.value }))}
            placeholder="Tingkat - Rombel"
          />
          <input
            className={inputClass}
            value={createForm.no_telepon}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, no_telepon: ev.target.value }))}
            placeholder="No telepon"
          />
          <input
            className={inputClass}
            value={createForm.nomor_kip_pip}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nomor_kip_pip: ev.target.value }))}
            placeholder="Nomor KIP/PIP"
          />
          <input
            className={inputClass}
            value={createForm.kebutuhan_khusus}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, kebutuhan_khusus: ev.target.value }))}
            placeholder="Kebutuhan khusus"
          />
          <input
            className={inputClass}
            value={createForm.disabilitas}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, disabilitas: ev.target.value }))}
            placeholder="Disabilitas"
          />
          <input
            className={inputClass}
            value={createForm.nama_ayah_kandung}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nama_ayah_kandung: ev.target.value }))}
            placeholder="Nama ayah kandung"
          />
          <input
            className={inputClass}
            value={createForm.nama_ibu_kandung}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nama_ibu_kandung: ev.target.value }))}
            placeholder="Nama ibu kandung"
          />
          <input
            className={inputClass}
            value={createForm.nama_wali}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nama_wali: ev.target.value }))}
            placeholder="Nama wali"
          />
          <input
            className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a] md:col-span-2"
            value={createForm.alamat}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, alamat: ev.target.value }))}
            placeholder="Alamat siswa"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(false)}
            disabled={saving}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Siswa'}
          </button>
        </div>
      </AppModal>

      <AppModal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!saving) {
            cancelEdit()
          }
        }}
        title="Ubah Data Siswa"
        description="Perubahan akan disimpan setelah Anda konfirmasi."
        size="lg"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className={inputClass}
            value={editForm.nama}
            onChange={(ev) => setEditForm((prev) => ({ ...prev, nama: ev.target.value }))}
            placeholder="Nama siswa"
          />
          <input
            className={inputClass}
            value={editForm.nis}
            onChange={(ev) => setEditForm((prev) => ({ ...prev, nis: ev.target.value }))}
            placeholder="NIS"
          />
          <input
            className={inputClass}
            value={editForm.nisn}
            onChange={(ev) => setEditForm((prev) => ({ ...prev, nisn: ev.target.value }))}
            placeholder="NISN"
          />
          <input
            className={inputClass}
            value={editForm.nik}
            onChange={(ev) => setEditForm((prev) => ({ ...prev, nik: ev.target.value }))}
            placeholder="NIK"
          />
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
          <select
            className={inputClass}
            value={editForm.status_aktif ? 'aktif' : 'nonaktif'}
            onChange={(ev) => setEditForm((prev) => ({ ...prev, status_aktif: ev.target.value === 'aktif' }))}
          >
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
          <select className={inputClass} value={editForm.jenis_kelamin} onChange={(ev) => setEditForm((prev) => ({ ...prev, jenis_kelamin: ev.target.value }))}>
            <option value="">Jenis kelamin</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
          <input className={inputClass} value={editForm.tempat_lahir} onChange={(ev) => setEditForm((prev) => ({ ...prev, tempat_lahir: ev.target.value }))} placeholder="Tempat lahir" />
          <input className={inputClass} type="date" value={editForm.tanggal_lahir} onChange={(ev) => setEditForm((prev) => ({ ...prev, tanggal_lahir: ev.target.value }))} />
          <input className={inputClass} value={editForm.tingkat_rombel} onChange={(ev) => setEditForm((prev) => ({ ...prev, tingkat_rombel: ev.target.value }))} placeholder="Tingkat rombel" />
          <input className={inputClass} value={editForm.no_telepon} onChange={(ev) => setEditForm((prev) => ({ ...prev, no_telepon: ev.target.value }))} placeholder="No telepon" />
          <input className={inputClass} value={editForm.nomor_kip_pip} onChange={(ev) => setEditForm((prev) => ({ ...prev, nomor_kip_pip: ev.target.value }))} placeholder="Nomor KIP/PIP" />
          <input className={inputClass} value={editForm.kebutuhan_khusus} onChange={(ev) => setEditForm((prev) => ({ ...prev, kebutuhan_khusus: ev.target.value }))} placeholder="Kebutuhan khusus" />
          <input className={inputClass} value={editForm.disabilitas} onChange={(ev) => setEditForm((prev) => ({ ...prev, disabilitas: ev.target.value }))} placeholder="Disabilitas" />
          <input className={inputClass} value={editForm.nama_ayah_kandung} onChange={(ev) => setEditForm((prev) => ({ ...prev, nama_ayah_kandung: ev.target.value }))} placeholder="Nama ayah" />
          <input className={inputClass} value={editForm.nama_ibu_kandung} onChange={(ev) => setEditForm((prev) => ({ ...prev, nama_ibu_kandung: ev.target.value }))} placeholder="Nama ibu" />
          <input className={inputClass} value={editForm.nama_wali} onChange={(ev) => setEditForm((prev) => ({ ...prev, nama_wali: ev.target.value }))} placeholder="Nama wali" />
          <input className="rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a] md:col-span-2" value={editForm.alamat} onChange={(ev) => setEditForm((prev) => ({ ...prev, alamat: ev.target.value }))} placeholder="Alamat" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              if (editingId) {
                handleUpdate(editingId)
              }
            }}
            disabled={saving || !editingId}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </AppModal>
    </div>
  )
}

StudentsManagementPanel.propTypes = {}

export default StudentsManagementPanel
