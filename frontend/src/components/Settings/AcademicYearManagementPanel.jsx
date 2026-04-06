import { useEffect, useMemo, useState } from 'react'
import {
  activateAcademicYear,
  createAcademicYear,
  deleteAcademicYear,
  fetchAcademicYears,
} from '../../lib/settingsManagement'
import AppModal from '../Modal/AppModal'

function normalizeLabelInput(value) {
  return String(value || '').trim().replace(/\s+/g, '')
}

function AcademicYearManagementPanel() {
  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createModalError, setCreateModalError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const loadData = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchAcademicYears(token)
      setItems(response?.data || [])
      setActiveId(response?.activeId || '')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat tahun ajaran')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const sortedItems = useMemo(() => {
    return [...items].sort((first, second) => {
      if ((first?.is_active || false) !== (second?.is_active || false)) {
        return first.is_active ? -1 : 1
      }
      return String(second?.label || '').localeCompare(String(first?.label || ''))
    })
  }, [items])

  const summary = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.is_active).length,
      archived: items.filter((item) => !item.is_active).length,
    }
  }, [items])

  const handleCreate = async () => {
    const label = normalizeLabelInput(labelInput)
    if (!label) {
      setCreateModalError('Label tahun ajaran wajib diisi')
      return
    }

    const confirmed = window.confirm(`Simpan tahun ajaran baru "${label}"?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setCreateModalError('')
    setError('')
    setSuccess('')

    try {
      await createAcademicYear(token, {
        label,
      })
      setSuccess('Tahun ajaran berhasil ditambahkan')
      setLabelInput('')
      setCreateModalError('')
      setIsCreateModalOpen(false)
      await loadData()
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Gagal menambah tahun ajaran'
      setCreateModalError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (tahunAjaranId) => {
    const selectedItem = items.find((item) => item.id === tahunAjaranId)
    const confirmed = window.confirm(`Jadikan tahun ajaran "${selectedItem?.label || '-'}" sebagai aktif?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await activateAcademicYear(token, tahunAjaranId)
      setSuccess('Tahun ajaran aktif berhasil diperbarui')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal mengaktifkan tahun ajaran')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Hapus tahun ajaran ${item?.label}?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await deleteAcademicYear(token, item.id)
      setSuccess('Tahun ajaran berhasil dihapus')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menghapus tahun ajaran')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Pengaturan Tahun Ajaran Aktif</p>
        <p className="mt-1 text-xs text-[#64748b]">
          Semua modul administrasi (siswa, kelompok, presensi, dan dashboard) mengikuti tahun ajaran yang aktif.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[#334155]">Total: {summary.total}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Aktif: {summary.active}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Nonaktif: {summary.archived}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setLabelInput('')
              setCreateModalError('')
              setIsCreateModalOpen(true)
            }}
            disabled={saving}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60 md:max-w-xs"
          >
            Tambah Tahun Ajaran
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
        <table className="min-w-full divide-y divide-[#e2e8f0]">
          <thead className="bg-[#f8fafc]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">Tahun Ajaran</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
            {loading ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>Memuat data tahun ajaran...</td>
              </tr>
            ) : null}

            {!loading && sortedItems.length === 0 ? (
              <tr>
                <td className="px-3 py-3" colSpan={3}>Belum ada data tahun ajaran.</td>
              </tr>
            ) : null}

            {!loading
              ? sortedItems.map((item) => {
                  const isActive = Boolean(item.is_active)
                  const isCurrent = activeId === item.id || isActive
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium text-[#0f172a]">{item.label}</td>
                      <td className="px-3 py-2">
                        <span className={[
                          'rounded-full px-3 py-1 text-xs',
                          isCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-[#334155]',
                        ].join(' ')}>
                          {isCurrent ? 'Aktif' : 'Tidak aktif'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleActivate(item.id)}
                            disabled={saving || isCurrent}
                            className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
                          >
                            Jadikan Aktif
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={saving}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
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

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!saving) {
            setCreateModalError('')
            setIsCreateModalOpen(false)
          }
        }}
        title="Tambah Tahun Ajaran"
        description="Isi label tahun ajaran, lalu konfirmasi sebelum data disimpan."
      >
        <div className="space-y-3">
          {createModalError ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{createModalError}</div> : null}
          <input
            className={inputClass}
            value={labelInput}
            onChange={(ev) => setLabelInput(ev.target.value)}
            placeholder="Contoh: 2026/2027"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateModalError('')
                setIsCreateModalOpen(false)
              }}
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
              {saving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

export default AcademicYearManagementPanel
