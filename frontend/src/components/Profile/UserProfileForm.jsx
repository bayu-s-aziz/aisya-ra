import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

function validateForm({ name, email, password, confirmPassword }) {
  if (!name.trim()) return 'Nama wajib diisi'
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Format email tidak valid'

  if (password || confirmPassword) {
    if (password.length < 8) return 'Password minimal 8 karakter'
    if (password !== confirmPassword) return 'Konfirmasi password tidak sama'
  }

  return ''
}

function UserProfileForm({
  initialName,
  initialEmail,
  saving,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  showCancel,
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    setName(initialName || '')
    setEmail(initialEmail || '')
  }, [initialEmail, initialName])

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'
  const labelClass = 'text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]'

  const handleSubmit = async (ev) => {
    ev.preventDefault()

    const message = validateForm({ name, email, password, confirmPassword })
    if (message) {
      setValidationError(message)
      return
    }

    setValidationError('')
    await onSubmit?.({
      name: name.trim(),
      email: email.trim(),
      password,
    })

    setPassword('')
    setConfirmPassword('')
  }

  return (
    <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
      {validationError ? <div className="md:col-span-2 rounded-md bg-red-50 p-3 text-sm text-red-700">{validationError}</div> : null}
      {error ? <div className="md:col-span-2 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Nama lengkap</label>
        <input className={inputClass} value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Nama lengkap" />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Email</label>
        <input className={inputClass} value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="Email" type="email" />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Password baru</label>
        <input className={inputClass} value={password} onChange={(ev) => setPassword(ev.target.value)} placeholder="Minimal 8 karakter" type="password" />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Konfirmasi password</label>
        <input className={inputClass} value={confirmPassword} onChange={(ev) => setConfirmPassword(ev.target.value)} placeholder="Ulangi password" type="password" />
      </div>

      <div className="md:col-span-2 flex justify-end gap-2">
        {showCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
          >
            Batal
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

UserProfileForm.propTypes = {
  initialName: PropTypes.string,
  initialEmail: PropTypes.string,
  saving: PropTypes.bool,
  error: PropTypes.string,
  submitLabel: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  showCancel: PropTypes.bool,
}

UserProfileForm.defaultProps = {
  initialName: '',
  initialEmail: '',
  saving: false,
  error: '',
  submitLabel: 'Simpan Perubahan',
  onCancel: undefined,
  showCancel: false,
}

export default UserProfileForm
