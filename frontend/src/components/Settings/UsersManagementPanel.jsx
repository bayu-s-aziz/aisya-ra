import { useEffect, useState } from 'react'
import {
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

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    nama: '',
    email: '',
    password: '',
    role: 'guru',
    telepon: '',
    jabatan: '',
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

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditForm({
      nama: user.nama || '',
      email: user.email || '',
      password: '',
      role: user.role || 'guru',
      telepon: user.telepon || '',
      jabatan: user.jabatan || '',
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
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={5}>
                  Memuat data pengguna...
                </td>
              </tr>
            ) : null}

            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={5}>
                  Belum ada data pengguna.
                </td>
              </tr>
            ) : null}

            {!loading
              ? users.map((user) => {
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
