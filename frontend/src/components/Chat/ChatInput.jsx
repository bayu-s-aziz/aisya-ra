import { useCallback, useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'

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
    <div className="border-t border-[#e4e7ec] bg-white/95 px-3 py-3 backdrop-blur md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-[28px] border border-[#dbe0e6] bg-white p-2 shadow-sm transition-colors focus-within:border-[#98a2b3]">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 px-2 py-1">
              <textarea
                ref={textareaRef}
                value={text}
                onInput={handleInput}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                rows={1}
                placeholder="Tanyakan apa saja ke AISYA"
                className="w-full resize-none bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8] disabled:opacity-60"
                style={{ height: 'auto' }}
              />
            </div>

            <button
              type="button"
              aria-label="Kirim pesan"
              onClick={handleSend}
              disabled={disabled || !hasText}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827] text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 px-2 text-xs text-[#98a2b3]">Enter untuk kirim, Shift+Enter untuk baris baru.</p>
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
