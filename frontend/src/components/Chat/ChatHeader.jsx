import PropTypes from 'prop-types'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

const AVATAR_COLORS = [
  'bg-slate-500',
  'bg-slate-600',
  'bg-zinc-500',
  'bg-gray-600',
  'bg-blue-600',
  'bg-indigo-600',
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

function ChatHeader({ room, onBack, isTyping }) {
  const roomName = room?.nama || 'Pilih ruang chat'
  const roomStatus = isTyping ? 'AISYA sedang mengetik...' : (room?.status || room?.tipe || 'siap membantu')

  return (
    <header className="flex items-center justify-between">
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
  isTyping: PropTypes.bool,
}

ChatHeader.defaultProps = {
  room: null,
  onBack: null,
  isTyping: false,
}

export default ChatHeader
