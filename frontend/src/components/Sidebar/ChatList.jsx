import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import ChatListItem from './ChatListItem'
import { useChatStore } from '../../store/chatStore'

const CHAT_BOOTSTRAP_KEY = 'aisya_chat_bootstrap_done'

function ChatList({
  appMenuItems,
  currentView,
  onSelectApp,
  listTitle,
  customItems,
  activeCustomItemId,
  onCustomItemClick,
}) {
  const [showSearch, setShowSearch] = useState(false)
  const [isAppsOpen, setIsAppsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [createError, setCreateError] = useState('')
  const [deletingRoomId, setDeletingRoomId] = useState('')
  const rooms = useChatStore((state) => state.rooms)
  const roomsLoading = useChatStore((state) => state.roomsLoading)
  const roomsError = useChatStore((state) => state.roomsError)
  const selectedRoomId = useChatStore((state) => state.selectedRoomId)
  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const refreshRooms = useChatStore((state) => state.refreshRooms)
  const setSelectedRoomId = useChatStore((state) => state.setSelectedRoomId)
  const createDraftRoom = useChatStore((state) => state.createDraftRoom)
  const deleteRoom = useChatStore((state) => state.deleteRoom)

  useEffect(() => {
    let active = true

    const bootstrapInitialChat = async () => {
      const token = localStorage.getItem('aisya_access_token')
      if (!token) return

      if (sessionStorage.getItem(CHAT_BOOTSTRAP_KEY) === '1') return

      await refreshRooms()
      if (!active) return

      sessionStorage.setItem(CHAT_BOOTSTRAP_KEY, '1')
      createDraftRoom()
      if (currentView !== 'chat') {
        onSelectApp?.('chat')
      }
    }

    bootstrapInitialChat()

    return () => {
      active = false
    }
  }, [createDraftRoom, currentView, onSelectApp, refreshRooms])

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((first, second) => {
      const firstTime = new Date(first?.updated_at || first?.created_at || 0).getTime()
      const secondTime = new Date(second?.updated_at || second?.created_at || 0).getTime()
      return secondTime - firstTime
    })
  }, [rooms])

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return sortedRooms

    return sortedRooms.filter((room) => {
      const title = String(room?.nama || '').toLowerCase()
      const preview = String(
        room?.last_message?.content || room?.last_message || room?.pesan_terakhir || '',
      ).toLowerCase()
      return title.includes(normalized) || preview.includes(normalized)
    })
  }, [sortedRooms, query])

  const isCustomMode = Array.isArray(customItems) && customItems.length > 0
  const hasAppMenuItems = Array.isArray(appMenuItems) && appMenuItems.length > 0

  const ensureChatView = () => {
    if (currentView !== 'chat') {
      onSelectApp?.('chat')
    }
  }

  const handleRoomSelect = (room) => {
    setSelectedRoomId(room?.id || '')
    ensureChatView()
  }

  const handleCreateNewChat = () => {
    setCreateError('')
    createDraftRoom()
    ensureChatView()
  }

  const handleDeleteRoom = async (room) => {
    const roomId = room?.id
    if (!roomId) return

    const roomName = room?.nama || 'ruang chat ini'
    const isConfirmed = window.confirm(`Hapus ${roomName}? Tindakan ini tidak bisa dibatalkan.`)
    if (!isConfirmed) return

    setDeletingRoomId(roomId)
    setCreateError('')
    const result = await deleteRoom(roomId)
    if (!result?.ok) {
      setCreateError(result?.error || 'Gagal menghapus ruang chat')
    }
    setDeletingRoomId('')
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent">
      <div className="space-y-1.5 px-2 py-2">
        <button
          type="button"
          aria-label="Buat chat baru"
          onClick={handleCreateNewChat}
          className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-white"
        >
          <PencilSquareIcon className="h-4 w-4" />
          New chat
        </button>

        <button
          type="button"
          aria-label="Cari chat"
          onClick={() => setShowSearch((prev) => !prev)}
          className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-white"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Search chats
        </button>

        <div>
          <button
            type="button"
            aria-label="Buka aplikasi"
            onClick={() => setIsAppsOpen((prev) => !prev)}
            className="inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-white"
          >
            <span className="inline-flex items-center gap-2">
              <Squares2X2Icon className="h-4 w-4" />
              Apps
            </span>
            <ChevronDownIcon className={["h-4 w-4 text-[#667085] transition-transform", isAppsOpen ? 'rotate-180' : 'rotate-0'].join(' ')} />
          </button>

          {isAppsOpen && hasAppMenuItems ? (
            <div className="mt-1 pl-8">
              <div className="max-h-[40vh] overflow-y-auto">
                {appMenuItems.map((item) => {
                  const isActive = currentView === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectApp?.(item.id)
                        setShowSearch(false)
                      }}
                      className={[
                        'mb-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-[#eef2f6] font-semibold text-[#111827]'
                          : 'font-normal text-[#475467] hover:bg-[#f8fafc] hover:text-[#111827]',
                      ].join(' ')}
                    >
                      {item.title}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {showSearch ? (
          <div className="px-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari percakapan"
              className="w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none placeholder:text-[#98a2b3]"
            />
          </div>
        ) : null}
      </div>

      <div className="px-4 pt-3 pb-2">
        <p className="text-xs font-semibold tracking-[0.02em] text-[#98a2b3]">{listTitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {createError ? (
          <div className="px-4 py-2 text-xs text-red-600">{createError}</div>
        ) : null}

        {roomsLoading ? (
          <div className="px-4 py-3 text-sm text-[#64748b]">Memuat chat...</div>
        ) : null}

        {roomsError ? (
          <div className="px-4 py-2 text-sm text-red-600">{roomsError}</div>
        ) : null}

        {isCustomMode
          ? customItems.map((item) => {
            const Icon = item.icon
            const isActive = activeCustomItemId === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onCustomItemClick?.(item.id)}
                className={[
                  'mx-2 mb-1 inline-flex w-[calc(100%-16px)] items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-[#e5e7eb] font-semibold text-[#111827]'
                    : 'font-medium text-[#344054] hover:bg-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })
          : filteredRooms.map((room) => (
            <ChatListItem
              key={room.id}
              room={room}
              isActive={(selectedRoomId || selectedRoom?.id) === room.id}
              onClick={() => handleRoomSelect(room)}
              onDelete={() => handleDeleteRoom(room)}
              isDeleting={deletingRoomId === room.id}
            />
          ))}

        {!isCustomMode && filteredRooms.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#64748b]">Tidak ada chat ditemukan</div>
        ) : null}
      </div>
    </div>
  )
}

ChatList.defaultProps = {
  appMenuItems: [],
  currentView: 'chat',
  onSelectApp: undefined,
  listTitle: 'Your chats',
  customItems: [],
  activeCustomItemId: '',
  onCustomItemClick: undefined,
}

export default ChatList
