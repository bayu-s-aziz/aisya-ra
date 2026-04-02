import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AcademicCapIcon,
  Bars3Icon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon,
  DocumentTextIcon,
  HomeIcon,
  UserGroupIcon,
  UserIcon,
  BellAlertIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline'
import { fetchAuthMeData } from '../../lib/authMe'
import { useChatStore } from '../../store/chatStore'
import { useAppContext } from '../../contexts/AppContext'

const loadChatList = () => import('../Sidebar/ChatList')
const loadChatView = () => import('../../views/ChatView')
const loadKnowledgeBaseView = () => import('../../views/KnowledgeBaseView')
const loadDashboardView = () => import('../../views/DashboardView')
const loadProfileView = () => import('../../views/ProfileView')
const loadRpphView = () => import('../../views/RpphView')
const loadSuratView = () => import('../../views/SuratView')
const loadNotifikasiView = () => import('../../views/NotifikasiView')
const loadPresensiManagementPanel = () => import('../../components/Settings/PresensiManagementPanel')

const ChatList = lazy(loadChatList)
const ChatView = lazy(loadChatView)
const KnowledgeBaseView = lazy(loadKnowledgeBaseView)
const DashboardView = lazy(loadDashboardView)
const ProfileView = lazy(loadProfileView)
const RpphView = lazy(loadRpphView)
const SuratView = lazy(loadSuratView)
const NotifikasiView = lazy(loadNotifikasiView)
const PresensiManagementPanel = lazy(loadPresensiManagementPanel)

const APP_MENU_ITEMS = [
  {
    id: 'chat',
    title: 'Chat',
    description: 'Ruang percakapan AISYA Assistant',
    icon: ChatBubbleLeftEllipsisIcon,
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Upload dan kelola dokumen pengetahuan',
    icon: BookOpenIcon,
  },
  {
    id: 'rpph',
    title: 'RPPH',
    description: 'Riwayat dan unduh dokumen RPPH',
    icon: CalendarDaysIcon,
  },
  {
    id: 'surat',
    title: 'Surat',
    description: 'Buat surat, arsip, dan template',
    icon: DocumentTextIcon,
  },
  {
    id: 'presensi',
    title: 'Presensi',
    description: 'Input dan rekap presensi siswa',
    icon: BuildingLibraryIcon,
  },
  {
    id: 'notifikasi',
    title: 'Notifikasi',
    description: 'Lihat dan tandai notifikasi terbaru',
    icon: BellAlertIcon,
  },
]

const KEPALA_ROLES = ['kepala_ra', 'kepala', 'admin', 'admin_ra']

const VIEW_LOADING_LABELS = {
  chat: 'Menyiapkan ruang chat...',
  dashboard: 'Memuat dashboard...',
  knowledge: 'Membuka knowledge base...',
  rpph: 'Memuat halaman RPPH...',
  surat: 'Memuat halaman surat...',
  presensi: 'Menyiapkan data presensi...',
  notifikasi: 'Memuat notifikasi...',
  profile: 'Memuat profil...',
}

const VIEW_TRANSITION_CLASS = {
  chat: 'page-enter-chat',
  dashboard: 'page-enter-dashboard',
  knowledge: 'page-enter-knowledge',
  rpph: 'page-enter-rpph',
  surat: 'page-enter-surat',
  presensi: 'page-enter-presensi',
  notifikasi: 'page-enter-notifikasi',
  profile: 'page-enter-profile',
}

const DASHBOARD_MENUS = [
  {
    id: 'ringkasan',
    label: 'Ringkasan Dashboard',
    icon: HomeIcon,
  },
  {
    id: 'manajemen-siswa',
    label: 'Manajemen Siswa',
    icon: AcademicCapIcon,
  },
  {
    id: 'manajemen-presensi',
    label: 'Manajemen Presensi',
    icon: ClipboardDocumentListIcon,
  },
  {
    id: 'manajemen-pengguna',
    label: 'Manajemen Pengguna',
    icon: UserGroupIcon,
    adminOnly: true,
  },
  {
    id: 'manajemen-kelompok',
    label: 'Manajemen Kelompok',
    icon: BuildingLibraryIcon,
    adminOnly: true,
  },
]

