import PropTypes from 'prop-types'
import { TrashIcon } from '@heroicons/react/24/outline'

function ChatListItem({ room, isActive, onClick, onDelete, isDeleting }) {
  const roomName = room?.nama || 'Ruang tanpa nama'
  const previewMessage = room?.last_message?.content || room?.last_message || room?.pesan_terakhir || room?.tipe || 'Belum ada pesan'
  const isDraft = String(room?.id || '').startsWith('draft-') || room?.isDraft

  return (
    <div
      className={`group mx-2 mb-1 flex w-[calc(100%-16px)] items-center gap-1 rounded-xl px-1.5 py-1 transition-colors ${
        isActive ? 'bg-[#e5e7eb]' : 'bg-transparent hover:bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left"
      >
        <p className="truncate text-sm font-medium text-[#111827]">
          {roomName}
          {isDraft ? <span className="ml-1 text-[11px] text-[#98a2b3]">(draft)</span> : null}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-[#667085]">{previewMessage}</p>
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label="Hapus ruang chat"
        className="rounded-md p-1.5 text-[#98a2b3] transition-colors hover:bg-[#f8fafc] hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60 md:opacity-0 md:group-hover:opacity-100"
        title="Hapus ruang chat"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
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
  onDelete: PropTypes.func,
  isDeleting: PropTypes.bool,
}

ChatListItem.defaultProps = {
  isActive: false,
  onClick: () => {},
  onDelete: () => {},
  isDeleting: false,
}

export default ChatListItem
