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

      await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Login</h1>
        <p className="mt-1 text-sm text-slate-500">Masuk sebagai admin RA</p>

        {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />

          <button type="submit" disabled={loading} className="w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Belum punya akun?{' '}
          <Link className="font-medium text-slate-900 underline" to="/register-school">
            Registrasi sekolah
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
