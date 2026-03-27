import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

const JENIS_OPTIONS = ['undangan', 'keterangan', 'tugas', 'izin', 'lainnya']

function TemplateSuratPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nama_template: '', jenis_surat: 'undangan', konten_template: '' })
  const [saving, setSaving] = useState(false)

  const token = localStorage.getItem('aisya_access_token')
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/template-surat/', { headers })
      setTemplates(res.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal memuat template')
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const clearMessages = () => { setError(''); setSuccess('') }

  const openCreate = () => {
    clearMessages()
    setEditingId(null)
    setForm({ nama_template: '', jenis_surat: 'undangan', konten_template: '' })
    setShowForm(true)
  }

  const openEdit = (t) => {
    clearMessages()
    setEditingId(t.id)
    setForm({ nama_template: t.nama_template, jenis_surat: t.jenis_surat, konten_template: t.konten_template })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    clearMessages()
    try {
      if (editingId) {
        await api.put(`/template-surat/${editingId}`, form, { headers })
        setSuccess('Template berhasil diperbarui')
      } else {
        await api.post('/template-surat/', form, { headers })
        setSuccess('Template berhasil ditambahkan')
      }
      closeForm()
      fetchTemplates()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal menyimpan template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, nama) => {
    if (!confirm(`Hapus template "${nama}"?`)) return
    clearMessages()
    try {
      await api.delete(`/template-surat/${id}`, { headers })
      setSuccess('Template berhasil dihapus')
      fetchTemplates()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal menghapus template')
    }
  }

  // Extract placeholders for preview
  const extractPlaceholders = (text) => {
    const matches = text.match(/\{\{(\w+)\}\}/g)
    return matches ? [...new Set(matches.map(m => m.replace(/\{|\}/g, '')))] : []
  }

  return (
    <div className="h-full bg-[#f8fafc] px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Manajemen Template Surat</h1>
              <p className="mt-1 text-sm text-slate-600">Kelola template surat dengan placeholder dinamis</p>
            </div>
            {!showForm && (
              <button onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                + Tambah Template
              </button>
            )}
          </div>

          {/* Messages */}
          {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSave} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Template' : 'Tambah Template Baru'}
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nama Template</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={form.nama_template}
                    onChange={(e) => setForm({ ...form, nama_template: e.target.value })}
                    placeholder="Contoh: Undangan Rapat Orang Tua"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Jenis Surat</label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={form.jenis_surat}
                    onChange={(e) => setForm({ ...form, jenis_surat: e.target.value })}
                  >
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Konten Template
                  <span className="ml-1 font-normal text-slate-500">— gunakan {'{{nama_field}}'} untuk placeholder</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-slate-500 focus:outline-none"
                  rows={12}
                  value={form.konten_template}
                  onChange={(e) => setForm({ ...form, konten_template: e.target.value })}
                  placeholder={'Kepada Yth.\n{{nama_wali}}\n\nDengan hormat, ...\nTanggal: {{tanggal}}\nTempat: {{tempat}}'}
                  required
                />
              </div>

              {/* Placeholder preview */}
              {form.konten_template && extractPlaceholders(form.konten_template).length > 0 && (
                <div className="rounded-md bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-800">Placeholder terdeteksi:</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {extractPlaceholders(form.konten_template).map((p) => (
                      <span key={p} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Template'}
                </button>
                <button type="button" onClick={closeForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="mt-6">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Memuat data...</p>
            ) : templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada template. Klik "Tambah Template" untuk membuat.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-3 py-2 font-semibold text-slate-900">Nama Template</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Jenis</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Placeholder</th>
                      <th className="px-3 py-2 font-semibold text-slate-900">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => {
                      const phs = extractPlaceholders(t.konten_template)
                      return (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-800">{t.nama_template}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                              {t.jenis_surat}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {phs.slice(0, 4).map((p) => (
                                <span key={p} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{p}</span>
                              ))}
                              {phs.length > 4 && (
                                <span className="text-xs text-slate-500">+{phs.length - 4} lagi</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEdit(t)} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                                Edit
                              </button>
                              <button onClick={() => handleDelete(t.id, t.nama_template)} className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateSuratPage
