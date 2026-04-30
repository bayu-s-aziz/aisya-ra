import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'

function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [hasRA, setHasRA] = useState(false)
  const [raName, setRaName] = useState('')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    nama_ra: '',
    alamat: '',
    nomor_statistik: '',
    tahun_ajaran: '',
    logo_url: '',
    // Admin / Guru data
    nama: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    const checkStatus = async () => {
      try {
        console.log('Checking registration status...')
        const response = await api.get('/auth/registration-status')
        console.log('Registration status response:', response.data)
        setHasRA(response.data.has_ra)
        setRaName(response.data.ra_name || '')
      } catch (err) {
        console.error('Failed to check registration status', err)
        setError('Gagal mengecek status registrasi. Pastikan backend sudah terupdate dan berjalan.')
      } finally {
        setCheckingStatus(false)
      }
    }
    checkStatus()
  }, [])

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

  const onSubmitSchool = async (event) => {
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
          nama: form.nama,
          email: form.email,
          password: form.password,
        },
      })

      setSuccess('Registrasi RA dan Kepala RA berhasil. Mengarahkan ke halaman login...')
      setTimeout(() => navigate('/login'), 1200)
    } catch (submitError) {
      const message = submitError?.response?.data?.detail || 'Registrasi gagal.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmitGuru = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await api.post('/auth/register-guru', {
        nama: form.nama,
        email: form.email,
        password: form.password,
      })

      setSuccess('Registrasi Guru berhasil. Mengarahkan ke halaman login...')
      setTimeout(() => navigate('/login'), 1200)
    } catch (submitError) {
      const message = submitError?.response?.data?.detail || 'Registrasi gagal.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) {
    return (
      <div className="auth-shell flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0f172a] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="auth-shell auth-page-enter min-h-[100dvh] px-4 py-8 md:px-6 md:py-10 lg:min-h-0 lg:py-14">
      <div className="mx-auto w-full max-w-[980px] lg:rounded-[30px] lg:border lg:border-[#d7dbe2]/75 lg:bg-white/35 lg:p-3 lg:shadow-[0_20px_55px_rgba(15,23,42,0.09)] lg:backdrop-blur-sm">
        <div className="auth-grid grid w-full gap-5 lg:grid-cols-[1.08fr,1fr]">
          <section className="auth-brand-panel hidden rounded-3xl border border-[#d7dbe2] bg-white/85 p-8 shadow-[0_18px_42px_rgba(15,23,42,0.09)] backdrop-blur lg:flex lg:flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#475467]">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0f172a] text-[10px] font-bold text-white">AI</span>
              AISYA-RA
            </div>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-[#0f172a]">
              {hasRA ? `Selamat Datang di AISYA-RA ${raName}` : 'Daftarkan diri Anda agar siap dipakai dalam hitungan menit.'}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#64748b]">
              {hasRA 
                ? 'Daftarkan akun Guru Anda untuk mulai menggunakan AISYA-RA.' 
                : 'Isi data RA dan Kepala RA, lalu langsung masuk ke dashboard untuk mulai bekerja.'}
            </p>
          </section>

          <section className="auth-card auth-card-enter rounded-3xl border border-[#d7dbe2] bg-white/92 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.09)] backdrop-blur md:p-8">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b]">Registrasi</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">
                {hasRA ? 'Registrasi Guru' : 'Registrasi RA'}
              </h2>

              {!hasRA && (
                <div className="mt-3 flex items-center gap-2">
                  <span className={[
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    step === 1 ? 'bg-[#0f172a] text-white' : 'border border-[#cbd5e1] text-[#64748b]',
                  ].join(' ')}>
                    1. Data RA
                  </span>
                  <span className={[
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    step === 2 ? 'bg-[#0f172a] text-white' : 'border border-[#cbd5e1] text-[#64748b]',
                  ].join(' ')}>
                    2. Admin
                  </span>
                </div>
              )}
            </div>

            {error ? <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

            {!hasRA ? (
              step === 1 ? (
                <form key="step-1" className="auth-step-enter space-y-4" onSubmit={toStepTwo}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Nama RA</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="nama_ra" placeholder="Nama Raudhatul Athfal" value={form.nama_ra} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Alamat</label>
                    <textarea className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="alamat" placeholder="Alamat lengkap" rows={3} value={form.alamat} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Nomor Statistik Madrasah (NSM)</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="nomor_statistik" placeholder="Contoh: 101232..." value={form.nomor_statistik} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Tahun Ajaran Aktif</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="tahun_ajaran" placeholder="Contoh: 2026/2027" value={form.tahun_ajaran} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Upload logo (opsional)</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" type="file" accept="image/*" onChange={onLogoChange} />
                  </div>

                  <button type="submit" className="w-full rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#020617]">Lanjut ke Data Admin</button>
                </form>
              ) : (
                <form key="step-2" className="auth-step-enter space-y-4" onSubmit={onSubmitSchool}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Nama Kepala RA</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="nama" placeholder="Nama lengkap" value={form.nama} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Email</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="email" placeholder="nama@email.com" type="email" value={form.email} onChange={onChange} required />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Password</label>
                    <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="password" placeholder="Min. 8 karakter" type="password" value={form.password} onChange={onChange} required />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" className="rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-sm font-medium text-[#334155] transition-colors hover:bg-[#f8fafc]" onClick={() => setStep(1)}>
                      Kembali
                    </button>
                    <button type="submit" disabled={loading} className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60">
                      {loading ? 'Memproses...' : 'Daftar RA'}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form className="auth-step-enter space-y-4" onSubmit={onSubmitGuru}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Nama Lengkap Guru</label>
                  <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="nama" placeholder="Nama lengkap" value={form.nama} onChange={onChange} required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Email</label>
                  <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="email" placeholder="nama@email.com" type="email" value={form.email} onChange={onChange} required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Password</label>
                  <input className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]" name="password" placeholder="Min. 8 karakter" type="password" value={form.password} onChange={onChange} required />
                </div>

                <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Memproses...' : 'Daftar Sebagai Guru'}
                </button>
              </form>
            )}

            <p className="mt-5 text-sm text-[#667085]">
              Sudah punya akun?{' '}
              <Link className="font-semibold text-[#0f172a] underline decoration-[#94a3b8] underline-offset-4" to="/login">
                Kembali ke login
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
