import { useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import ChatBubble from '../components/ChatBubble'
import ChatInput from '../components/ChatInput'

// LLM-first intent routing is now handled entirely by the backend

function todayDateValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toText(value, fallback = '') {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join('\n')
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2)
  return fallback
}

function normalizeGeneratedRpph(generated) {
  const kegiatan = generated?.langkah_kegiatan || generated?.kegiatan || {}
  return {
    tujuan: toText(generated?.tujuan),
    materi: toText(generated?.materi),
    media: toText(generated?.media),
    pembukaan: toText(kegiatan?.pembukaan),
    inti: toText(kegiatan?.inti),
    penutup: toText(kegiatan?.penutup),
    asesmen: toText(generated?.asesmen),
    refleksi: toText(generated?.refleksi),
  }
}

function buildKontenJsonFromDraft(draft) {
  return {
    identitas: {
      tema: draft.tema,
      subtema: draft.subtema,
      kelompok_id: draft.kelompok_id,
      tanggal: draft.tanggal,
    },
    tujuan: draft.tujuan,
    materi: draft.materi,
    media: draft.media,
    langkah_kegiatan: {
      pembukaan: draft.pembukaan,
      inti: draft.inti,
      penutup: draft.penutup,
    },
    asesmen: draft.asesmen,
    refleksi: draft.refleksi,
  }
}

