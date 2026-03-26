import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ProfileInfoCard from './ProfileInfoCard'

function RAProfileForm({ initialData, saving, error, success, onSubmit }) {
  const [raNama, setRaNama] = useState('')
  const [raAlamat, setRaAlamat] = useState('')
  const [raNomorIzin, setRaNomorIzin] = useState('')
  const [raTahunAjaran, setRaTahunAjaran] = useState('')
  const [raLogoUrl, setRaLogoUrl] = useState('')
  const [raLogoPreview, setRaLogoPreview] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    setRaNama(initialData?.nama_ra || '')
    setRaAlamat(initialData?.alamat || '')
    setRaNomorIzin(initialData?.nomor_statistik || '')
    setRaTahunAjaran(initialData?.tahun_ajaran || '')
    setRaLogoUrl(initialData?.logo_url || '')
    setRaLogoPreview(initialData?.logo_url || '')
  }, [initialData])

  const labelClass = 'text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]'
  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setValidationError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      if (typeof base64 !== 'string') {
        throw new Error('Logo gagal diproses')
      }

      setRaLogoUrl(base64)
      setRaLogoPreview(base64)
    } catch {
      setValidationError('Gagal memproses file logo')
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()

    if (!raNama.trim()) {
      setValidationError('Nama RA wajib diisi')
      return
    }

    if (!raTahunAjaran.trim()) {
      setValidationError('Tahun ajaran wajib diisi')
      return
    }

    setValidationError('')
    await onSubmit?.({
      nama_ra: raNama.trim(),
      nomor_statistik: raNomorIzin.trim() || undefined,
      alamat: raAlamat.trim() || undefined,
      tahun_ajaran: raTahunAjaran.trim(),
      logo_url: raLogoUrl || undefined,
    })
  }

  return (
    <>
      {success ? <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {validationError ? <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{validationError}</div> : null}

      <ProfileInfoCard
        className="mt-4"
        avatarUrl={raLogoPreview}
        avatarAlt={raNama || 'Logo RA'}
        avatarFallback="RA"
        title={raNama || '-'}
        subtitle={raTahunAjaran || '-'}
        items={[
          { label: 'Nama RA', value: raNama || '-' },
          { label: 'Alamat', value: raAlamat || '-' },
          { label: 'Nomor Statistik / Izin', value: raNomorIzin || '-' },
          { label: 'Tahun Ajaran', value: raTahunAjaran || '-' },
        ]}
      />

      <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nama RA</label>
          <input className={inputClass} value={raNama} onChange={(ev) => setRaNama(ev.target.value)} placeholder="Nama RA" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nomor izin</label>
          <input className={inputClass} value={raNomorIzin} onChange={(ev) => setRaNomorIzin(ev.target.value)} placeholder="Nomor izin" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Alamat</label>
          <input className={inputClass} value={raAlamat} onChange={(ev) => setRaAlamat(ev.target.value)} placeholder="Alamat RA" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Tahun ajaran</label>
          <input className={inputClass} value={raTahunAjaran} onChange={(ev) => setRaTahunAjaran(ev.target.value)} placeholder="Contoh: 2025/2026" />
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelClass}>Upload logo</label>
          <input className={inputClass} type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo || saving} />
          {raLogoPreview ? (
            <img src={raLogoPreview} alt="Logo RA" className="mt-2 h-16 w-16 rounded-md border border-[#cbd5e1] object-cover" />
          ) : null}
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan RA'}
          </button>
        </div>
      </form>
    </>
  )
}

RAProfileForm.propTypes = {
  initialData: PropTypes.shape({
    nama_ra: PropTypes.string,
    alamat: PropTypes.string,
    nomor_statistik: PropTypes.string,
    tahun_ajaran: PropTypes.string,
    logo_url: PropTypes.string,
  }),
  saving: PropTypes.bool,
  error: PropTypes.string,
  success: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
}

RAProfileForm.defaultProps = {
  initialData: null,
  saving: false,
  error: '',
  success: '',
}

export default RAProfileForm
