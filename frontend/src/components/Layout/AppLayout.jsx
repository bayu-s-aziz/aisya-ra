import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bars3Icon,
  ChevronDownIcon,
  BookOpenIcon,
  HomeIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { fetchAuthMeData } from '../../lib/authMe'
import { useChatStore } from '../../store/chatStore'
import { useAppContext } from '../../contexts/AppContext'

const loadChatList = () => import('../Sidebar/ChatList')
const loadChatView = () => import('../../views/ChatView')
const loadKnowledgeBaseView = () => import('../../views/KnowledgeBaseView')
const loadDashboardView = () => import('../../views/DashboardView')
const loadProfileView = () => import('../../views/ProfileView')

const ChatList = lazy(loadChatList)
const ChatView = lazy(loadChatView)
const KnowledgeBaseView = lazy(loadKnowledgeBaseView)
const DashboardView = lazy(loadDashboardView)
const ProfileView = lazy(loadProfileView)

const loadStudentsManagementPanel = () => import('../../components/Settings/StudentsManagementPanel')
const loadUsersManagementPanel = () => import('../../components/Settings/UsersManagementPanel')
const loadKelompokManagementPanel = () => import('../../components/Settings/KelompokManagementPanel')
const loadPresensiManagementPanel = () => import('../../components/Settings/PresensiManagementPanel')

const DASHBOARD_MENUS = [
  { id: 'ringkasan', label: 'Ringkasan Dashboard' },
  { id: 'manajemen-siswa', label: 'Manajemen Siswa' },
  { id: 'manajemen-presensi', label: 'Manajemen Presensi' },
  { id: 'manajemen-pengguna', label: 'Manajemen Pengguna' },
  { id: 'manajemen-kelompok', label: 'Manajemen Kelompok' },
]

const KEPALA_ROLES = ['kepala_ra', 'kepala', 'admin', 'admin_ra']

function SidebarLoadingFallback() {
  return (
    <div className="h-full rounded-2xl border border-[#323847] bg-[#202634] px-4 py-4 text-sm text-[#94a3b8]">
      Memuat sidebar...
    </div>
  )
}

function ContentLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-white px-4">
      <p className="text-sm text-[#64748b]">Memuat konten...</p>
    </div>
  )
}

function prefetchDashboardPanelResources(panelId) {
  if (panelId === 'manajemen-siswa') return loadStudentsManagementPanel()
  if (panelId === 'manajemen-pengguna') return loadUsersManagementPanel()
  if (panelId === 'manajemen-kelompok') return loadKelompokManagementPanel()
  if (panelId === 'manajemen-presensi') return loadPresensiManagementPanel()
  return Promise.resolve()
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
  const [currentView, setCurrentView] = useState('chat') // default to chat like ChatGPT
  const [dashboardPanel, setDashboardPanel] = useState('ringkasan')
  const [openUserSettingsSignal, setOpenUserSettingsSignal] = useState(0)
  const [openRaSettingsSignal, setOpenRaSettingsSignal] = useState(0)

  const [profile, setProfile] = useState(null)
  const [raProfile, setRaProfile] = useState(null)
  const userMenuRef = useRef(null)

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

  const activeTitle = useMemo(() => {
    const titleMap = {
      chat: 'AISYA Assistant',
      knowledge: 'Knowledge Base',
      dashboard: 'Dashboard',
      profile: 'Profil',
    }
    return titleMap[currentView] || 'AISYA'
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
    if (currentView === 'chat' && (chatStoreSelectedRoomId || selectedRoom?.id)) {
      // setSelectedRoomId(String(chatStoreSelectedRoomId || selectedRoom?.id))
      setIsSidebarOpen(false)
    }
  }, [chatStoreSelectedRoomId, selectedRoom?.id, currentView])

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

  const handleViewChange = (view) => {
    setCurrentView(view)
    setIsUserMenuOpen(false)
    if (view === 'chat') {
      setIsSidebarOpen(true) // open sidebar for chat
    } else {
      setIsSidebarOpen(false)
    }
  }

  const openDashboardFromMenu = () => {
    setCurrentView('dashboard')
    setDashboardPanel('ringkasan')
    setIsUserMenuOpen(false)
    setIsSidebarOpen(false)
  }

  const openKnowledgeBaseFromMenu = () => {
    setCurrentView('knowledge')
    setIsUserMenuOpen(false)
    setIsSidebarOpen(false)
  }

  const openUserProfileSettings = () => {
    setCurrentView('profile')
    setOpenUserSettingsSignal((prev) => prev + 1)
    setIsUserMenuOpen(false)
    setIsSidebarOpen(false)
  }

  const openRaProfileSettings = () => {
    setCurrentView('profile')
    setOpenRaSettingsSignal((prev) => prev + 1)
    setIsUserMenuOpen(false)
    setIsSidebarOpen(false)
  }

  const openProfileOverview = () => {
    setCurrentView('profile')
    setIsUserMenuOpen(false)
    setIsSidebarOpen(false)
  }

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
        <ChatList />
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

    return (
      <Suspense fallback={<ContentLoadingFallback />}>
        <ProfileView
          profile={profile}
          openUserSettingsSignal={openUserSettingsSignal}
          openRaSettingsSignal={openRaSettingsSignal}
          onProfileUpdated={(updates) => setProfile((prev) => ({ ...prev, ...updates }))}
        />
      </Suspense>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
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
          'fixed inset-y-0 left-0 z-40 flex w-[320px] max-w-[92vw] flex-col border-r border-[#e5e7eb] bg-white transition-transform duration-200',
          'md:static md:w-[320px] md:max-w-[320px] md:flex-none md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="min-h-0 flex-1 px-3 py-3">
          {renderSidebar()}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-3 py-2.5 md:px-6">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-full p-2 text-[#475569] hover:bg-[#f1f5f9] md:hidden"
            aria-label="Buka sidebar"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 md:flex-none">
            <p className="truncate text-sm font-semibold text-[#0f172a] md:text-base">{activeTitle}</p>
          </div>
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-[#e5e7eb] bg-white px-3 py-2 text-left hover:bg-[#f8fafc]"
              title="Menu pengguna"
            >
              {profile?.foto_url ? (
                <img src={profile.foto_url} alt={shortName} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f5f9] text-sm font-semibold text-[#0f172a]">
                  {getInitials(shortName)}
                </div>
              )}
              <ChevronDownIcon className="h-4 w-4 text-[#64748b]" />
            </button>

            {isUserMenuOpen ? (
              <div className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-64 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-lg">
                <button
                  type="button"
                  onClick={openKnowledgeBaseFromMenu}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
                >
                  <BookOpenIcon className="h-4 w-4" />
                  Knowledge Base
                </button>
                <button
                  type="button"
                  onClick={openDashboardFromMenu}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
                >
                  <HomeIcon className="h-4 w-4" />
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={openUserProfileSettings}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
                >
                  <UserIcon className="h-4 w-4" />
                  Pengaturan Profil Pengguna
                </button>
                {canManageRaProfile ? (
                  <button
                    type="button"
                    onClick={openRaProfileSettings}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
                  >
                    <UserIcon className="h-4 w-4" />
                    Pengaturan Profil RA
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openProfileOverview}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f8fafc]"
                >
                  <UserIcon className="h-4 w-4" />
                  Lihat Profil
                </button>
                <div className="border-t border-[#e5e7eb]" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left text-sm text-[#dc2626] hover:bg-[#f8fafc]"
                >
                  Keluar
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1">{renderMainContent()}</div>
      </main>
    </div>
  )
}

export default AppLayout
