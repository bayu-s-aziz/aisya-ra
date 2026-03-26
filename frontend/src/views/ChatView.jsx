import PropTypes from 'prop-types'
import ChatRoom from '../components/Chat/ChatRoom'

function ChatView({ roomId, onOpenSidebar }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-white">
      <ChatRoom roomId={roomId} onOpenSidebar={onOpenSidebar} />
    </div>
  )
}

ChatView.propTypes = {
  roomId: PropTypes.string,
  onOpenSidebar: PropTypes.func.isRequired,
}

ChatView.defaultProps = {
  roomId: '',
}

export default ChatView