function SidebarLoadingFallback() {
  return (
    <div className="h-full bg-transparent px-4 py-4 text-sm text-[#94a3b8]">
      Memuat sidebar...
    </div>
  )
}

function ContentLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-3xl space-y-3">
        <div className="h-4 w-44 rounded-full bg-[#e2e8f0] page-skeleton" />
        <div className="h-20 w-full rounded-2xl bg-[#e2e8f0] page-skeleton" />
        <div className="h-20 w-full rounded-2xl bg-[#e2e8f0] page-skeleton" />
        <p className="pt-1 text-sm text-[#64748b]">Memuat konten...</p>
      </div>
    </div>
  )
}

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

function AppLayout() {
  const token = localStorage.getItem('aisya_access_token')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('chat')
  const [dashboardPanel, setDashboardPanel] = useState('ringkasan')
  const [profileViewMode, setProfileViewMode] = useState('overview')

  const [profile, setProfile] = useState(null)
  const [raProfile, setRaProfile] = useState(null)
  const [shellError, setShellError] = useState('')
  const [isSwitchingView, setIsSwitchingView] = useState(false)

  const userMenuRef = useRef(null)
  const switchTimerRef = useRef(null)

  const {
    selectedRoomId: contextSelectedRoomId,
    selectedDocId,
    documents,
    setSelectedDocId,
    setDocuments,
  } = useAppContext()

  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const chatStoreSelectedRoomId = useChatStore((state) => state.selectedRoomId)

  const shortName = useMemo(() => {
    const fullName = profile?.nama || profile?.name || profile?.email?.split('@')?.[0] || ''
    const parts = fullName.split(' ').filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[1]}`
  }, [profile])

  const userRole = (profile?.role || '').toLowerCase()
  const canManageRaProfile = KEPALA_ROLES.includes(userRole)

  const selectedDoc = useMemo(() => {
    if (currentView !== 'knowledge' || !selectedDocId) return null
    return documents.find((doc) => String(doc.id) === String(selectedDocId)) || null
  }, [documents, selectedDocId, currentView])

  const dashboardMenus = useMemo(() => {
    return DASHBOARD_MENUS.filter((item) => !item.adminOnly || canManageRaProfile)
  }, [canManageRaProfile])

  const viewLoadingLabel = useMemo(() => {
    return VIEW_LOADING_LABELS[currentView] || 'Memuat halaman...'
  }, [currentView])

  const viewTransitionClass = useMemo(() => {
    return VIEW_TRANSITION_CLASS[currentView] || 'page-transition-enter'
  }, [currentView])

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return
      try {
        const me = await fetchAuthMeData(token)
        setProfile(me?.profile || null)
        setRaProfile(me?.ra_profile || null)
      } catch {
        setProfile(null)
        setRaProfile(null)
      }
    }
    fetchProfile()
  }, [token])

  useEffect(() => {
    const namaRa = (raProfile?.nama_ra || '').trim()
    document.title = namaRa ? `AISYA RA | ${namaRa}` : 'AISYA RA'
  }, [raProfile?.nama_ra])

  useEffect(() => {
    if (!isUserMenuOpen) return

    const handleClickOutside = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    const prefetchLikelyTargets = () => {
      if (currentView === 'dashboard') {
        loadDashboardView()
      } else if (currentView === 'profile') {
        loadProfileView()
      } else if (currentView === 'knowledge') {
        loadKnowledgeBaseView()
      } else if (currentView === 'rpph') {
        loadRpphView()
      } else if (currentView === 'surat') {
        loadSuratView()
      } else if (currentView === 'notifikasi') {
        loadNotifikasiView()
      } else if (currentView === 'presensi') {
        loadPresensiManagementPanel()
      }
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(prefetchLikelyTargets, { timeout: 2000 })
      return () => {
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = window.setTimeout(prefetchLikelyTargets, 1200)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [currentView])

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current)
      }
    }
  }, [])

  const finishViewSwitchSoon = useCallback(() => {
    if (switchTimerRef.current) {
      window.clearTimeout(switchTimerRef.current)
    }
    switchTimerRef.current = window.setTimeout(() => {
      setIsSwitchingView(false)
    }, 240)
  }, [])

  const handleViewChange = (view) => {
    setIsSwitchingView(true)
    setShellError('')
    setCurrentView(view)
    if (view === 'profile') {
      setProfileViewMode('overview')
    }
    setIsUserMenuOpen(false)
    finishViewSwitchSoon()
  }

  const openDashboardFromMenu = () => {
    setIsSwitchingView(true)
    setShellError('')
    setCurrentView('dashboard')
    setDashboardPanel('ringkasan')
    setIsUserMenuOpen(false)
    finishViewSwitchSoon()
  }

  const openProfileOverview = () => {
    setIsSwitchingView(true)
    setShellError('')
    setCurrentView('profile')
    setProfileViewMode('overview')
    setIsUserMenuOpen(false)
    finishViewSwitchSoon()
  }

  const handleProfileUpdated = useCallback((updates) => {
    setProfile((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('aisya_access_token')
    localStorage.removeItem('aisya_refresh_token')
    localStorage.removeItem('aisya_user_name')
    localStorage.removeItem('aisya_user_email')
    window.location.assign('/login')
  }

  const renderSidebar = () => {
    return (
      <Suspense fallback={<SidebarLoadingFallback />}>
        <ChatList
          appMenuItems={APP_MENU_ITEMS}
          currentView={currentView}
          onSelectApp={(view) => {
            handleViewChange(view)
            setIsSidebarOpen(false)
          }}
          listTitle={currentView === 'dashboard' ? 'Menu dashboard' : 'Your chats'}
          customItems={currentView === 'dashboard' ? dashboardMenus : []}
          activeCustomItemId={dashboardPanel}
          onCustomItemClick={(itemId) => {
            setDashboardPanel(itemId)
            setIsSidebarOpen(false)
          }}
        />
      </Suspense>
    )
  }

  const renderMainContent = () => {
    if (currentView === 'dashboard') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <DashboardView role={userRole} activePanel={dashboardPanel} />
        </Suspense>
      )
    }

    if (currentView === 'chat') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <ChatView
            roomId={contextSelectedRoomId || chatStoreSelectedRoomId || selectedRoom?.id || ''}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        </Suspense>
      )
    }

    if (currentView === 'knowledge') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <KnowledgeBaseView
            selectedDocId={selectedDocId || ''}
            selectedDoc={selectedDoc}
            onSelectDocId={(docId) => setSelectedDocId(docId)}
            onDocumentsLoaded={(nextDocs) => setDocuments(nextDocs)}
            onDocDeleted={(deletedId) => {
              const nextDocs = documents.filter((doc) => String(doc.id) !== String(deletedId))
              setDocuments(nextDocs)
              if (nextDocs.length > 0) {
                setSelectedDocId(String(nextDocs[0].id))
              } else {
                setSelectedDocId(null)
              }
            }}
          />
        </Suspense>
      )
    }

    if (currentView === 'rpph') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <RpphView />
        </Suspense>
      )
    }

    if (currentView === 'surat') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <SuratView />
        </Suspense>
      )
    }

    if (currentView === 'presensi') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <div className="h-full overflow-y-auto bg-[#f8fafc] px-4 py-4 md:px-6">
            <div className="mx-auto w-full max-w-6xl rounded-3xl border border-[#e2e8f0] bg-white p-4 shadow-sm md:p-6">
              <PresensiManagementPanel />
            </div>
          </div>
        </Suspense>
      )
    }

    if (currentView === 'notifikasi') {
      return (
        <Suspense fallback={<ContentLoadingFallback />}>
          <NotifikasiView />
        </Suspense>
      )
    }

    return (
      <Suspense fallback={<ContentLoadingFallback />}>
        <ProfileView
          profile={profile}
          viewMode={profileViewMode}
          canManageRaProfile={canManageRaProfile}
          onChangeViewMode={setProfileViewMode}
          onProfileUpdated={handleProfileUpdated}
        />
      </Suspense>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f5f7] text-[#0f172a]">
      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#0b1220]/60 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup sidebar"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-[260px] max-w-[90vw] flex-col border-r border-[#e4e7ec] bg-[#f3f4f6] transition-transform duration-200',
          'md:static md:w-[260px] md:max-w-[260px] md:flex-none md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <header className="border-b border-[#e4e7ec] px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111827] text-[11px] font-bold text-white">AI</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">AISYA Workspace</p>
              <p className="text-sm font-semibold text-[#111827]">Panel Kiri</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 py-2">
          {renderSidebar()}
        </div>

        <div className="relative border-t border-[#e4e7ec] p-2" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen((prev) => !prev)
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-white"
            title="Menu pengguna"
          >
            {profile?.foto_url ? (
              <img src={profile.foto_url} alt={shortName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe2ea] text-sm font-semibold text-[#0f172a]">
                {getInitials(shortName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#0f172a]">{shortName || 'Pengguna AISYA'}</p>
              <p className="truncate text-xs text-[#667085]">Free</p>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-[#64748b]" />
          </button>

          {isUserMenuOpen ? (
            <div className="menu-pop absolute bottom-[calc(100%+10px)] left-3 z-50 w-[260px] overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-xl">
              <div className="border-b border-[#e4e7ec] px-4 py-3">
                <p className="text-sm font-semibold text-[#0f172a]">{shortName || 'Pengguna AISYA'}</p>
                <p className="mt-0.5 text-xs text-[#64748b]">{profile?.email || '-'}</p>
              </div>
              <button
                type="button"
                onClick={openDashboardFromMenu}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
              >
                <HomeIcon className="h-4 w-4" />
                Dashboard
              </button>
              <button
                type="button"
                onClick={openProfileOverview}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
              >
                <UserIcon className="h-4 w-4" />
                Lihat Profil
              </button>
              <div className="border-t border-[#e4e7ec]" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-[#dc2626] hover:bg-[#f8fafc]"
              >
                Keluar
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!isSidebarOpen ? (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-3 top-3 z-20 rounded-full border border-[#d0d5dd] bg-white/90 p-2 text-[#475569] shadow-sm hover:bg-white md:hidden"
            aria-label="Buka sidebar"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        ) : null}

        {shellError ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {shellError}
          </div>
        ) : null}

        {isSwitchingView ? (
          <div className="page-switch-overlay pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/45 pt-10 backdrop-blur-[1px]">
            <div className="page-switch-chip inline-flex items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3 py-1.5 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0f172a] page-loader-dot" />
              <span className="h-2 w-2 rounded-full bg-[#334155] page-loader-dot page-loader-dot-delay-1" />
              <span className="h-2 w-2 rounded-full bg-[#64748b] page-loader-dot page-loader-dot-delay-2" />
              <span className="ml-1 text-xs font-medium text-[#475467]">{viewLoadingLabel}</span>
            </div>
          </div>
        ) : null}

        <div
          key={currentView}
          className={[
            'content-fade min-h-0 flex-1 transition-opacity duration-200',
            viewTransitionClass,
            isSwitchingView ? 'opacity-70' : 'opacity-100',
          ].join(' ')}
        >
          {renderMainContent()}
        </div>
      </main>
    </div>
  )
}

export default AppLayout
