import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import api from '../lib/api'
import RAProfileForm from '../components/Profile/RAProfileForm'
import ProfileInfoCard from '../components/Profile/ProfileInfoCard'
import AppModal from '../components/Modal/AppModal'
import { fetchRAProfile, saveRAProfile } from '../lib/raProfile'

const loadStudentsManagementPanel = () => import('../components/Settings/StudentsManagementPanel')
const loadUsersManagementPanel = () => import('../components/Settings/UsersManagementPanel')
const loadKelompokManagementPanel = () => import('../components/Settings/KelompokManagementPanel')
const loadPresensiManagementPanel = () => import('../components/Settings/PresensiManagementPanel')
const loadAcademicYearManagementPanel = () => import('../components/Settings/AcademicYearManagementPanel')
const loadKnowledgeBaseView = () => import('./KnowledgeBaseView')
const loadSuratView = () => import('./SuratView')

const StudentsManagementPanel = lazy(loadStudentsManagementPanel)
const UsersManagementPanel = lazy(loadUsersManagementPanel)
const KelompokManagementPanel = lazy(loadKelompokManagementPanel)
const PresensiManagementPanel = lazy(loadPresensiManagementPanel)
const AcademicYearManagementPanel = lazy(loadAcademicYearManagementPanel)
const KnowledgeBaseView = lazy(loadKnowledgeBaseView)
const SuratView = lazy(loadSuratView)

const PANEL_LABELS = {
  ringkasan: 'Dashboard',
  'profil-lembaga': 'Profil Lembaga',
  'manajemen-tahun-ajaran': 'Manajemen Tahun Ajaran',
  'manajemen-siswa': 'Manajemen Siswa',
  'manajemen-pengguna': 'Manajemen Pengguna',
  'manajemen-kelompok': 'Manajemen Kelompok',
  'manajemen-presensi': 'Manajemen Presensi',
  'manajemen-berkas-dokumen': 'Manajemen Berkas - Dokumen',
  'manajemen-berkas-surat': 'Manajemen Berkas - Surat',
}

const KEPALA_ROLES = ['kepala_ra', 'kepala', 'admin', 'admin_ra']

function StatCard({ label, value, hint, toneClass }) {
  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#64748b]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#0f172a]">{value}</p>
      <p className={['mt-2 text-xs', toneClass].join(' ')}>{hint}</p>
    </div>
  )
}

function PanelLoadingFallback() {
  return <p className="text-sm text-[#64748b]">Memuat panel...</p>
}

function prefetchPanelById(panelId) {
  if (panelId === 'manajemen-siswa') return loadStudentsManagementPanel()
  if (panelId === 'manajemen-pengguna') return loadUsersManagementPanel()
  if (panelId === 'manajemen-kelompok') return loadKelompokManagementPanel()
  if (panelId === 'manajemen-presensi') return loadPresensiManagementPanel()
  if (panelId === 'manajemen-tahun-ajaran') return loadAcademicYearManagementPanel()
  if (panelId === 'manajemen-berkas-dokumen') return loadKnowledgeBaseView()
  if (panelId === 'manajemen-berkas-surat') return loadSuratView()
  return Promise.resolve()
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  hint: PropTypes.string,
  toneClass: PropTypes.string,
}

StatCard.defaultProps = {
  hint: '',
  toneClass: 'text-[#64748b]',
}

