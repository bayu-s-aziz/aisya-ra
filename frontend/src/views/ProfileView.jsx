import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { BuildingOffice2Icon, PencilSquareIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import UserProfileForm from '../components/Profile/UserProfileForm'
import RAProfileForm from '../components/Profile/RAProfileForm'
import { saveUserProfile } from '../lib/profile'
import { saveRAProfile } from '../lib/raProfile'
import { fetchAuthMeData } from '../lib/authMe'

function ModeButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-[#0f172a] text-white'
          : 'border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

ModeButton.propTypes = {
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
}

ModeButton.defaultProps = {
  active: false,
  onClick: undefined,
}

function ProfileView({ profile, viewMode, canManageRaProfile, onChangeViewMode, onProfileUpdated }) {
  const [currentProfile, setCurrentProfile] = useState(profile || null)
  const [currentRaProfile, setCurrentRaProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [savingRA, setSavingRA] = useState(false)
  const [raSuccess, setRaSuccess] = useState('')
  const [raError, setRaError] = useState('')

  const isKepalaRole = useMemo(() => {
    const role = (currentProfile?.role || '').toLowerCase()
    return canManageRaProfile || ['kepala_ra', 'kepala', 'admin', 'admin_ra'].includes(role)
  }, [canManageRaProfile, currentProfile?.role])

  useEffect(() => {
    setCurrentProfile(profile || null)
  }, [profile])

  const fetchMe = useCallback(async () => {
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
  }, [onProfileUpdated])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    if (viewMode !== 'school-settings') return
    if (isKepalaRole) return
    onChangeViewMode?.('overview')
  }, [isKepalaRole, onChangeViewMode, viewMode])

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
  const activeMode = viewMode || 'overview'

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f8] px-3 py-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Pusat Profil</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">Profil Pengguna dan Profil Sekolah</h2>
          <p className="mt-2 text-sm text-[#64748b]">Halaman profil dipisah agar data akun pengguna dan data sekolah tidak tercampur.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <ModeButton
              label="Lihat Profil"
              active={activeMode === 'overview'}
              onClick={() => onChangeViewMode?.('overview')}
            />
            <ModeButton
              label="Pengaturan Pengguna"
              active={activeMode === 'user-settings'}
              onClick={() => onChangeViewMode?.('user-settings')}
            />
            {isKepalaRole ? (
              <ModeButton
                label="Pengaturan Sekolah"
                active={activeMode === 'school-settings'}
                onClick={() => onChangeViewMode?.('school-settings')}
              />
            ) : null}
          </div>
        </section>

        {loadError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</div> : null}
        {loading ? <p className="text-sm text-[#64748b]">Memuat profil...</p> : null}
        {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
        {raSuccess ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{raSuccess}</div> : null}

        {activeMode === 'overview' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <UserCircleIcon className="h-5 w-5 text-[#334155]" />
                <p className="text-base font-semibold text-[#0f172a]">Profil Pengguna</p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nama</p>
                  <p className="mt-1 text-sm font-medium text-[#0f172a]">{userName}</p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Role</p>
                  <p className="mt-1 text-sm font-medium capitalize text-[#0f172a]">{userRole}</p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Jabatan</p>
                  <p className="mt-1 text-sm font-medium text-[#0f172a]">{userAbout}</p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Telepon</p>
                  <p className="mt-1 text-sm font-medium text-[#0f172a]">{userPhone}</p>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Email</p>
                  <p className="mt-1 text-sm font-medium text-[#0f172a]">{userEmail}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChangeViewMode?.('user-settings')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#cbd5e1] px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                <PencilSquareIcon className="h-4 w-4" />
                Buka Pengaturan Pengguna
              </button>
            </section>

            <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5 text-[#334155]" />
                <p className="text-base font-semibold text-[#0f172a]">Profil Sekolah</p>
              </div>

              {isKepalaRole ? (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nama RA</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raNama}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Nomor Statistik / Izin</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raNomor}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Tahun Ajaran</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raTahun}</p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">Alamat</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{raAlamat}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onChangeViewMode?.('school-settings')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#cbd5e1] px-3 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    Buka Pengaturan Sekolah
                  </button>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-sm text-[#64748b]">
                  Profil sekolah hanya bisa diatur oleh role Kepala/Admin.
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeMode === 'user-settings' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-[#0f172a]">Pengaturan Profil Pengguna</p>
              <button
                type="button"
                onClick={() => onChangeViewMode?.('overview')}
                className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                Kembali ke Lihat Profil
              </button>
            </div>
            <UserProfileForm
              key={`user-form-${currentProfile?.id || currentProfile?.email || 'default'}`}
              initialName={currentProfile?.nama || ''}
              initialEmail={currentProfile?.email || ''}
              saving={saving}
              error={error}
              submitLabel="Simpan"
              onSubmit={handleSaveUser}
            />
          </section>
        ) : null}

        {activeMode === 'school-settings' && isKepalaRole ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-[#0f172a]">Pengaturan Profil Sekolah</p>
              <button
                type="button"
                onClick={() => onChangeViewMode?.('overview')}
                className="rounded-lg border border-[#cbd5e1] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#f8fafc]"
              >
                Kembali ke Lihat Profil
              </button>
            </div>
            <RAProfileForm
              key={`school-form-${currentRaProfile?.id || currentRaProfile?.nama_ra || 'default'}`}
              initialData={currentRaProfile}
              saving={savingRA}
              error={raError}
              success=""
              onSubmit={handleSaveRA}
            />
          </section>
        ) : null}
      </div>
    </div>
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
  viewMode: PropTypes.oneOf(['overview', 'user-settings', 'school-settings']),
  canManageRaProfile: PropTypes.bool,
  onChangeViewMode: PropTypes.func,
  onProfileUpdated: PropTypes.func,
}

ProfileView.defaultProps = {
  profile: null,
  viewMode: 'overview',
  canManageRaProfile: false,
  onChangeViewMode: undefined,
  onProfileUpdated: undefined,
}

export default ProfileView
