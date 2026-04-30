import PropTypes from 'prop-types'

function ChatBubble({ isUser, text, timestamp }) {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-2 shadow-sm ${
            isUser
              ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
              : 'bg-white text-slate-900 rounded-tl-none'
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
        </div>
        {formattedTime ? (
          <p className={`mt-1 text-xs text-slate-500 ${isUser ? 'text-right' : 'text-left'}`}>
            {formattedTime}
          </p>
        ) : null}
      </div>
    </div>
  )
}

ChatBubble.propTypes = {
  isUser: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
}

export default ChatBubble
