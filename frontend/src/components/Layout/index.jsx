import { useState } from 'react'
import PropTypes from 'prop-types'
import ChatList from '../Sidebar/ChatList'

function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden">
      <aside
        className={`${isSidebarOpen ? 'flex' : 'hidden'} w-full flex-col bg-white md:flex md:w-[30%]`}
      >
        <div className="flex-1 overflow-hidden">
          <ChatList onSelectRoom={() => setIsSidebarOpen(false)} />
        </div>
        <button
          type="button"
          className="m-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          Buka Konten
        </button>
      </aside>

      <main
        className={`${isSidebarOpen ? 'hidden' : 'flex'} w-full flex-col bg-[#f0f2f5] md:flex md:w-[70%]`}
      >
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Buka sidebar"
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="text-sm font-medium text-slate-900">Konten</span>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node,
}

export default Layout
