import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import api from '../../lib/api'
import { useChatStore } from '../../store/chatStore'

const PAGE_SIZE = 20

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

function EmptyChatState({ onOpenSidebar }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-white px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[#0f172a]">AISYA Assistant</h1>
        <p className="mt-2 text-sm text-[#64748b]">How can I help you today?</p>
      </div>
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-lg bg-[#007aff] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0056cc] md:hidden"
      >
        Open Sidebar
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

  const rooms = useChatStore((state) => state.rooms)
  const selectedRoomId = useChatStore((state) => state.selectedRoomId)
  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const incomingMessages = useChatStore((state) => state.incomingMessages)
  const sending = useChatStore((state) => state.sending)
  const sendError = useChatStore((state) => state.sendError)
  const realtimeError = useChatStore((state) => state.realtimeError)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const sendVoice = useChatStore((state) => state.sendVoice)
  const setSelectedRoomId = useChatStore((state) => state.setSelectedRoomId)
  const subscribeActiveRoomRealtime = useChatStore((state) => state.subscribeActiveRoomRealtime)

  const activeRoomId = roomId || selectedRoomId || ''
  const activeRoom = useMemo(() => {
    if (selectedRoom?.id === activeRoomId) return selectedRoom
    return rooms.find((item) => item.id === activeRoomId) || null
  }, [activeRoomId, rooms, selectedRoom])

  const hasMore = messages.length < total

  useEffect(() => {
    if (!roomId) return
    if (selectedRoomId === roomId) return
    setSelectedRoomId(roomId)
  }, [roomId, selectedRoomId, setSelectedRoomId])

  const fetchMessages = useCallback(
    async (targetPage, mode = 'initial') => {
      if (!activeRoomId) return

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
          setMessages(sortByTimestampAscending(uniqueById(fetched)))
          return
        }

        setMessages((prev) => sortByTimestampAscending(uniqueById([...fetched, ...prev])))
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
    [activeRoomId],
  )

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([])
      setPage(1)
      setTotal(0)
      setMessagesError('')
      return
    }

    setPage(1)
    fetchMessages(1, 'initial')
  }, [activeRoomId, fetchMessages])

  useEffect(() => {
    if (!activeRoomId || !incomingMessages.length) return
    setMessages((prev) => sortByTimestampAscending(uniqueById([...prev, ...incomingMessages])))
  }, [activeRoomId, incomingMessages])

  useEffect(() => {
    const unsubscribe = subscribeActiveRoomRealtime(activeRoomId)
    return () => {
      unsubscribe?.()
    }
  }, [activeRoomId, subscribeActiveRoomRealtime])

  const handleLoadMore = useCallback(() => {
    if (!activeRoomId || loadingInitial || loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMessages(nextPage, 'more')
  }, [activeRoomId, fetchMessages, hasMore, loadingInitial, loadingMore, page])

  const handleAttach = (file) => {
    console.info('File terpilih:', file?.name)
  }

  if (!activeRoomId) {
    return <EmptyChatState onOpenSidebar={onOpenSidebar} />
  }

  return (
    <>
      <ChatHeader room={activeRoom} onBack={onOpenSidebar} />
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
        onSendVoice={sendVoice}
        onAttach={handleAttach}
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
