import { useEffect, useState } from 'react'
import ChatList from '../components/Sidebar/ChatList'
import ChatHeader from '../components/Chat/ChatHeader'
import MessageList from '../components/Chat/MessageList'
import ChatInput from '../components/Chat/ChatInput'
import { useChatStore } from '../store/chatStore'

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#f0f2f5]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dfe5e7]">
        <svg
          viewBox="0 0 24 24"
          className="h-10 w-10 text-[#8696a0]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[17px] font-light text-[#41525d]">AISYA</p>
        <p className="mt-1 text-sm text-[#667781]">Pilih ruang untuk memulai percakapan</p>
      </div>
    </div>
  )
}

function MainPage() {
  const selectedRoom = useChatStore((state) => state.selectedRoom)
  const incomingMessages = useChatStore((state) => state.incomingMessages)
  const sending = useChatStore((state) => state.sending)
  const sendError = useChatStore((state) => state.sendError)
  const realtimeError = useChatStore((state) => state.realtimeError)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const sendVoice = useChatStore((state) => state.sendVoice)
  const subscribeActiveRoomRealtime = useChatStore((state) => state.subscribeActiveRoomRealtime)

  // On mobile the sidebar starts visible (no room selected); on md+ it's always shown via CSS.
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeActiveRoomRealtime(selectedRoom?.id)
    return () => {
      unsubscribe?.()
    }
  }, [selectedRoom?.id, subscribeActiveRoomRealtime])

  useEffect(() => {
    if (!selectedRoom) {
      setIsSidebarOpen(true)
    } else {
      setIsSidebarOpen(false)
    }
  }, [selectedRoom])

  const handleAttach = (file) => {
    // TODO: implement file/image upload endpoint
    console.info('File terpilih:', file?.name)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* ── Sidebar overlay backdrop (mobile only) ── */}
      {isSidebarOpen && selectedRoom ? (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* ── Sidebar ── */}
      <aside
        className={[
          'flex flex-col border-r border-[#d1d7db] bg-white transition-transform duration-200',
          // Mobile: full-width slide-in drawer-style; desktop: always visible fixed 30%
          'fixed inset-y-0 left-0 z-30 w-full',
          'md:static md:z-auto md:w-[30%]',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <ChatList />
      </aside>

      {/* ── Content area ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {selectedRoom ? (
          <>
            <ChatHeader
              room={selectedRoom}
              onBack={() => setIsSidebarOpen(true)}
            />

            <div className="flex-1 overflow-hidden">
              <MessageList
                roomId={selectedRoom.id}
                incomingMessages={incomingMessages}
                isBotTyping={sending}
              />
            </div>

            {sendError ? (
              <div className="bg-red-50 px-4 py-2 text-xs text-red-700">{sendError}</div>
            ) : null}

            {realtimeError ? (
              <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700">{realtimeError}</div>
            ) : null}

            <ChatInput
              onSend={sendMessage}
              onSendVoice={sendVoice}
              onAttach={handleAttach}
              disabled={sending}
            />
          </>
        ) : (
          // On mobile: show a prompt to open the sidebar
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f0f2f5]">
            <EmptyState />
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-full bg-[#00a884] px-5 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-[#017c63] md:hidden"
            >
              Pilih Ruang Chat
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default MainPage