function DashboardView({
  role,
  activePanel,
  selectedDocId,
  selectedDoc,
  onSelectDocId,
  onDocumentsLoaded,
  onDocDeleted,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [raProfile, setRaProfile] = useState(null)
  const [raLoading, setRaLoading] = useState(false)
  const [raLoadError, setRaLoadError] = useState('')
  const [raSaving, setRaSaving] = useState(false)
  const [raSuccess, setRaSuccess] = useState('')
  const [raError, setRaError] = useState('')
  const [isInstitutionModalOpen, setIsInstitutionModalOpen] = useState(false)

  const canManageInstitutionProfile = useMemo(() => {
    const normalizedRole = (role || '').toLowerCase()
    return KEPALA_ROLES.includes(normalizedRole)
  }, [role])

  useEffect(() => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchDashboard = async () => {
      setLoading(true)
      setError('')
      try {
        const normalizedRole = (role || '').toLowerCase()
        const endpoint = ['kepala_ra', 'kepala', 'admin', 'admin_ra'].includes(normalizedRole)
          ? '/dashboard/kepala'
          : '/dashboard/guru'

        const response = await api.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setData(response?.data?.data || null)
      } catch (fetchError) {
        setError(fetchError?.response?.data?.detail || 'Gagal memuat dashboard')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [role])

  useEffect(() => {
    if (activePanel === 'ringkasan') {
      const prefetchLikelyPanels = () => {
        loadStudentsManagementPanel()
        loadPresensiManagementPanel()
      }

      if ('requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(prefetchLikelyPanels, { timeout: 2000 })
        return () => {
          window.cancelIdleCallback(idleId)
        }
      }

      const timeoutId = window.setTimeout(prefetchLikelyPanels, 1200)
      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    prefetchPanelById(activePanel)
    return undefined
  }, [activePanel])

  useEffect(() => {
    if (activePanel !== 'profil-lembaga') return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchInstitutionProfile = async () => {
      setRaLoading(true)
      setRaLoadError('')

      try {
        const profileData = await fetchRAProfile(token)
        setRaProfile(profileData || null)
      } catch (fetchError) {
        setRaLoadError(fetchError?.response?.data?.detail || fetchError?.message || 'Gagal memuat profil lembaga')
      } finally {
        setRaLoading(false)
      }
    }

    fetchInstitutionProfile()
  }, [activePanel])

  const summary = useMemo(() => {
    if (!data) {
      return {
        jumlahSiswa: 0,
        catatanHariIni: 0,
        presensiHariIni: 0,
      }
    }

    const dariKelas = (data?.summary_per_kelas || []).reduce(
      (total, item) => total + (item?.jumlah_siswa || 0),
      0,
    )

    const presensiGuru = data?.rekap_presensi_hari_ini?.total
      ? (data.rekap_presensi_hari_ini.total.hadir || 0)
        + (data.rekap_presensi_hari_ini.total.sakit || 0)
        + (data.rekap_presensi_hari_ini.total.izin || 0)
        + (data.rekap_presensi_hari_ini.total.alpha || 0)
      : 0

    return {
      jumlahSiswa: dariKelas || data?.rekap_presensi_hari_ini?.total?.total_siswa || 0,
      catatanHariIni: data?.jumlah_catatan_minggu_ini || data?.summary_per_guru?.length || 0,
      presensiHariIni: presensiGuru || (data?.summary_per_kelas || []).reduce(
        (total, item) => total + (item?.jumlah_presensi_hari_ini || 0),
        0,
      ),
    }
  }, [data])

  const kelasSummary = useMemo(() => {
    if (!Array.isArray(data?.summary_per_kelas)) return []
    return data.summary_per_kelas.slice(0, 4)
  }, [data])

  const institutionReadonlyItems = useMemo(() => {
    return [
      { label: 'Nama Lembaga', value: raProfile?.nama_ra, fullWidth: true },
      { label: 'NPSN', value: raProfile?.npsn },
      { label: 'NSM / Nomor Statistik', value: raProfile?.nomor_statistik },
      { label: 'Bentuk Pendidikan', value: raProfile?.bentuk_pendidikan },
      { label: 'Status Lembaga', value: raProfile?.status_lembaga },
      { label: 'Penyelenggara', value: raProfile?.penyelenggara },
      { label: 'Akreditasi', value: raProfile?.akreditasi },
      { label: 'SK Izin Operasional', value: raProfile?.sk_izin_operasional, fullWidth: true },
      { label: 'Tanggal Izin Operasional', value: raProfile?.tanggal_izin_operasional },
      { label: 'Nama Kepala RA', value: raProfile?.nama_kepala },
      { label: 'Telepon', value: raProfile?.telepon },
      { label: 'Email Lembaga', value: raProfile?.email_lembaga },
      { label: 'Website', value: raProfile?.website },
      { label: 'Tahun Ajaran', value: raProfile?.tahun_ajaran },
      { label: 'Kelurahan / Desa', value: raProfile?.kelurahan_desa },
      { label: 'Kecamatan', value: raProfile?.kecamatan },
      { label: 'Kabupaten / Kota', value: raProfile?.kabupaten_kota },
      { label: 'Provinsi', value: raProfile?.provinsi },
      { label: 'Kode Pos', value: raProfile?.kode_pos },
      { label: 'Alamat', value: raProfile?.alamat, fullWidth: true },
    ]
  }, [raProfile])

  const institutionSummaryItems = useMemo(() => {
    return [
      { label: 'NPSN', value: raProfile?.npsn || '-' },
      { label: 'NSM', value: raProfile?.nomor_statistik || '-' },
      { label: 'Status Lembaga', value: raProfile?.status_lembaga || '-' },
      { label: 'Akreditasi', value: raProfile?.akreditasi || '-' },
      { label: 'Kepala RA', value: raProfile?.nama_kepala || '-' },
      { label: 'Telepon', value: raProfile?.telepon || '-' },
      { label: 'Email Lembaga', value: raProfile?.email_lembaga || '-' },
    ]
  }, [raProfile])

  const panelTitle = PANEL_LABELS[activePanel] || 'Dashboard'
  const panelSubtitle = activePanel === 'ringkasan'
    ? 'Pantau ringkasan operasional RA secara cepat dari satu layar.'
    : activePanel === 'profil-lembaga'
      ? 'Atur data identitas lembaga langsung dari dashboard AISYA.'
      : 'Kelola data operasional RA pada panel aktif di bawah ini.'

  const handleSaveInstitutionProfile = async (payload) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setRaSaving(true)
    setRaSuccess('')
    setRaError('')

    try {
      await saveRAProfile(token, payload)
      const latestProfile = await fetchRAProfile(token)
      setRaProfile(latestProfile || null)
      setRaSuccess('Profil lembaga berhasil disimpan')
      setIsInstitutionModalOpen(false)
    } catch (saveError) {
      setRaError(saveError?.response?.data?.detail || saveError?.message || 'Gagal menyimpan profil lembaga')
    } finally {
      setRaSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f7f7f8] px-3 py-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Dashboard RA</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">{panelTitle}</h2>
          <p className="mt-2 text-sm text-[#64748b]">{panelSubtitle}</p>
        </section>

        {activePanel === 'ringkasan' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            {loading ? <p className="text-sm text-[#64748b]">Memuat data dashboard...</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            {!loading && !error ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard label="Jumlah Siswa" value={summary.jumlahSiswa} hint="Total siswa aktif saat ini" toneClass="text-[#334155]" />
                  <StatCard label="Catatan Harian" value={summary.catatanHariIni} hint="Catatan yang masuk hari ini" toneClass="text-[#1d4ed8]" />
                  <StatCard label="Presensi Hari Ini" value={summary.presensiHariIni} hint="Rekap kehadiran terbaru" toneClass="text-[#047857]" />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-sm font-semibold text-[#0f172a]">Kelas Terpantau</p>
                    <p className="mt-1 text-xs text-[#64748b]">Ringkasan jumlah siswa dan presensi per kelas</p>
                    {kelasSummary.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {kelasSummary.map((item, index) => (
                          <div key={item.nama_kelas || item.kelas_id || `kelas-${index}`} className="flex items-center justify-between rounded-xl border border-[#dbe3ee] bg-white px-3 py-2 text-sm">
                            <span className="font-medium text-[#0f172a]">{item.nama_kelas || 'Kelas'}</span>
                            <span className="text-[#475569]">{item.jumlah_siswa || 0} siswa</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#64748b]">Belum ada data kelas untuk ditampilkan.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-sm font-semibold text-[#0f172a]">Status Monitoring</p>
                    <div className="mt-3 space-y-2 text-sm text-[#475569]">
                      <p>Tahun ajaran aktif: <span className="font-medium text-[#0f172a]">{data?.tahun_ajaran_aktif || '-'}</span></p>
                      <p>Data dashboard sinkron dengan endpoint role: <span className="font-medium text-[#0f172a]">{(role || 'guru').toLowerCase()}</span></p>
                      <p>Gunakan menu panel di sidebar kiri untuk masuk ke manajemen data detail.</p>
                      <p>Untuk pembaruan, refresh browser atau buka ulang panel Dashboard.</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {activePanel === 'profil-lembaga' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            {raLoading ? <p className="text-sm text-[#64748b]">Memuat profil lembaga...</p> : null}
            {raLoadError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{raLoadError}</p> : null}
            {raSuccess ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{raSuccess}</p> : null}

            {!raLoading && !raLoadError ? (
              <div className="space-y-3">
                <ProfileInfoCard
                  avatarUrl={raProfile?.logo_url || ''}
                  avatarAlt={raProfile?.nama_ra || 'Logo RA'}
                  avatarFallback="RA"
                  title={raProfile?.nama_ra || '-'}
                  subtitle={raProfile?.tahun_ajaran || '-'}
                  items={institutionSummaryItems}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {institutionReadonlyItems.map((item) => (
                    <div
                      key={item.label}
                      className={[
                        'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2',
                        item.fullWidth ? 'sm:col-span-2' : 'sm:col-span-1',
                      ].join(' ')}
                    >
                      <p className="text-xs uppercase tracking-[0.08em] text-[#64748b]">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-[#0f172a]">{item.value || '-'}</p>
                    </div>
                  ))}

                  {canManageInstitutionProfile ? (
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 sm:col-span-2">
                      <p className="text-sm text-[#475569]">Perubahan profil lembaga dilakukan melalui modal edit.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setRaError('')
                          setIsInstitutionModalOpen(true)
                        }}
                        className="mt-3 rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617]"
                      >
                        Ubah Profil Lembaga
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-sm text-[#64748b] sm:col-span-2">
                      Profil lembaga hanya bisa diubah oleh role Kepala/Admin.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {canManageInstitutionProfile ? (
              <AppModal
                isOpen={isInstitutionModalOpen}
                onClose={() => {
                  if (!raSaving) {
                    setIsInstitutionModalOpen(false)
                  }
                }}
                title="Ubah Profil Lembaga"
                description="Perbarui data lembaga melalui form berikut, lalu konfirmasi sebelum menyimpan."
                size="lg"
              >
                <RAProfileForm
                  key={`institution-form-${raProfile?.id || raProfile?.nama_ra || 'default'}`}
                  initialData={raProfile}
                  saving={raSaving}
                  error={raError}
                  success=""
                  onSubmit={handleSaveInstitutionProfile}
                  showSummaryCard={false}
                />
              </AppModal>
            ) : null}
          </section>
        ) : null}

        {activePanel === 'manajemen-siswa' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <StudentsManagementPanel />
            </Suspense>
          </section>
        ) : null}

        {activePanel === 'manajemen-tahun-ajaran' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <AcademicYearManagementPanel />
            </Suspense>
          </section>
        ) : null}

        {activePanel === 'manajemen-pengguna' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <UsersManagementPanel />
            </Suspense>
          </section>
        ) : null}

        {activePanel === 'manajemen-kelompok' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <KelompokManagementPanel />
            </Suspense>
          </section>
        ) : null}

        {activePanel === 'manajemen-presensi' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <PresensiManagementPanel />
            </Suspense>
          </section>
        ) : null}

        {activePanel === 'manajemen-berkas-dokumen' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="min-h-[620px] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
              <Suspense fallback={<PanelLoadingFallback />}>
                <KnowledgeBaseView
                  selectedDocId={selectedDocId}
                  selectedDoc={selectedDoc}
                  onSelectDocId={onSelectDocId}
                  onDocumentsLoaded={onDocumentsLoaded}
                  onDocDeleted={onDocDeleted}
                />
              </Suspense>
            </div>
          </section>
        ) : null}

        {activePanel === 'manajemen-berkas-surat' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="min-h-[620px] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc]">
              <Suspense fallback={<PanelLoadingFallback />}>
                <SuratView />
              </Suspense>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

DashboardView.propTypes = {
  role: PropTypes.string,
  activePanel: PropTypes.oneOf([
    'ringkasan',
    'profil-lembaga',
    'manajemen-tahun-ajaran',
    'manajemen-siswa',
    'manajemen-pengguna',
    'manajemen-kelompok',
    'manajemen-presensi',
    'manajemen-berkas-dokumen',
    'manajemen-berkas-surat',
  ]),
  selectedDocId: PropTypes.string,
  selectedDoc: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nama_file: PropTypes.string,
    total_chunks: PropTypes.number,
  }),
  onSelectDocId: PropTypes.func,
  onDocumentsLoaded: PropTypes.func,
  onDocDeleted: PropTypes.func,
}

DashboardView.defaultProps = {
  role: '',
  activePanel: 'ringkasan',
  selectedDocId: '',
  selectedDoc: null,
  onSelectDocId: undefined,
  onDocumentsLoaded: undefined,
  onDocDeleted: undefined,
}

export default DashboardView
