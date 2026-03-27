import PropTypes from 'prop-types'

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getImageUrlFromMessage(message) {
  if (message?.media_type?.startsWith('image/') && message?.media_url) {
    return message.media_url
  }

  if (typeof message?.content === 'string') {
    const directImageRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg))/i
    const matched = message.content.match(directImageRegex)
    if (matched?.[1]) return matched[1]
  }

  return null
}

/**
 * Converts **bold** and *bold* markdown within a single text line
 * into React <strong> elements, returning an array of strings + elements.
 */
function renderInline(line, lineKey) {
  const parts = []
  // Match **text** first, then *text*
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index))
    }
    const boldText = match[1] ?? match[2]
    parts.push(<strong key={`${lineKey}-${match.index}`}>{boldText}</strong>)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex))
  }

  return parts
}

/**
 * Renders text content with newline preservation and basic *bold* support.
 */
function RichText({ text }) {
  if (!text) return null

  const lines = text.split('\n')
  return (
    <span className="whitespace-pre-wrap break-words">
      {lines.map((line, idx) => (
        <span key={idx} className="block leading-[1.45]">
          {renderInline(line, idx)}
          {idx < lines.length - 1 ? null : null}
        </span>
      ))}
    </span>
  )
}

function MessageBubble({ message }) {
  const isUser = message?.role_msg === 'user'
  const timeLabel = formatTime(message?.timestamp)
  const imageUrl = getImageUrlFromMessage(message)

  return (
    <div className={`message-enter mb-5 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] min-w-0 text-sm md:max-w-[85%] ${
          isUser
            ? 'overflow-hidden rounded-2xl bg-[#111827] px-4 py-3 text-white shadow-sm'
            : 'px-0 py-1 text-[#101828]'
        }`}
      >
        {!isUser ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">AISYA</p> : null}

        {imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer" className="mb-2 block">
            <img
              src={imageUrl}
              alt="Media pesan"
              className="max-h-72 w-full rounded-md object-cover"
              loading="lazy"
            />
          </a>
        ) : null}

        <div>
          <RichText text={message?.content || ''} />
        </div>

        {timeLabel ? (
          <p className={`mt-2 text-[11px] leading-none ${isUser ? 'text-right text-slate-300' : 'text-left text-[#98a2b3]'}`}>
            {timeLabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}

MessageBubble.propTypes = {
  message: PropTypes.shape({
    role_msg: PropTypes.string,
    content: PropTypes.string,
    timestamp: PropTypes.string,
    media_type: PropTypes.string,
    media_url: PropTypes.string,
  }).isRequired,
}

export default MessageBubble
