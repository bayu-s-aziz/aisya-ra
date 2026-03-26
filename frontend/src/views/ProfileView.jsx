import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import UserProfileForm from '../components/Profile/UserProfileForm'
import RAProfileForm from '../components/Profile/RAProfileForm'
import { saveUserProfile } from '../lib/profile'
import { saveRAProfile } from '../lib/raProfile'
import { fetchAuthMeData } from '../lib/authMe'

function getInitials(name) {
  if (!name) return 'U'
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function ProfileView({ profile, openUserSettingsSignal, openRaSettingsSignal, onProfileUpdated }) {
  const [currentProfile, setCurrentProfile] = useState(profile || null)
  const [currentRaProfile, setCurrentRaProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [isEditRAOpen, setIsEditRAOpen] = useState(false)
  const [savingRA, setSavingRA] = useState(false)
  const [raSuccess, setRaSuccess] = useState('')
  const [raError, setRaError] = useState('')

  const isKepalaRole = useMemo(() => {
    const role = (currentProfile?.role || '').toLowerCase()
    return ['kepala_ra', 'kepala', 'admin', 'admin_ra'].includes(role)
  }, [currentProfile?.role])

  useEffect(() => {
    setCurrentProfile(profile || null)
  }, [profile])

  const fetchMe = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setLoadError('')
    try {
      const me = await fetchAuthMeData(token)
      const nextProfile = me?.profile || null
      const nextRaProfile = me?.ra_profile || null

      setCurrentProfile(nextProfile)
      setCurrentRaProfile(nextRaProfile)

      if (nextProfile) {
        onProfileUpdated?.({
          nama: nextProfile.nama,
          email: nextProfile.email,
          role: nextProfile.role,
          telepon: nextProfile.telepon,
          jabatan: nextProfile.jabatan,
        })
      }
    } catch (err) {
      setLoadError(err?.response?.data?.detail || 'Gagal memuat profil')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMe()
  }, [])

  useEffect(() => {
    if (!openUserSettingsSignal) return
    setError('')
    setIsEditOpen(true)
  }, [openUserSettingsSignal])

  useEffect(() => {
    if (!openRaSettingsSignal) return
    if (!isKepalaRole) return
    setRaError('')
    setIsEditRAOpen(true)
  }, [isKepalaRole, openRaSettingsSignal])

  const handleSaveUser = async ({ name, email, password }) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setSuccess('')
    setError('')
    try {
      await saveUserProfile({
        token,
        name,
        email,
        password,
        currentEmail: currentProfile?.email,
      })

      await fetchMe()
      setSuccess('Profil pengguna berhasil disimpan')
      setIsEditOpen(false)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menyimpan profil pengguna')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRA = async (payload) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSavingRA(true)
    setRaSuccess('')
    setRaError('')
    try {
      await saveRAProfile(token, payload)
      await fetchMe()
      setRaSuccess('Profil RA berhasil disimpan')
      setIsEditRAOpen(false)
    } catch (err) {
      setRaError(err?.response?.data?.detail || err?.message || 'Gagal menyimpan profil RA')
    } finally {
      setSavingRA(false)
    }
  }

  const userName = currentProfile?.nama || '-'
  const userEmail = currentProfile?.email || '-'
  const userRole = (currentProfile?.role || '-').replaceAll('_', ' ')
  const userPhone = currentProfile?.telepon || '-'
  const userAbout = currentProfile?.jabatan || '-'
  const raNama = currentRaProfile?.nama_ra || '-'
  const raAlamat = currentRaProfile?.alamat || '-'
  const raNomor = currentRaProfile?.nomor_statistik || '-'
  const raTahun = currentRaProfile?.tahun_ajaran || '-'

  return (
    <>
      <div className="h-full overflow-y-auto bg-[#f7f7f8] px-3 py-4 md:px-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Profil Pengguna</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">Kelola Data Akun dan RA</h2>
            <p className="mt-2 text-sm text-[#64748b]">Perbarui profil pengguna dan profil RA dari halaman ini atau lewat menu badge pengguna.</p>
          </section>

          {loadError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</div> : null}
          {loading ? <p className="text-sm text-[#64748b]">Memuat profil...</p> : null}
          {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
          {raSuccess ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{raSuccess}</div> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px,1fr]">
            <aside className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex flex-col items-center">
                {currentProfile?.foto_url ? (
                  <img src={currentProfile.foto_url} alt={userName} className="h-28 w-28 rounded-full object-cover" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#e2e8f0] text-2xl font-semibold text-[#334155]">
                    {getInitials(userName)}
                  </div>
                )}
                <p className="mt-4 text-xl font-semibold text-[#0f172a]">{userName}</p>
                <p className="text-sm capitalize text-[#64748b]">{userRole}</p>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setIsEditOpen(true)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-3 py-2 text-sm font-medium text-white hover:bg-[#020617]"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Edit Profil Pengguna
                </button>

                {isKepalaRole ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRaError('')
                      setIsEditRAOpen(true)
                    }}
                    className="w-full rounded-xl border border-[#cbd5e1] px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    Edit Profil RA
                  </button>
                ) : null}
              </div>
            </aside>

            <section className="space-y-4">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-[#0f172a]">Informasi Pengguna</p>
                  <button
                    type="button"
                    onClick={() => {
                      setError('')
                      setIsEditOpen(true)
                    }}
                    className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    Ubah
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nama</p>
                    <p className="mt-1 text-sm font-medium text-[#0f172a]">{userName}</p>
                  </div>
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Jabatan</p>
                    <p className="mt-1 text-sm font-medium text-[#0f172a]">{userAbout}</p>
                  </div>
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Telepon</p>
                    <p className="mt-1 text-sm font-medium text-[#0f172a]">{userPhone}</p>
                  </div>
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Email</p>
                    <p className="mt-1 text-sm font-medium text-[#0f172a]">{userEmail}</p>
                  </div>
                </div>
              </div>

              {isKepalaRole ? (
                <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-[#0f172a]">Informasi RA</p>
                    <button
                      type="button"
                      onClick={() => {
                        setRaError('')
                        setIsEditRAOpen(true)
                      }}
                      className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Ubah
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nama RA</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raNama}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nomor Statistik / Izin</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raNomor}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Alamat</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raAlamat}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Tahun Ajaran</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raTahun}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {isEditOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
          onClick={() => {
            if (!saving) setIsEditOpen(false)
          }}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="text-base font-semibold text-[#111b21]">Edit Profil Pengguna</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={saving}
                aria-label="Tutup modal edit profil"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111b21] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
              <UserProfileForm
                initialName={currentProfile?.nama || ''}
                initialEmail={currentProfile?.email || ''}
                saving={saving}
                error={error}
                submitLabel="Simpan"
                onSubmit={handleSaveUser}
                onCancel={() => setIsEditOpen(false)}
                showCancel
              />
            </div>
          </div>
        </div>
      ) : null}

      {isEditRAOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
          onClick={() => {
            if (!savingRA) setIsEditRAOpen(false)
          }}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="text-base font-semibold text-[#111b21]">Edit Profil RA</h3>
              <button
                type="button"
                onClick={() => setIsEditRAOpen(false)}
                disabled={savingRA}
                aria-label="Tutup modal edit profil RA"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111b21] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
              <RAProfileForm
                initialData={currentRaProfile}
                saving={savingRA}
                error={raError}
                success=""
                onSubmit={handleSaveRA}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

ProfileView.propTypes = {
  profile: PropTypes.shape({
    nama: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    telepon: PropTypes.string,
    jabatan: PropTypes.string,
    foto_url: PropTypes.string,
  }),
  openUserSettingsSignal: PropTypes.number,
  openRaSettingsSignal: PropTypes.number,
  onProfileUpdated: PropTypes.func,
}

ProfileView.defaultProps = {
  profile: null,
  openUserSettingsSignal: 0,
  openRaSettingsSignal: 0,
  onProfileUpdated: undefined,
}

export default ProfileView
