import { useEffect, useMemo, useState } from 'react'
import {
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import ChatListItem from './ChatListItem'
import NewRoomModal from '../Modal/NewRoomModal'
import { useChatStore } from '../../store/chatStore'

function ChatList() {
  const [query, setQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const rooms = useChatStore((state) => state.rooms)
  const roomsLoading = useChatStore((state) => state.roomsLoading)
  const roomsError = useChatStore((state) => state.roomsError)
  const selectedRoomId = useChatStore((state) => state.selectedRoomId)
  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const refreshRooms = useChatStore((state) => state.refreshRooms)
  const setSelectedRoom = useChatStore((state) => state.setSelectedRoom)
  const setSelectedRoomId = useChatStore((state) => state.setSelectedRoomId)
  const prependRoom = useChatStore((state) => state.prependRoom)

  useEffect(() => {
    refreshRooms()
  }, [refreshRooms])

  const filteredRooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return rooms

    return rooms.filter((room) => {
      const roomName = room?.nama?.toLowerCase() || ''
      const previewMessage = (
        room?.last_message?.content ||
        room?.last_message ||
        room?.pesan_terakhir ||
        room?.tipe ||
        ''
      ).toLowerCase()

      return roomName.includes(normalizedQuery) || previewMessage.includes(normalizedQuery)
    })
  }, [rooms, query])

  const handleRoomSelect = (room) => {
    setSelectedRoomId(room?.id || '')
  }

  const handleRoomCreated = (newRoom) => {
    prependRoom(newRoom)
    setSelectedRoom(newRoom)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <p className="text-sm font-semibold text-[#0f172a]">Chat History</p>

        <div className="flex items-center gap-2 text-[#64748b]">
          <button
            type="button"
            aria-label="Buat chat baru"
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg p-2 transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="border-b border-[#e5e7eb] px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-[#f9fafb] px-3 py-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-[#9ca3af]" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="w-full border-none bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#9ca3af]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {roomsLoading ? (
          <div className="px-4 py-3 text-sm text-[#64748b]">Loading chats...</div>
        ) : null}

        {roomsError ? (
          <div className="px-4 py-2 text-sm text-red-600">{roomsError}</div>
        ) : null}

        {filteredRooms.map((room) => (
          <ChatListItem
            key={room.id}
            room={room}
            isActive={(selectedRoomId || selectedRoom?.id) === room.id}
            onClick={() => handleRoomSelect(room)}
          />
        ))}

        {filteredRooms.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#64748b]">No chats found</div>
        ) : null}
      </div>

      <NewRoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  )
}

export default ChatList
