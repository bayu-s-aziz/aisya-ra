import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

function ChatInput({ onSend, onSendVoice, disabled }) {
  const [message, setMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = message.trim()
    if (!trimmed || disabled) return

    onSend(trimmed)
    setMessage('')
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())

        if (onSendVoice && audioChunksRef.current.length > 0) {
          onSendVoice(audioBlob)
        }

        audioChunksRef.current = []
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Gagal mengakses mikrofon. Pastikan izin mikrofon telah diberikan.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4 bg-transparent w-full max-w-4xl mx-auto">
      {isRecording ? (
        <div className="mb-3 flex items-center justify-center gap-3 rounded-lg bg-red-50 p-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-red-600"></div>
          <span className="font-medium text-red-900">Merekam: {formatTime(recordingTime)}</span>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-md bg-red-600 px-4 py-1 text-sm text-white hover:bg-red-700"
          >
            Selesai
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2 bg-white rounded-3xl border border-slate-200 shadow-sm px-2 py-2 focus-within:ring-1 focus-within:ring-emerald-500">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`rounded-full p-2 disabled:opacity-50 ${
            isRecording
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          disabled={disabled}
          title={isRecording ? 'Stop recording' : 'Voice note'}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        <button
          type="button"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          disabled={disabled}
          title="Attach file (coming soon)"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <textarea
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent border-none px-2 py-2 focus:outline-none focus:ring-0 disabled:opacity-50"
          placeholder="Ketik pesan..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled || isRecording}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !message.trim() || isRecording}
          className="rounded-full bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

ChatInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  onSendVoice: PropTypes.func,
  disabled: PropTypes.bool,
}

export default ChatInput
