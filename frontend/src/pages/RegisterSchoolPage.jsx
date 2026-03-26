import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

function RegisterSchoolPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nama_ra: '',
    alamat: '',
    nomor_statistik: '',
    tahun_ajaran: '',
    logo_url: '',
    admin_nama: '',
    admin_email: '',
    admin_password: '',
  })

  const onChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setForm((prev) => ({ ...prev, logo_url: '' }))
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, logo_url: String(reader.result || '') }))
    }
    reader.readAsDataURL(file)
  }

  const toStepTwo = (event) => {
    event.preventDefault()
    setError('')
    if (!form.nama_ra || !form.alamat || !form.nomor_statistik || !form.tahun_ajaran) {
      setError('Semua data RA wajib diisi kecuali logo.')
      return
    }
    setStep(2)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/auth/register-school', {
        nama_ra: form.nama_ra,
        alamat: form.alamat,
        nomor_statistik: form.nomor_statistik,
        logo_url: form.logo_url || null,
        tahun_ajaran: form.tahun_ajaran,
        admin: {
          nama: form.admin_nama,
          email: form.admin_email,
          password: form.admin_password,
        },
      })

      setSuccess('Registrasi berhasil. Mengarahkan ke halaman login...')
      setTimeout(() => navigate('/login'), 1200)
    } catch (submitError) {
      const message = submitError?.response?.data?.detail || 'Registrasi gagal.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Registrasi Sekolah RA</h1>
        <p className="mt-1 text-sm text-slate-500">Langkah {step} dari 2</p>

        {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

        {step === 1 ? (
          <form className="mt-6 space-y-4" onSubmit={toStepTwo}>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="nama_ra" placeholder="Nama RA" value={form.nama_ra} onChange={onChange} />
            <textarea className="w-full rounded-md border border-slate-300 px-3 py-2" name="alamat" placeholder="Alamat" rows={3} value={form.alamat} onChange={onChange} />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="nomor_statistik" placeholder="Nomor Statistik Madrasah" value={form.nomor_statistik} onChange={onChange} />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="tahun_ajaran" placeholder="Tahun Ajaran (contoh: 2026/2027)" value={form.tahun_ajaran} onChange={onChange} />

            <div>
              <label className="mb-1 block text-sm text-slate-600">Upload Logo (opsional)</label>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="file" accept="image/*" onChange={onLogoChange} />
            </div>

            <button type="submit" className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800">Lanjut ke Data Admin</button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="admin_nama" placeholder="Nama Kepala RA" value={form.admin_nama} onChange={onChange} required />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="admin_email" placeholder="Email" type="email" value={form.admin_email} onChange={onChange} required />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2" name="admin_password" placeholder="Password" type="password" value={form.admin_password} onChange={onChange} required />

            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100" onClick={() => setStep(1)}>
                Kembali
              </button>
              <button type="submit" disabled={loading} className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Memproses...' : 'Daftar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default RegisterSchoolPage
