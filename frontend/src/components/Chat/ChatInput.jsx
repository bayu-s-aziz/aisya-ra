import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')

  const textareaRef = useRef(null)

  const hasText = text.trim().length > 0

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [text, adjustHeight])

  const handleInput = (event) => {
    setText(event.target.value)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
  }

  return (
    <div className="px-3 py-3 backdrop-blur bg-white/70 md:px-6 md:py-4 border-t border-[#e2e8f0]">
      <div className="mx-auto w-full max-w-4xl flex flex-col gap-2">
        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 pb-1">
          {['/absensi', '/surat', '/rpph', '/rekap'].map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                setText(cmd + ' ')
                textareaRef.current?.focus()
              }}
              className="whitespace-nowrap rounded-full border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#475467] transition-colors hover:bg-[#f8fafc] hover:text-[#0f172a] shadow-sm active:scale-95"
            >
              {cmd}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#d0d5dd] bg-white p-2 shadow-sm transition-all focus-within:border-[#94a3b8] focus-within:ring-2 focus-within:ring-[#f1f5f9]">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 px-3 py-2">
              <textarea
                name="chat-input"
                ref={textareaRef}
                value={text}
                onInput={handleInput}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                rows={1}
                placeholder={disabled ? 'AISYA sedang menyiapkan jawaban...' : 'Ketik instruksi atau perintah administratif...'}
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#0f172a] outline-none placeholder:text-[#94a3b8] disabled:opacity-70"
                style={{ height: 'auto', maxHeight: '160px' }}
              />
            </div>

            <button
              type="button"
              aria-label="Kirim pesan"
              onClick={handleSend}
              disabled={disabled || !hasText}
              className="mb-1 mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#0f172a] text-white transition-all hover:bg-[#1e293b] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-2 text-[11px] text-[#98a2b3]">
          <p>Ketik pesan untuk bicara dengan AISYA-RA.</p>
          <p>{text.length}/4000</p>
        </div>
      </div>
    </div>
  )
}

ChatInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

ChatInput.defaultProps = {
  disabled: false,
}

export default ChatInput