function ChatPage() {
  const [rooms, setRooms] = useState([])
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [messages, setMessages] = useState([])
  const [kelompokOptions, setKelompokOptions] = useState([])
  const [generatingRpph, setGeneratingRpph] = useState(false)
  const [savingRpph, setSavingRpph] = useState(false)
  const [rpphDraft, setRpphDraft] = useState(null)
  const [rpphError, setRpphError] = useState('')
  const [rpphSuccess, setRpphSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const messagesEndRef = useRef(null)
  const messageContainerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      setError('Anda harus login terlebih dahulu')
      return
    }

    const fetchRooms = async () => {
      try {
        const response = await api.get('/chat/rooms', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const roomsData = response?.data?.data || []
        setRooms(roomsData)
        if (roomsData.length > 0 && !activeRoomId) {
          setActiveRoomId(roomsData[0].id)
        }
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat ruang chat')
      }
    }

    fetchRooms()
  }, [activeRoomId])

  useEffect(() => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchKelompok = async () => {
      try {
        const response = await api.get('/kelompok', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setKelompokOptions(response?.data?.data || [])
      } catch {
        setKelompokOptions([])
      }
    }

    fetchKelompok()
  }, [])

  useEffect(() => {
    if (!activeRoomId) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    const fetchMessages = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/chat/rooms/${activeRoomId}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            page: 1,
            limit: 100,
          },
        })
        setMessages(response?.data?.data || [])
      } catch (err) {
        setError(err?.response?.data?.detail || 'Gagal memuat pesan')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [activeRoomId])

  const handleSendMessage = async (content) => {
    if (!activeRoomId || !content.trim()) return

    // Intent is now handled centrally by the backend via LLM.

    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      setError('Anda harus login terlebih dahulu')
      return
    }

    setSending(true)
    setError('')

    try {
      const response = await api.post(
        `/chat/rooms/${activeRoomId}/messages`,
        { content },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const { user_message, bot_message } = response?.data?.data || {}
      if (user_message) {
        setMessages((prev) => [...prev, user_message])
      }
      if (bot_message) {
        setMessages((prev) => [...prev, bot_message])
        
        if (bot_message.intent?.trim().toLowerCase() === 'buat_rpph') {
          // Trigger RPPH generation UI based on backend AI's parsed parameters
          await generateRpphFromParams(bot_message.parameters || {})
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal mengirim pesan')
    } finally {
      setSending(false)
    }
  }

  const generateRpphFromParams = async (params) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setGeneratingRpph(true)
    setRpphError('')
    setRpphSuccess('')

    const fallbackKelompok = kelompokOptions[0]
    const kelompokName = params.kelompok || fallbackKelompok?.nama_kelompok || 'Kelompok A'

    try {
      const response = await api.post(
        '/rpph/generate',
        {
          tema: params.tema || 'Tema Umum',
          subtema: params.subtema || 'Subtema Umum',
          kelompok: kelompokName,
          hari: params.hari || 'Senin',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const generated = response?.data?.data || {}
      const normalized = normalizeGeneratedRpph(generated)
      setRpphDraft({
        tema: params.tema || 'Tema Umum',
        subtema: params.subtema || 'Subtema Umum',
        tanggal: todayDateValue(),
        kelompok_id: fallbackKelompok?.id || '',
        ...normalized,
      })

    } catch (err) {
      setRpphError(err?.response?.data?.detail || 'Gagal generate RPPH')
    } finally {
      setGeneratingRpph(false)
    }
  }

  const handleSaveRpph = async () => {
    if (!rpphDraft) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      setError('Anda harus login terlebih dahulu')
      return
    }

    if (!rpphDraft.kelompok_id) {
      setRpphError('Pilih kelompok terlebih dahulu')
      return
    }

    const parsedKonten = buildKontenJsonFromDraft(rpphDraft)

    setSavingRpph(true)
    setRpphError('')
    setRpphSuccess('')

    try {
      await api.post(
        '/rpph',
        {
          kelompok_id: rpphDraft.kelompok_id,
          tanggal: rpphDraft.tanggal,
          tema: rpphDraft.tema,
          subtema: rpphDraft.subtema,
          konten_json: parsedKonten,
          pdf_url: null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setRpphSuccess('RPPH berhasil disimpan')
      setRpphDraft(null)
    } catch (err) {
      setRpphError(err?.response?.data?.detail || 'Gagal menyimpan RPPH')
    } finally {
      setSavingRpph(false)
    }
  }

  const handleSendVoice = async (audioBlob) => {
    if (!activeRoomId || !audioBlob) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      setError('Anda harus login terlebih dahulu')
      return
    }

    setSending(true)
    setError('')

    // Create temporary message
    const tempId = `temp-${Date.now()}`
    const tempMessage = {
      id: tempId,
      role_msg: 'user',
      content: '🎤 Mengirim suara...',
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMessage])

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'voice.webm')

      const response = await api.post(`/chat/voice?room_id=${activeRoomId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      const { user_message, bot_message } = response?.data?.data || {}
      const transcription = response?.data?.transcription || ''

      // Remove temp message
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))

      // Add actual messages
      if (user_message) {
        setMessages((prev) => [
          ...prev,
          {
            ...user_message,
            content: transcription ? `🎤 ${transcription}` : user_message.content,
          },
        ])
      }
      if (bot_message) {
        setMessages((prev) => [...prev, bot_message])
        
        if (bot_message.intent?.trim().toLowerCase() === 'buat_rpph') {
          await generateRpphFromParams(bot_message.parameters || {})
        }
      }
    } catch (err) {
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      setError(err?.response?.data?.detail || 'Gagal mengirim voice message')
    } finally {
      setSending(false)
    }
  }

  const activeRoom = rooms.find((r) => r.id === activeRoomId)

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="border-b border-slate-200 bg-slate-100 p-4">
          <h2 className="text-lg font-semibold text-slate-900">Ruang Chat</h2>
        </div>
        <div className="overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                activeRoomId === room.id ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <p className="font-medium">{room.nama}</p>
              <p className="text-xs text-slate-500">{room.tipe}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-100 px-6 py-4 flex items-center">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{activeRoom?.nama || 'Pilih Ruang Chat'}</h1>
            {activeRoom ? <p className="text-sm text-slate-500">{activeRoom.tipe}</p> : null}
          </div>
        </div>

        {/* Messages */}
        <div ref={messageContainerRef} className="flex-1 overflow-y-auto px-6 py-4 bg-[#efeae2]">
          {error ? <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-slate-500">Memuat pesan...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-slate-500">Belum ada pesan. Mulai percakapan!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble key={msg.id} isUser={msg.role_msg === 'user'} text={msg.content} timestamp={msg.timestamp} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeRoomId ? <ChatInput onSend={handleSendMessage} onSendVoice={handleSendVoice} disabled={sending || loading || generatingRpph || savingRpph} /> : null}
      </div>

      {/* RPPH Preview Panel */}
      <div className="w-[420px] border-l border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Preview RPPH</h2>
        <p className="mt-1 text-xs text-slate-500">Kirim perintah seperti: buat RPPH tema diri sendiri subtema anggota tubuh</p>

        {rpphError ? <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{rpphError}</div> : null}
        {rpphSuccess ? <div className="mt-3 rounded-md bg-emerald-50 p-2 text-sm text-emerald-700">{rpphSuccess}</div> : null}

        {!rpphDraft ? (
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Belum ada draft. Gunakan perintah chat untuk generate RPPH.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={rpphDraft.tema}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, tema: event.target.value }))}
              placeholder="Tema"
            />

            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={rpphDraft.subtema}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, subtema: event.target.value }))}
              placeholder="Subtema"
            />

            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={rpphDraft.tanggal}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, tanggal: event.target.value }))}
            />

            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={rpphDraft.kelompok_id}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, kelompok_id: event.target.value }))}
            >
              <option value="">Pilih Kelompok</option>
              {kelompokOptions.map((kelompok) => (
                <option key={kelompok.id} value={kelompok.id}>
                  {kelompok.nama_kelompok}
                </option>
              ))}
            </select>

            <textarea
              className="h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.tujuan}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, tujuan: event.target.value }))}
              placeholder="Tujuan pembelajaran"
            />

            <textarea
              className="h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.materi}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, materi: event.target.value }))}
              placeholder="Materi"
            />

            <textarea
              className="h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.media}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, media: event.target.value }))}
              placeholder="Media"
            />

            <textarea
              className="h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.pembukaan}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, pembukaan: event.target.value }))}
              placeholder="Kegiatan pembukaan"
            />

            <textarea
              className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.inti}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, inti: event.target.value }))}
              placeholder="Kegiatan inti"
            />

            <textarea
              className="h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.penutup}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, penutup: event.target.value }))}
              placeholder="Kegiatan penutup"
            />

            <textarea
              className="h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.asesmen}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, asesmen: event.target.value }))}
              placeholder="Asesmen"
            />

            <textarea
              className="h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={rpphDraft.refleksi}
              onChange={(event) => setRpphDraft((prev) => ({ ...prev, refleksi: event.target.value }))}
              placeholder="Refleksi"
            />

            <button
              type="button"
              onClick={handleSaveRpph}
              disabled={savingRpph}
              className="w-full rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingRpph ? 'Menyimpan...' : 'Simpan RPPH'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatPage
