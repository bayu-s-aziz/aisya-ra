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

  const handleSend = useCallback(() => {
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
  }, [text, disabled, onSend])

  return (
    <div className="border-t border-[#e5e7eb] bg-white px-4 py-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 rounded-lg border border-[#d1d5db] bg-white px-3 py-2 focus-within:border-[#007aff] focus-within:ring-1 focus-within:ring-[#007aff]">
          <textarea
            ref={textareaRef}
            value={text}
            onInput={handleInput}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder="Message AISYA Assistant..."
            className="w-full resize-none bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9ca3af] disabled:opacity-60"
            style={{ height: 'auto' }}
          />
        </div>

        <button
          type="button"
          aria-label="Kirim pesan"
          onClick={handleSend}
          disabled={disabled || !hasText}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#007aff] text-white transition-colors hover:bg-[#0056cc] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#007aff]"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
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
