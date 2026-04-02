import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import api from '../lib/api'

const loadStudentsManagementPanel = () => import('../components/Settings/StudentsManagementPanel')
const loadUsersManagementPanel = () => import('../components/Settings/UsersManagementPanel')
const loadKelompokManagementPanel = () => import('../components/Settings/KelompokManagementPanel')
const loadPresensiManagementPanel = () => import('../components/Settings/PresensiManagementPanel')

const StudentsManagementPanel = lazy(loadStudentsManagementPanel)
const UsersManagementPanel = lazy(loadUsersManagementPanel)
const KelompokManagementPanel = lazy(loadKelompokManagementPanel)
const PresensiManagementPanel = lazy(loadPresensiManagementPanel)

const PANEL_LABELS = {
  ringkasan: 'Dashboard',
  'manajemen-siswa': 'Manajemen Siswa',
  'manajemen-pengguna': 'Manajemen Pengguna',
  'manajemen-kelompok': 'Manajemen Kelompok',
  'manajemen-presensi': 'Manajemen Presensi',
}

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

function DashboardView({ role, activePanel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

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

  const panelTitle = PANEL_LABELS[activePanel] || 'Dashboard'
  const panelSubtitle = activePanel === 'ringkasan'
    ? 'Pantau ringkasan operasional RA secara cepat dari satu layar.'
    : 'Kelola data operasional RA pada panel aktif di bawah ini.'

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

        {activePanel === 'manajemen-siswa' ? (
          <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <Suspense fallback={<PanelLoadingFallback />}>
              <StudentsManagementPanel />
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
      </div>
    </div>
  )
}

DashboardView.propTypes = {
  role: PropTypes.string,
  activePanel: PropTypes.oneOf(['ringkasan', 'manajemen-siswa', 'manajemen-pengguna', 'manajemen-kelompok', 'manajemen-presensi']),
}

DashboardView.defaultProps = {
  role: '',
  activePanel: 'ringkasan',
}

export default DashboardView
