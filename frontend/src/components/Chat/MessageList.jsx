import { useCallback, useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import MessageBubble from './MessageBubble'

function TypingBubble() {
  return (
    <div className="mb-6 flex w-full justify-start">
      <div className="w-full max-w-[52rem]">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0f172a] text-[11px] font-bold text-white">AI</div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">AISYA</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-2xl border border-[#d0d5dd] bg-white px-4 py-3 shadow-sm">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}

function sortByTimestampAscending(list) {
  return [...list].sort((first, second) => {
    const firstDate = new Date(first?.timestamp || 0).getTime()
    const secondDate = new Date(second?.timestamp || 0).getTime()
    return firstDate - secondDate
  })
}

function getDateKey(timestamp) {
  if (!timestamp) return 'unknown'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(dateKey) {
  if (dateKey === 'unknown') return 'Tanggal tidak diketahui'

  const [yearText, monthText, dayText] = dateKey.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return dateKey

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(year, month - 1, day)

  const oneDay = 24 * 60 * 60 * 1000
  const diff = Math.round((today.getTime() - target.getTime()) / oneDay)

  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Kemarin'

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function DateDivider({ label }) {
  return (
    <div className="my-4 flex w-full justify-center">
      <span className="rounded-full border border-[#d1d5db] bg-white/90 px-3 py-1 text-[11px] font-medium leading-none text-[#667085] shadow-sm backdrop-blur">
        {label}
      </span>
    </div>
  )
}

DateDivider.propTypes = {
  label: PropTypes.string.isRequired,
}

function MessageList({ messages, isBotTyping, loadingInitial, loadingMore, error, hasMore, onLoadMore }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const prevLengthRef = useRef(0)
  const prevLastMessageIdRef = useRef(null)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    const previousLength = prevLengthRef.current
    const nextLength = messages.length
    const lastMessage = nextLength > 0 ? messages[nextLength - 1] : null
    const lastMessageId = lastMessage?.id || null
    const previousLastMessageId = prevLastMessageIdRef.current

    const isInitialLoad = previousLength === 0 && nextLength > 0
    const hasNewTailMessage =
      nextLength > 0 &&
      lastMessageId &&
      previousLastMessageId &&
      lastMessageId !== previousLastMessageId

    if (isInitialLoad || hasNewTailMessage) {
      requestAnimationFrame(() => scrollToBottom(isInitialLoad ? 'auto' : 'smooth'))
    }

    prevLengthRef.current = nextLength
    prevLastMessageIdRef.current = lastMessageId
  }, [messages, scrollToBottom])

  const sortedMessages = useMemo(() => sortByTimestampAscending(messages), [messages])
  const groupedMessages = useMemo(() => {
    const rows = []
    let currentDateKey = ''

    sortedMessages.forEach((message, index) => {
      const messageDateKey = getDateKey(message?.timestamp)
      if (messageDateKey !== currentDateKey) {
        currentDateKey = messageDateKey
        rows.push({ type: 'divider', key: `divider-${messageDateKey}`, label: formatDateLabel(messageDateKey) })
      }

      rows.push({ type: 'message', key: `msg-${message?.id || `fallback-${index}`}`, message })
    })

    return rows
  }, [sortedMessages])

  const quickIdeas = [
    'Bantu susun RPPH tema minggu ini',
    'Ringkas poin penting dari percakapan terakhir',
    'Buatkan draft pengumuman untuk orang tua',
  ]

  return (
    <div className="relative flex h-full flex-col bg-[#fdfdfd]">
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-4 md:px-6"
        onScroll={(event) => {
          const current = event.currentTarget
          if (current.scrollTop < 120 && hasMore && !loadingInitial && !loadingMore) {
            onLoadMore?.()
          }
        }}
      >
        <div className="mx-auto w-full max-w-[52rem]">
          <div className="h-2 w-full" />

          {loadingMore ? (
            <div className="mb-2 text-center text-xs text-[#64748b]">Memuat pesan lebih lama...</div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {loadingInitial ? (
            <div className="py-6 text-center text-sm text-[#64748b]">Memuat pesan...</div>
          ) : null}

          {!loadingInitial && sortedMessages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-2xl rounded-[24px] border border-[#f1f5f9] bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f172a] shadow-md">
                <span className="text-xl font-bold text-white">AI</span>
              </div>
              <p className="text-xl font-semibold text-[#0f172a]">Ruang Perencanaan</p>
              <p className="mt-2 text-sm text-[#64748b]">Apa yang ingin Anda selesaikan di sesi ini?</p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {['/absensi', '/surat', '/rekap', '/rpph'].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => {
                        const input = document.querySelector('textarea[name="chat-input"]')
                        if (input) {
                          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
                          setter.call(input, idea + ' ')
                          input.dispatchEvent(new Event('input', { bubbles: true }))
                          input.focus()
                        }
                    }}
                    className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#e2e8f0] hover:text-[#0f172a] shadow-sm transition-all"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {groupedMessages.map((row) => {
            if (row.type === 'divider') {
              return <DateDivider key={row.key} label={row.label} />
            }

            return <MessageBubble key={row.key} message={row.message} />
          })}

          {isBotTyping ? <TypingBubble /> : null}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

MessageList.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      role_msg: PropTypes.string,
      content: PropTypes.string,
      timestamp: PropTypes.string,
      media_type: PropTypes.string,
      media_url: PropTypes.string,
    }),
  ),
  isBotTyping: PropTypes.bool,
  loadingInitial: PropTypes.bool,
  loadingMore: PropTypes.bool,
  error: PropTypes.string,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
}

MessageList.defaultProps = {
  messages: [],
  isBotTyping: false,
  loadingInitial: false,
  loadingMore: false,
  error: '',
  hasMore: false,
  onLoadMore: undefined,
}

export default MessageList
