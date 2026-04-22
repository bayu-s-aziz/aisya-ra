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
    { label: 'Catat kehadiran kelas', icon: '📝' },
    { label: 'Buat draf surat undangan', icon: '✉️' },
    { label: 'Susun RPPH', icon: '📚' },
    { label: 'Buat rekap absen bulan ini', icon: '📊' },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4" style={{
      background: 'radial-gradient(ellipse at top, #f1f5f9 0%, #ffffff 70%)'
    }}>
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] shadow-lg">
            <span className="text-2xl font-bold text-white">AI</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0f172a]">Selamat Datang di AISYA</h1>
          <p className="mt-2 text-base text-[#64748b]">Asisten cerdas untuk manajemen administrasi madrasah Anda.</p>
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              className="group flex flex-col items-start rounded-2xl border border-[#e2e8f0] bg-white p-5 text-left transition-all hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:shadow-sm"
              onClick={() => {
                // In a real implementation we would populate the composer here
                const input = document.querySelector('textarea[name="chat-input"]')
                if (input) {
                  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
                  setter.call(input, suggestion.label)
                  input.dispatchEvent(new Event('input', { bubbles: true }))
                  input.focus()
                }
              }}
            >
              <span className="mb-2 text-2xl">{suggestion.icon}</span>
              <span className="text-sm font-medium text-[#1e293b]">{suggestion.label}</span>
              <span className="mt-1 text-xs text-[#64748b] opacity-0 transition-opacity group-hover:opacity-100">Gunakan prompt ini →</span>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSidebar}
        className="mt-8 rounded-full bg-[#0f172a] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#020617] md:hidden"
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
