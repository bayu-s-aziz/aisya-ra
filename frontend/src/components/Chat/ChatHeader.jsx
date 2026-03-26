import PropTypes from 'prop-types'
import { MagnifyingGlassIcon, EllipsisVerticalIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

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

function ChatHeader({ room, onBack }) {
  const roomName = room?.nama || 'Pilih ruang chat'
  const roomStatus = room?.status || room?.tipe || 'online'

  return (
    <header className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button
            type="button"
            aria-label="Kembali ke daftar chat"
            onClick={onBack}
            className="mr-1 shrink-0 rounded-full p-1 text-[#475569] transition-colors hover:bg-[#f1f5f9] md:hidden"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        ) : null}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${getAvatarColorSeed(
            roomName,
          )}`}
        >
          {getInitials(roomName)}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#0f172a]">{roomName}</p>
          <p className="truncate text-xs text-[#64748b]">{roomStatus}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[#64748b]">
        <button
          type="button"
          aria-label="Cari di chat"
          className="rounded-full p-2 transition-colors hover:bg-[#f1f5f9]"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Menu chat"
          className="rounded-full p-2 transition-colors hover:bg-[#f1f5f9]"
        >
          <EllipsisVerticalIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}

ChatHeader.propTypes = {
  room: PropTypes.shape({
    nama: PropTypes.string,
    status: PropTypes.string,
    tipe: PropTypes.string,
  }),
  onBack: PropTypes.func,
}

ChatHeader.defaultProps = {
  room: null,
  onBack: null,
}

export default ChatHeader
