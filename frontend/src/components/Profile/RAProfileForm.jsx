import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ProfileInfoCard from './ProfileInfoCard'

function RAProfileForm({ initialData, saving, error, success, onSubmit }) {
  const [formData, setFormData] = useState({
    nama_ra: '',
    npsn: '',
    nomor_statistik: '',
    status_lembaga: '',
    bentuk_pendidikan: '',
    penyelenggara: '',
    akreditasi: '',
    sk_izin_operasional: '',
    tanggal_izin_operasional: '',
    nama_kepala: '',
    alamat: '',
    telepon: '',
    email_lembaga: '',
    website: '',
    kelurahan_desa: '',
    kecamatan: '',
    kabupaten_kota: '',
    provinsi: '',
    kode_pos: '',
    logo_url: '',
  })
  const [raLogoPreview, setRaLogoPreview] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    setFormData({
      nama_ra: initialData?.nama_ra || '',
      npsn: initialData?.npsn || '',
      nomor_statistik: initialData?.nomor_statistik || '',
      status_lembaga: initialData?.status_lembaga || '',
      bentuk_pendidikan: initialData?.bentuk_pendidikan || '',
      penyelenggara: initialData?.penyelenggara || '',
      akreditasi: initialData?.akreditasi || '',
      sk_izin_operasional: initialData?.sk_izin_operasional || '',
      tanggal_izin_operasional: initialData?.tanggal_izin_operasional || '',
      nama_kepala: initialData?.nama_kepala || '',
      alamat: initialData?.alamat || '',
      telepon: initialData?.telepon || '',
      email_lembaga: initialData?.email_lembaga || '',
      website: initialData?.website || '',
      kelurahan_desa: initialData?.kelurahan_desa || '',
      kecamatan: initialData?.kecamatan || '',
      kabupaten_kota: initialData?.kabupaten_kota || '',
      provinsi: initialData?.provinsi || '',
      kode_pos: initialData?.kode_pos || '',
      logo_url: initialData?.logo_url || '',
    })
    setRaLogoPreview(initialData?.logo_url || '')
  }, [initialData])

  const labelClass = 'text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]'
  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'
  const sectionTitleClass = 'md:col-span-2 mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#475569]'

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const toOptional = (value) => {
    const normalized = String(value || '').trim()
    return normalized || undefined
  }

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

      setField('logo_url', base64)
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

    if (!formData.nama_ra.trim()) {
      setValidationError('Nama RA wajib diisi')
      return
    }

    setValidationError('')
    await onSubmit?.({
      nama_ra: formData.nama_ra.trim(),
      npsn: toOptional(formData.npsn),
      nomor_statistik: toOptional(formData.nomor_statistik),
      status_lembaga: toOptional(formData.status_lembaga),
      bentuk_pendidikan: toOptional(formData.bentuk_pendidikan),
      penyelenggara: toOptional(formData.penyelenggara),
      akreditasi: toOptional(formData.akreditasi),
      sk_izin_operasional: toOptional(formData.sk_izin_operasional),
      tanggal_izin_operasional: toOptional(formData.tanggal_izin_operasional),
      nama_kepala: toOptional(formData.nama_kepala),
      alamat: toOptional(formData.alamat),
      telepon: toOptional(formData.telepon),
      email_lembaga: toOptional(formData.email_lembaga),
      website: toOptional(formData.website),
      kelurahan_desa: toOptional(formData.kelurahan_desa),
      kecamatan: toOptional(formData.kecamatan),
      kabupaten_kota: toOptional(formData.kabupaten_kota),
      provinsi: toOptional(formData.provinsi),
      kode_pos: toOptional(formData.kode_pos),
      logo_url: formData.logo_url || undefined,
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
        avatarAlt={formData.nama_ra || 'Logo RA'}
        avatarFallback="RA"
        title={formData.nama_ra || '-'}
        subtitle={initialData?.tahun_ajaran || '-'}
        items={[
          { label: 'NPSN', value: formData.npsn || '-' },
          { label: 'NSM', value: formData.nomor_statistik || '-' },
          { label: 'Akreditasi', value: formData.akreditasi || '-' },
          { label: 'Status Lembaga', value: formData.status_lembaga || '-' },
          { label: 'Kepala RA', value: formData.nama_kepala || '-' },
          { label: 'Telepon', value: formData.telepon || '-' },
          { label: 'Email Lembaga', value: formData.email_lembaga || '-' },
        ]}
      />

      <form className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
        <p className={sectionTitleClass}>Identitas Lembaga</p>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nama RA</label>
          <input className={inputClass} value={formData.nama_ra} onChange={(ev) => setField('nama_ra', ev.target.value)} placeholder="Nama RA" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>NPSN</label>
          <input className={inputClass} value={formData.npsn} onChange={(ev) => setField('npsn', ev.target.value)} placeholder="Nomor Pokok Sekolah Nasional" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>NSM / Nomor Statistik</label>
          <input className={inputClass} value={formData.nomor_statistik} onChange={(ev) => setField('nomor_statistik', ev.target.value)} placeholder="Nomor Statistik Madrasah" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Bentuk Pendidikan</label>
          <input className={inputClass} value={formData.bentuk_pendidikan} onChange={(ev) => setField('bentuk_pendidikan', ev.target.value)} placeholder="Contoh: Raudlatul Athfal" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Status Lembaga</label>
          <input className={inputClass} value={formData.status_lembaga} onChange={(ev) => setField('status_lembaga', ev.target.value)} placeholder="Contoh: Swasta / Negeri" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Penyelenggara</label>
          <input className={inputClass} value={formData.penyelenggara} onChange={(ev) => setField('penyelenggara', ev.target.value)} placeholder="Nama yayasan/penyelenggara" />
        </div>

        <p className={sectionTitleClass}>Legalitas dan Pimpinan</p>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Akreditasi</label>
          <input className={inputClass} value={formData.akreditasi} onChange={(ev) => setField('akreditasi', ev.target.value)} placeholder="Contoh: A / B / C" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>SK Izin Operasional</label>
          <input className={inputClass} value={formData.sk_izin_operasional} onChange={(ev) => setField('sk_izin_operasional', ev.target.value)} placeholder="Nomor SK Izin Operasional" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Tanggal Izin Operasional</label>
          <input className={inputClass} type="date" value={formData.tanggal_izin_operasional} onChange={(ev) => setField('tanggal_izin_operasional', ev.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Nama Kepala RA</label>
          <input className={inputClass} value={formData.nama_kepala} onChange={(ev) => setField('nama_kepala', ev.target.value)} placeholder="Nama kepala lembaga" />
        </div>

        <p className={sectionTitleClass}>Kontak dan Lokasi</p>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className={labelClass}>Alamat</label>
          <input className={inputClass} value={formData.alamat} onChange={(ev) => setField('alamat', ev.target.value)} placeholder="Alamat lengkap RA" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Kelurahan / Desa</label>
          <input className={inputClass} value={formData.kelurahan_desa} onChange={(ev) => setField('kelurahan_desa', ev.target.value)} placeholder="Kelurahan/Desa" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Kecamatan</label>
          <input className={inputClass} value={formData.kecamatan} onChange={(ev) => setField('kecamatan', ev.target.value)} placeholder="Kecamatan" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Kabupaten / Kota</label>
          <input className={inputClass} value={formData.kabupaten_kota} onChange={(ev) => setField('kabupaten_kota', ev.target.value)} placeholder="Kabupaten/Kota" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Provinsi</label>
          <input className={inputClass} value={formData.provinsi} onChange={(ev) => setField('provinsi', ev.target.value)} placeholder="Provinsi" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Kode Pos</label>
          <input className={inputClass} value={formData.kode_pos} onChange={(ev) => setField('kode_pos', ev.target.value)} placeholder="Kode pos" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Telepon Lembaga</label>
          <input className={inputClass} value={formData.telepon} onChange={(ev) => setField('telepon', ev.target.value)} placeholder="Nomor telepon" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Email Lembaga</label>
          <input className={inputClass} type="email" value={formData.email_lembaga} onChange={(ev) => setField('email_lembaga', ev.target.value)} placeholder="email@lembaga.sch.id" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Website</label>
          <input className={inputClass} type="url" value={formData.website} onChange={(ev) => setField('website', ev.target.value)} placeholder="https://..." />
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
            {saving ? 'Menyimpan...' : 'Simpan Perubahan Profil Lembaga'}
          </button>
        </div>
      </form>
    </>
  )
}

RAProfileForm.propTypes = {
  initialData: PropTypes.shape({
    nama_ra: PropTypes.string,
    npsn: PropTypes.string,
    alamat: PropTypes.string,
    nomor_statistik: PropTypes.string,
    status_lembaga: PropTypes.string,
    bentuk_pendidikan: PropTypes.string,
    penyelenggara: PropTypes.string,
    akreditasi: PropTypes.string,
    sk_izin_operasional: PropTypes.string,
    tanggal_izin_operasional: PropTypes.string,
    nama_kepala: PropTypes.string,
    telepon: PropTypes.string,
    email_lembaga: PropTypes.string,
    website: PropTypes.string,
    kelurahan_desa: PropTypes.string,
    kecamatan: PropTypes.string,
    kabupaten_kota: PropTypes.string,
    provinsi: PropTypes.string,
    kode_pos: PropTypes.string,
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
