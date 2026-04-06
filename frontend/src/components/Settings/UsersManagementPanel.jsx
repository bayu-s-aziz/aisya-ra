import { useEffect, useMemo, useState } from 'react'
import {
  createManagedUser,
  deleteManagedUser,
  fetchManagedUsers,
  importGuruFromGtkFile,
  updateManagedUser,
} from '../../lib/settingsManagement'

function getErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const lines = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const msg = item.msg || item.message || 'Validasi gagal'
          const loc = Array.isArray(item.loc) ? item.loc.join('.') : ''
          return loc ? `${loc}: ${msg}` : msg
        }
        return ''
      })
      .filter(Boolean)

    if (lines.length > 0) return lines.join('; ')
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message
    if (typeof detail.msg === 'string') return detail.msg
  }

  return err?.message || fallback
}

function UsersManagementPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [createForm, setCreateForm] = useState({
    nama: '',
    email: '',
    password: '',
    role: 'guru',
    telepon: '',
    jabatan: '',
    nik: '',
    nuptk: '',
    status_kepegawaian: '',
    nip: '',
    jenis_kelamin: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    email_akun_madrasah_digital: '',
    tugas: '',
    mata_pelajaran: '',
    penempatan: '',
    total_jtm: '',
  })

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    nama: '',
    email: '',
    password: '',
    role: 'guru',
    telepon: '',
    jabatan: '',
    nik: '',
    nuptk: '',
    status_kepegawaian: '',
    nip: '',
    jenis_kelamin: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    email_akun_madrasah_digital: '',
    tugas: '',
    mata_pelajaran: '',
    penempatan: '',
    total_jtm: '',
  })

  const [importFile, setImportFile] = useState(null)

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const loadUsers = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')
    try {
      const data = await fetchManagedUsers(token)
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memuat data pengguna'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()
    return users.filter((user) => {
      const matchRole = roleFilter === 'all' ? true : user.role === roleFilter
      const matchSearch = !search
        ? true
        : `${user.nama || ''} ${user.email || ''} ${user.jabatan || ''} ${user.nik || ''} ${user.nuptk || ''} ${user.nip || ''}`
          .toLowerCase()
          .includes(search)

      return matchRole && matchSearch
    })
  }, [users, roleFilter, searchQuery])

  const summary = useMemo(() => {
    const total = users.length
    const kepala = users.filter((user) => user.role === 'kepala_ra').length
    return {
      total,
      guru: total - kepala,
      kepala,
      tampil: filteredUsers.length,
    }
  }, [users, filteredUsers])

  const resetCreateForm = () => {
    setCreateForm({
      nama: '',
      email: '',
      password: '',
      role: 'guru',
      telepon: '',
      jabatan: '',
      nik: '',
      nuptk: '',
      status_kepegawaian: '',
      nip: '',
      jenis_kelamin: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      email_akun_madrasah_digital: '',
      tugas: '',
      mata_pelajaran: '',
      penempatan: '',
      total_jtm: '',
    })
  }

  const handleCreate = async () => {
    if (!createForm.nama.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setError('Nama, email, dan password awal wajib diisi')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createManagedUser(token, {
        nama: createForm.nama.trim(),
        email: createForm.email.trim(),
        password: createForm.password.trim(),
        role: createForm.role,
        telepon: createForm.telepon.trim() || undefined,
        jabatan: createForm.jabatan.trim() || undefined,
        nik: createForm.nik.trim() || undefined,
        nuptk: createForm.nuptk.trim() || undefined,
        status_kepegawaian: createForm.status_kepegawaian.trim() || undefined,
        nip: createForm.nip.trim() || undefined,
        jenis_kelamin: createForm.jenis_kelamin || undefined,
        tempat_lahir: createForm.tempat_lahir.trim() || undefined,
        tanggal_lahir: createForm.tanggal_lahir || undefined,
        email_akun_madrasah_digital: createForm.email_akun_madrasah_digital.trim() || undefined,
        tugas: createForm.tugas.trim() || undefined,
        mata_pelajaran: createForm.mata_pelajaran.trim() || undefined,
        penempatan: createForm.penempatan.trim() || undefined,
        total_jtm: createForm.total_jtm.trim() || undefined,
      })
      setSuccess('Pengguna baru berhasil ditambahkan')
      resetCreateForm()
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menambah pengguna'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditForm({
      nama: user.nama || '',
      email: user.email || '',
      password: '',
      role: user.role || 'guru',
      telepon: user.telepon || '',
      jabatan: user.jabatan || '',
      nik: user.nik || '',
      nuptk: user.nuptk || '',
      status_kepegawaian: user.status_kepegawaian || '',
      nip: user.nip || '',
      jenis_kelamin: user.jenis_kelamin || '',
      tempat_lahir: user.tempat_lahir || '',
      tanggal_lahir: user.tanggal_lahir || '',
      email_akun_madrasah_digital: user.email_akun_madrasah_digital || '',
      tugas: user.tugas || '',
      mata_pelajaran: user.mata_pelajaran || '',
      penempatan: user.penempatan || '',
      total_jtm: user.total_jtm || '',
    })
    setError('')
    setSuccess('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({
      nama: '',
      email: '',
      password: '',
      role: 'guru',
      telepon: '',
      jabatan: '',
      nik: '',
      nuptk: '',
      status_kepegawaian: '',
      nip: '',
      jenis_kelamin: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      email_akun_madrasah_digital: '',
      tugas: '',
      mata_pelajaran: '',
      penempatan: '',
      total_jtm: '',
    })
  }

  const handleUpdate = async (userId) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    if (!editForm.nama.trim() || !editForm.email.trim()) {
      setError('Nama dan email wajib diisi')
      return
    }

    const payload = {
      nama: editForm.nama.trim(),
      email: editForm.email.trim(),
      role: editForm.role,
      telepon: editForm.telepon.trim() || undefined,
      jabatan: editForm.jabatan.trim() || undefined,
      nik: editForm.nik.trim() || undefined,
      nuptk: editForm.nuptk.trim() || undefined,
      status_kepegawaian: editForm.status_kepegawaian.trim() || undefined,
      nip: editForm.nip.trim() || undefined,
      jenis_kelamin: editForm.jenis_kelamin || undefined,
      tempat_lahir: editForm.tempat_lahir.trim() || undefined,
      tanggal_lahir: editForm.tanggal_lahir || undefined,
      email_akun_madrasah_digital: editForm.email_akun_madrasah_digital.trim() || undefined,
      tugas: editForm.tugas.trim() || undefined,
      mata_pelajaran: editForm.mata_pelajaran.trim() || undefined,
      penempatan: editForm.penempatan.trim() || undefined,
      total_jtm: editForm.total_jtm.trim() || undefined,
    }

    if (editForm.password.trim()) {
      payload.password = editForm.password.trim()
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await updateManagedUser(token, userId, payload)
      setSuccess('Pengguna berhasil diperbarui')
      cancelEdit()
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal memperbarui pengguna'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId) => {
    const agree = window.confirm('Hapus pengguna ini?')
    if (!agree) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteManagedUser(token, userId)
      setSuccess('Pengguna berhasil dihapus')
      if (editingId === userId) {
        cancelEdit()
      }
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal menghapus pengguna'))
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      setError('Pilih file CSV terlebih dahulu untuk import guru')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await importGuruFromGtkFile(token, importFile)
      setSuccess(result?.message || 'Import data guru berhasil')
      setImportFile(null)
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal import data guru'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Tambah Pengguna Manual</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            value={createForm.nama}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nama: ev.target.value }))}
            placeholder="Nama lengkap"
          />
          <input
            className={inputClass}
            type="email"
            value={createForm.email}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, email: ev.target.value }))}
            placeholder="Email"
          />
          <input
            className={inputClass}
            type="password"
            value={createForm.password}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, password: ev.target.value }))}
            placeholder="Password awal"
          />
          <select
            className={inputClass}
            value={createForm.role}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, role: ev.target.value }))}
          >
            <option value="guru">Guru</option>
            <option value="kepala_ra">Kepala RA</option>
          </select>

          <input
            className={inputClass}
            value={createForm.jabatan}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, jabatan: ev.target.value }))}
            placeholder="Jabatan"
          />
          <input
            className={inputClass}
            value={createForm.telepon}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, telepon: ev.target.value }))}
            placeholder="Telepon"
          />
          <input
            className={inputClass}
            value={createForm.nik}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nik: ev.target.value }))}
            placeholder="NIK"
          />
          <input
            className={inputClass}
            value={createForm.nuptk}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nuptk: ev.target.value }))}
            placeholder="NUPTK"
          />

          <input
            className={inputClass}
            value={createForm.nip}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, nip: ev.target.value }))}
            placeholder="NIP"
          />
          <input
            className={inputClass}
            value={createForm.status_kepegawaian}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, status_kepegawaian: ev.target.value }))}
            placeholder="Status kepegawaian"
          />
          <select
            className={inputClass}
            value={createForm.jenis_kelamin}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, jenis_kelamin: ev.target.value }))}
          >
            <option value="">Jenis kelamin</option>
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
            type="email"
            value={createForm.email_akun_madrasah_digital}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, email_akun_madrasah_digital: ev.target.value }))}
            placeholder="Email akun madrasah digital"
          />
          <input
            className={inputClass}
            value={createForm.tugas}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, tugas: ev.target.value }))}
            placeholder="Tugas"
          />
          <input
            className={inputClass}
            value={createForm.mata_pelajaran}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, mata_pelajaran: ev.target.value }))}
            placeholder="Mata pelajaran"
          />

          <input
            className={inputClass}
            value={createForm.penempatan}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, penempatan: ev.target.value }))}
            placeholder="Penempatan"
          />
          <input
            className={inputClass}
            value={createForm.total_jtm}
            onChange={(ev) => setCreateForm((prev) => ({ ...prev, total_jtm: ev.target.value }))}
            placeholder="Total JTM"
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60 md:col-span-2"
          >
            {saving ? 'Menyimpan...' : 'Tambah Pengguna'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            value={searchQuery}
            onChange={(ev) => setSearchQuery(ev.target.value)}
            placeholder="Cari nama, email, jabatan, NIK, NUPTK"
          />
          <select
            className={inputClass}
            value={roleFilter}
            onChange={(ev) => setRoleFilter(ev.target.value)}
          >
            <option value="all">Semua Role</option>
            <option value="guru">Guru</option>
            <option value="kepala_ra">Kepala RA</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setRoleFilter('all')
            }}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
          >
            Reset Filter
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[#334155]">Total: {summary.total}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Guru: {summary.guru}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Kepala RA: {summary.kepala}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Tampil: {summary.tampil}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Import Guru dari GTK (CSV)</p>
        <p className="mt-1 text-xs text-[#64748b]">Gunakan kolom seperti: Nama Lengkap, NIK, NUPTK, Status Kepegawaian, NIP, Jenis Kelamin, Tempat/Tanggal Lahir, Nomor Handphone, Email, Email Akun Madrasah Digital, Password Awal, Tugas, Mata Pelajaran, Penempatan, Total JTM.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="file"
            accept=".csv"
            className={inputClass}
            onChange={(ev) => setImportFile(ev.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
          >
            {saving ? 'Memproses...' : 'Import File Guru'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Jabatan</th>
              <th className="px-3 py-2">Data GTK</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={6}>
                  Memuat data pengguna...
                </td>
              </tr>
            ) : null}

            {!loading && filteredUsers.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={6}>
                  Belum ada data pengguna.
                </td>
              </tr>
            ) : null}

            {!loading
              ? filteredUsers.map((user) => {
                  const isEditing = editingId === user.id
                  return (
                    <tr key={user.id}>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className={inputClass}
                            value={editForm.nama}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, nama: ev.target.value }))}
                          />
                        ) : (
                          user.nama
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className={inputClass}
                            type="email"
                            value={editForm.email}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, email: ev.target.value }))}
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            className={inputClass}
                            value={editForm.role}
                            onChange={(ev) => setEditForm((prev) => ({ ...prev, role: ev.target.value }))}
                          >
                            <option value="guru">Guru</option>
                            <option value="kepala_ra">Kepala RA</option>
                          </select>
                        ) : user.role === 'kepala_ra' ? (
                          'Kepala RA'
                        ) : (
                          'Guru'
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              className={inputClass}
                              value={editForm.jabatan}
                              onChange={(ev) => setEditForm((prev) => ({ ...prev, jabatan: ev.target.value }))}
                              placeholder="Jabatan"
                            />
                            <input
                              className={inputClass}
                              value={editForm.telepon}
                              onChange={(ev) => setEditForm((prev) => ({ ...prev, telepon: ev.target.value }))}
                              placeholder="Telepon"
                            />
                            <input
                              className={inputClass}
                              type="password"
                              value={editForm.password}
                              onChange={(ev) => setEditForm((prev) => ({ ...prev, password: ev.target.value }))}
                              placeholder="Password baru (opsional)"
                            />
                          </div>
                        ) : (
                          user.jabatan || '-'
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input className={inputClass} value={editForm.nik} onChange={(ev) => setEditForm((prev) => ({ ...prev, nik: ev.target.value }))} placeholder="NIK" />
                            <input className={inputClass} value={editForm.nuptk} onChange={(ev) => setEditForm((prev) => ({ ...prev, nuptk: ev.target.value }))} placeholder="NUPTK" />
                            <input className={inputClass} value={editForm.nip} onChange={(ev) => setEditForm((prev) => ({ ...prev, nip: ev.target.value }))} placeholder="NIP" />
                            <input className={inputClass} value={editForm.status_kepegawaian} onChange={(ev) => setEditForm((prev) => ({ ...prev, status_kepegawaian: ev.target.value }))} placeholder="Status kepegawaian" />
                            <select className={inputClass} value={editForm.jenis_kelamin} onChange={(ev) => setEditForm((prev) => ({ ...prev, jenis_kelamin: ev.target.value }))}>
                              <option value="">Jenis kelamin</option>
                              <option value="Laki-laki">Laki-laki</option>
                              <option value="Perempuan">Perempuan</option>
                            </select>
                            <input className={inputClass} value={editForm.tempat_lahir} onChange={(ev) => setEditForm((prev) => ({ ...prev, tempat_lahir: ev.target.value }))} placeholder="Tempat lahir" />
                            <input className={inputClass} type="date" value={editForm.tanggal_lahir} onChange={(ev) => setEditForm((prev) => ({ ...prev, tanggal_lahir: ev.target.value }))} />
                            <input className={inputClass} type="email" value={editForm.email_akun_madrasah_digital} onChange={(ev) => setEditForm((prev) => ({ ...prev, email_akun_madrasah_digital: ev.target.value }))} placeholder="Email madrasah digital" />
                            <input className={inputClass} value={editForm.tugas} onChange={(ev) => setEditForm((prev) => ({ ...prev, tugas: ev.target.value }))} placeholder="Tugas" />
                            <input className={inputClass} value={editForm.mata_pelajaran} onChange={(ev) => setEditForm((prev) => ({ ...prev, mata_pelajaran: ev.target.value }))} placeholder="Mata pelajaran" />
                            <input className={inputClass} value={editForm.penempatan} onChange={(ev) => setEditForm((prev) => ({ ...prev, penempatan: ev.target.value }))} placeholder="Penempatan" />
                            <input className={inputClass} value={editForm.total_jtm} onChange={(ev) => setEditForm((prev) => ({ ...prev, total_jtm: ev.target.value }))} placeholder="Total JTM" />
                          </div>
                        ) : (
                          <div className="space-y-1 text-xs text-[#475569]">
                            <p>NIK: {user.nik || '-'}</p>
                            <p>NUPTK: {user.nuptk || '-'}</p>
                            <p>NIP: {user.nip || '-'}</p>
                            <p>JK: {user.jenis_kelamin || '-'}</p>
                            <p>Tugas: {user.tugas || '-'}</p>
                            <p>Mapel: {user.mata_pelajaran || '-'}</p>
                            <p>Penempatan: {user.penempatan || '-'}</p>
                            <p>Total JTM: {user.total_jtm || '-'}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdate(user.id)}
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
                              onClick={() => startEdit(user)}
                              className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc]"
                            >
                              Edit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(user.id)}
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

export default UsersManagementPanel
