import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        email: email.trim(),
        password,
      }
      const response = await api.post('/auth/login', payload)
      const accessToken = response?.data?.data?.access_token
      const refreshToken = response?.data?.data?.refresh_token
      const authUserEmail = response?.data?.data?.user?.email || ''

      if (!accessToken) {
        throw new Error('Access token tidak ditemukan.')
      }

      localStorage.removeItem('aisya_access_token')
      localStorage.removeItem('aisya_refresh_token')
      localStorage.removeItem('aisya_user_name')
      localStorage.removeItem('aisya_user_email')
      localStorage.setItem('aisya_access_token', accessToken)
      if (refreshToken) {
        localStorage.setItem('aisya_refresh_token', refreshToken)
      }
      if (authUserEmail) {
        localStorage.setItem('aisya_user_email', authUserEmail)
      }

      await api.get('/auth/me')

      sessionStorage.removeItem('aisya_chat_bootstrap_done')

      navigate('/', { replace: true })
    } catch (submitError) {
      localStorage.removeItem('aisya_access_token')
      localStorage.removeItem('aisya_refresh_token')
      localStorage.removeItem('aisya_user_name')
      localStorage.removeItem('aisya_user_email')
      const message = submitError?.response?.data?.detail || submitError.message || 'Login gagal.'
      setError(message)
    } finally {
      setLoading(false)
    }
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
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-[#0f172a]">Masuk ke aplikasi AISYA-RA.</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#64748b]">
            Chat dan kelola data sekolah dari satu ruang kerja.
          </p>
        </section>

        <section className="auth-card auth-card-enter rounded-3xl border border-[#d7dbe2] bg-white/92 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.09)] backdrop-blur md:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748b]">Autentikasi</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0f172a]">Login</h2>
            <p className="mt-1 text-sm text-[#667085]">Masuk menggunakan akun yang terdaftar.</p>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Email</label>
              <input
                className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">Password</label>
              <input
                className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#0f172a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memproses...' : 'Login'}
            </button>
          </form>

          <p className="mt-5 text-sm text-[#667085]">
            Belum punya akun?{' '}
            <Link className="font-semibold text-[#0f172a] underline decoration-[#94a3b8] underline-offset-4" to="/register-school">
              Daftar di sini
            </Link>
          </p>
        </section>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
