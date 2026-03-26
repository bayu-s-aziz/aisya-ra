import { useEffect, useState } from 'react'
import api from '../lib/api'

function BuatSuratPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Wizard step: 'select' → 'fill' → 'preview'
  const [step, setStep] = useState('select')

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [placeholders, setPlaceholders] = useState([])
  const [params, setParams] = useState({})
  const [judul, setJudul] = useState('')
  const [kodeSurat, setKodeSurat] = useState('RA')
  const [previewContent, setPreviewContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)

  const token = localStorage.getItem('aisya_access_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const res = await api.get('/template-surat/', { headers })
        setTemplates(res.data || [])
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat template')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const extractPlaceholders = (text) => {
    const matches = text.match(/\{\{(\w+)\}\}/g)
    return matches ? [...new Set(matches.map(m => m.replace(/\{|\}/g, '')))] : []
  }

  const selectTemplate = (t) => {
    setSelectedTemplate(t)
    const phs = extractPlaceholders(t.konten_template)
    setPlaceholders(phs)
    const initial = {}
    phs.forEach(p => { initial[p] = '' })
    setParams(initial)
    setJudul('')
    setKodeSurat('RA')
    setPreviewContent('')
    setResult(null)
    setError('')
    setSuccess('')
    setStep('fill')
  }

  const fillTemplate = (template, values) => {
    let result = template
    Object.entries(values).forEach(([key, val]) => {
      result = result.replaceAll(`{{${key}}}`, val || `{{${key}}}`)
    })
    return result
  }

  const goToPreview = () => {
    if (!judul.trim()) {
      setError('Judul surat harus diisi')
      return
    }
    setError('')
    const filled = fillTemplate(selectedTemplate.konten_template, params)
    setPreviewContent(filled)
    setStep('preview')
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.post('/surat/generate', {
        template_id: selectedTemplate.id,
        judul,
        kode_surat: kodeSurat,
        parameters: params,
      }, { headers })

      setResult(res.data)
      setSuccess(`Surat berhasil di-generate: ${res.data.nomor_surat}`)
      setStep('done')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal generate surat')
    } finally {
      setGenerating(false)
    }
  }

  const downloadPdf = async (id) => {
    try {
      const res = await api.get(`/surat/${id}/pdf`, { headers, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `surat-${result.nomor_surat.replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Gagal mengunduh PDF')
    }
  }

  const reset = () => {
    setStep('select')
    setSelectedTemplate(null)
    setPlaceholders([])
    setParams({})
    setJudul('')
    setPreviewContent('')
    setResult(null)
    setError('')
    setSuccess('')
  }

  // Friendly label from snake_case
  const label = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">Buat Surat</h1>

          {/* Stepper */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            {['select', 'fill', 'preview', 'done'].map((s, i) => {
              const labels = ['Pilih Template', 'Isi Data', 'Pratinjau', 'Selesai']
              const isCurrent = step === s
              const isPast = ['select', 'fill', 'preview', 'done'].indexOf(step) > i
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-6 ${isPast || isCurrent ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isCurrent ? 'bg-emerald-100 text-emerald-800' : isPast ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {labels[i]}
                  </span>
                </div>
              )
            })}
          </div>

          {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

          {/* Step 1: Select Template */}
          {step === 'select' && (
            <div className="mt-6">
              <p className="mb-4 text-sm text-slate-600">Pilih template surat yang ingin digunakan:</p>
              {loading ? (
                <p className="text-sm text-slate-500">Memuat template...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada template. Buat template terlebih dahulu di halaman Manajemen Template.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <p className="font-medium text-slate-900">{t.nama_template}</p>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                        {t.jenis_surat}
                      </span>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{t.konten_template.slice(0, 120)}…</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Fill Parameters */}
          {step === 'fill' && selectedTemplate && (
            <div className="mt-6 space-y-5">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Template dipilih</p>
                <p className="font-medium text-slate-800">{selectedTemplate.nama_template}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Judul Surat *</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="Contoh: Undangan Rapat Wali Murid Kelompok A"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Kode Surat</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    value={kodeSurat}
                    onChange={(e) => setKodeSurat(e.target.value)}
                    placeholder="RA"
                  />
                  <p className="mt-1 text-xs text-slate-500">Format nomor: 001/{kodeSurat || 'RA'}/III/2026</p>
                </div>
              </div>

              {placeholders.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Isi Parameter Template</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {placeholders.map((p) => (
                      <div key={p}>
                        <label className="mb-1 block text-sm font-medium text-slate-700">{label(p)}</label>
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                          value={params[p] || ''}
                          onChange={(e) => setParams({ ...params, [p]: e.target.value })}
                          placeholder={label(p)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={goToPreview} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  Pratinjau Surat →
                </button>
                <button onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  ← Ganti Template
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="mt-6 space-y-5">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Pratinjau Surat</p>
                <p className="font-medium text-slate-800">{judul}</p>
                <p className="text-xs text-slate-500">Kode: {kodeSurat || 'RA'}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-inner">
                <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-800">
                  {previewContent}
                </pre>
              </div>

              {/* Highlight unfilled placeholders */}
              {previewContent.match(/\{\{\w+\}\}/) && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  ⚠️ Beberapa placeholder belum diisi dan akan tampil apa adanya di surat.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleGenerate} disabled={generating} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {generating ? 'Generating...' : 'Generate & Simpan Surat'}
                </button>
                <button onClick={() => setStep('fill')} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  ← Kembali Edit
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && result && (
            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
                <svg className="mx-auto h-12 w-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="mt-3 text-lg font-semibold text-emerald-900">Surat Berhasil Dibuat!</h2>
                <p className="mt-1 text-sm text-emerald-700">Nomor Surat: <strong>{result.nomor_surat}</strong></p>
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={() => downloadPdf(result.surat_id)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  Unduh PDF
                </button>
                <button onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Buat Surat Lain
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuatSuratPage
