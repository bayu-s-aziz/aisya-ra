import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import api from '../../lib/api'
import { useChatStore } from '../../store/chatStore'

const PAGE_SIZE = 20
const DRAFT_ROOM_PREFIX = 'draft-'

function isDraftRoomId(roomId) {
  return String(roomId || '').startsWith(DRAFT_ROOM_PREFIX)
}

function sortByTimestampAscending(list) {
  return [...list].sort((first, second) => {
    const firstDate = new Date(first?.timestamp || 0).getTime()
    const secondDate = new Date(second?.timestamp || 0).getTime()
    return firstDate - secondDate
  })
}

function uniqueById(list) {
  const map = new Map()
  list.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item)
    }
  })
  return Array.from(map.values())
}

function toTimestampMs(timestamp) {
  const value = new Date(timestamp || 0).getTime()
  return Number.isNaN(value) ? 0 : value
}

function normalizeComparableText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function shouldTreatAsSameMessage(first, second) {
  if (!first || !second) return false
  if (first.id && second.id && first.id === second.id) return true

  if ((first.role_msg || '') !== (second.role_msg || '')) return false
  if (normalizeComparableText(first.content) !== normalizeComparableText(second.content)) return false

  const firstRoom = first.room_id || ''
  const secondRoom = second.room_id || ''
  if (firstRoom && secondRoom && firstRoom !== secondRoom) return false

  const diffMs = Math.abs(toTimestampMs(first.timestamp) - toTimestampMs(second.timestamp))
  return diffMs <= 45000
}

function pickBetterMessage(current, incoming) {
  const currentPending = current?.status === 'pending'
  const incomingPending = incoming?.status === 'pending'

  if (currentPending && !incomingPending) {
    return { ...current, ...incoming }
  }

  if (!currentPending && incomingPending) {
    return current
  }

  return toTimestampMs(incoming?.timestamp) >= toTimestampMs(current?.timestamp)
    ? { ...current, ...incoming }
    : current
}

function mergeMessagesForView(list) {
  const sorted = sortByTimestampAscending(uniqueById(list))
  const merged = []

  sorted.forEach((message) => {
    const duplicateIndex = merged.findIndex((existing) => shouldTreatAsSameMessage(existing, message))
    if (duplicateIndex < 0) {
      merged.push(message)
      return
    }

    merged[duplicateIndex] = pickBetterMessage(merged[duplicateIndex], message)
  })

  return sortByTimestampAscending(merged)
}

function EmptyChatState({ onOpenSidebar }) {
  const suggestions = [
    'Buatkan ide kegiatan tematik untuk besok',
    'Tolong ringkas isi rapat guru minggu ini',
    'Susun draft pesan untuk wali murid',
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_top,_#eef2ff_0%,_#f8fafc_45%,_#f8fafc_100%)] px-4">
      <div className="max-w-2xl rounded-3xl border border-[#e2e8f0] bg-white px-8 py-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-[#0f172a]">AISYA Assistant</h1>
        <p className="mt-2 text-sm text-[#64748b]">Pilih percakapan di sidebar kiri atau buat ruang baru untuk memulai.</p>
        <div className="mt-5 grid gap-2 text-left">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="rounded-xl border border-[#e4e7ec] bg-[#f8fafc] px-3 py-2 text-sm text-[#344054]"
            >
              {suggestion}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#020617] md:hidden"
      >
        Buka Sidebar
      </button>
    </div>
  )
}

EmptyChatState.propTypes = {
  onOpenSidebar: PropTypes.func.isRequired,
}

function ChatRoom({ roomId, onOpenSidebar }) {
  const [messages, setMessages] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [messagesError, setMessagesError] = useState('')

  const selectedRoomId = useChatStore((state) => state.selectedRoomId)
  const incomingMessages = useChatStore((state) => state.incomingMessages)
  const sending = useChatStore((state) => state.sending)
  const sendError = useChatStore((state) => state.sendError)
  const realtimeError = useChatStore((state) => state.realtimeError)
  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const setSelectedRoomId = useChatStore((state) => state.setSelectedRoomId)
  const subscribeActiveRoomRealtime = useChatStore((state) => state.subscribeActiveRoomRealtime)

  const activeRoomId = roomId || selectedRoomId || ''
  const isDraftRoom = isDraftRoomId(activeRoomId)

  const hasMore = messages.length < total

  useEffect(() => {
    if (!roomId) return
    if (selectedRoomId === roomId) return
    setSelectedRoomId(roomId)
  }, [roomId, selectedRoomId, setSelectedRoomId])

  const fetchMessages = useCallback(
    async (targetPage, mode = 'initial') => {
      if (!activeRoomId || isDraftRoom) return

      const token = localStorage.getItem('aisya_access_token')
      if (!token) return

      if (mode === 'initial') {
        setLoadingInitial(true)
      } else {
        setLoadingMore(true)
      }
      setMessagesError('')

      try {
        const response = await api.get(`/chat/rooms/${activeRoomId}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            page: targetPage,
            limit: PAGE_SIZE,
          },
        })

        const payload = response?.data || {}
        const fetched = Array.isArray(payload?.data) ? payload.data : []
        const totalCount = Number(payload?.total || 0)

        setTotal(totalCount)

        if (mode === 'initial') {
          setMessages(mergeMessagesForView(fetched))
          return
        }

        setMessages((prev) => mergeMessagesForView([...fetched, ...prev]))
      } catch (err) {
        setMessagesError(err?.response?.data?.detail || 'Gagal memuat pesan')
      } finally {
        if (mode === 'initial') {
          setLoadingInitial(false)
        } else {
          setLoadingMore(false)
        }
      }
    },
    [activeRoomId, isDraftRoom],
  )

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([])
      setPage(1)
      setTotal(0)
      setMessagesError('')
      return
    }

    if (isDraftRoom) {
      setMessages([])
      setPage(1)
      setTotal(0)
      setMessagesError('')
      return
    }

    setPage(1)
    fetchMessages(1, 'initial')
  }, [activeRoomId, fetchMessages, isDraftRoom])

  useEffect(() => {
    if (!activeRoomId || !incomingMessages.length) return
    setMessages((prev) => mergeMessagesForView([...prev, ...incomingMessages]))
  }, [activeRoomId, incomingMessages])

  useEffect(() => {
    if (isDraftRoom) return
    const unsubscribe = subscribeActiveRoomRealtime(activeRoomId)
    return () => {
      unsubscribe?.()
    }
  }, [activeRoomId, isDraftRoom, subscribeActiveRoomRealtime])

  const handleLoadMore = useCallback(() => {
    if (!activeRoomId || isDraftRoom || loadingInitial || loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMessages(nextPage, 'more')
  }, [activeRoomId, fetchMessages, hasMore, isDraftRoom, loadingInitial, loadingMore, page])

  if (!activeRoomId) {
    return <EmptyChatState onOpenSidebar={onOpenSidebar} />
  }

  return (
    <>
      <ChatHeader room={selectedRoom} onBack={onOpenSidebar} isTyping={sending} />

      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isBotTyping={sending}
          loadingInitial={loadingInitial}
          loadingMore={loadingMore}
          error={messagesError}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
        />
      </div>
      {sendError ? <div className="bg-red-50 px-4 py-2 text-xs text-red-700">{sendError}</div> : null}
      {realtimeError ? <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700">{realtimeError}</div> : null}
      <ChatInput
        onSend={sendMessage}
        disabled={sending}
      />
    </>
  )
}

ChatRoom.propTypes = {
  roomId: PropTypes.string,
  onOpenSidebar: PropTypes.func.isRequired,
}

ChatRoom.defaultProps = {
  roomId: '',
}

export default ChatRoom
