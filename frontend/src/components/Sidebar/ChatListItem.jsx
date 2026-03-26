import PropTypes from 'prop-types'

const AVATAR_COLORS = [
  'bg-rose-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-teal-400',
  'bg-sky-400',
  'bg-indigo-400',
  'bg-violet-400',
  'bg-fuchsia-400',
]

function hashText(text) {
  return text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

function getAvatarColorSeed(text) {
  return AVATAR_COLORS[hashText(text) % AVATAR_COLORS.length]
}

function getInitials(name) {
  if (!name) return 'RM'
  const parts = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part[0]?.toUpperCase()).join('')
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

function getStartOfWeek(currentDate) {
  const date = new Date(currentDate)
  const day = date.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - diffToMonday)
  return date
}

function formatTimestamp(timestamp) {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const weekStart = getStartOfWeek(now)

  if (isSameDay(date, now)) {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  if (date >= weekStart) {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
    }).format(date)
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

function ChatListItem({ room, isActive, onClick }) {
  const roomName = room?.nama || 'Ruang tanpa nama'
  const previewMessage = room?.last_message?.content || room?.last_message || room?.pesan_terakhir || room?.tipe || 'Belum ada pesan'
  const unreadCount = Number(room?.unread_count || room?.jumlah_belum_dibaca || 0)
  const timestamp = room?.last_message?.timestamp || room?.last_message_timestamp || room?.updated_at || room?.created_at

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b border-[#e5e7eb] ${
        isActive ? 'bg-[#f1f5f9]' : 'bg-transparent hover:bg-[#f8fafc]'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColorSeed(roomName)}`}>
        {getInitials(roomName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate text-sm leading-5 text-[#0f172a] ${unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
            {roomName}
          </p>
          <span className="shrink-0 text-xs text-[#64748b]">{formatTimestamp(timestamp)}</span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm text-[#64748b]">{previewMessage}</p>
          {unreadCount > 0 ? (
            <span className="inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#22c55e] px-1.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

ChatListItem.propTypes = {
  room: PropTypes.shape({
    id: PropTypes.string,
    nama: PropTypes.string,
    tipe: PropTypes.string,
    last_message: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        content: PropTypes.string,
        timestamp: PropTypes.string,
      }),
    ]),
    pesan_terakhir: PropTypes.string,
    unread_count: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    jumlah_belum_dibaca: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    last_message_timestamp: PropTypes.string,
    updated_at: PropTypes.string,
    created_at: PropTypes.string,
  }).isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func,
}

ChatListItem.defaultProps = {
  isActive: false,
  onClick: () => {},
}

export default ChatListItem
