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
      <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0f172a]">Ruang Chat Baru</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-5">
          <div className="mb-4">
            <label htmlFor="room-nama" className="mb-1.5 block text-xs font-medium text-[#64748b]">
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
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
            />
            <p className="mt-1 text-right text-[11px] text-[#94a3b8]">{nama.length}/80</p>
          </div>

          <div className="mb-5">
            <label htmlFor="room-tipe" className="mb-1.5 block text-xs font-medium text-[#64748b]">
              Tipe Ruang
            </label>
            <select
              id="room-tipe"
              value={tipe}
              onChange={(e) => setTipe(e.target.value)}
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
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
              className="rounded-full px-4 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#f1f5f9]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !nama.trim()}
              className="rounded-full bg-[#0f172a] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60"
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
