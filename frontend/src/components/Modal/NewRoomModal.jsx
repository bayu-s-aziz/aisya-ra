import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '../../lib/api'

const TIPE_OPTIONS = [
  { value: 'utama', label: 'Utama' },
  { value: 'rpph', label: 'RPPH' },
  { value: 'anekdot', label: 'Anekdot' },
  { value: 'surat', label: 'Surat' },
  { value: 'presensi', label: 'Presensi' },
  { value: 'dashboard', label: '📊 Dashboard' },
  { value: 'custom', label: 'Custom' },
]

function NewRoomModal({ isOpen, onClose, onRoomCreated }) {
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState('custom')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputRef = useRef(null)

  // Focus input and reset state when modal opens
  useEffect(() => {
    if (!isOpen) return
    setNama('')
    setTipe('custom')
    setError('')
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedNama = nama.trim()
    if (!trimmedNama) {
      setError('Nama ruang tidak boleh kosong')
      return
    }

    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      setError('Anda harus login terlebih dahulu')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post(
        '/chat/rooms',
        { nama: trimmedNama, tipe },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      const newRoom = response?.data?.data
      if (newRoom) {
        onRoomCreated(newRoom)
        onClose()
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal membuat ruang chat')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Buat ruang chat baru"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Panel */}
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f0f2f5] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#111b21]">Ruang Chat Baru</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#8696a0] transition-colors hover:bg-[#f0f2f5] hover:text-[#111b21]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5">
          <div className="mb-4">
            <label htmlFor="room-nama" className="mb-1.5 block text-xs font-medium text-[#667781]">
              Nama Ruang
            </label>
            <input
              id="room-nama"
              ref={inputRef}
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={80}
              placeholder="Contoh: Diskusi RPPH Kelompok A"
              className="w-full rounded-lg border border-[#d1d7db] bg-white px-3 py-2.5 text-sm text-[#111b21] outline-none transition-colors placeholder:text-[#8696a0] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]"
            />
            <p className="mt-1 text-right text-[11px] text-[#8696a0]">{nama.length}/80</p>
          </div>

          <div className="mb-5">
            <label htmlFor="room-tipe" className="mb-1.5 block text-xs font-medium text-[#667781]">
              Tipe Ruang
            </label>
            <select
              id="room-tipe"
              value={tipe}
              onChange={(e) => setTipe(e.target.value)}
              className="w-full rounded-lg border border-[#d1d7db] bg-white px-3 py-2.5 text-sm text-[#111b21] outline-none transition-colors focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]"
            >
              {TIPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#54656f] transition-colors hover:bg-[#f0f2f5]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !nama.trim()}
              className="rounded-full bg-[#00a884] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#017c63] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Membuat...' : 'Buat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

NewRoomModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  /** Called with the newly created room object on success */
  onRoomCreated: PropTypes.func.isRequired,
}

export default NewRoomModal
