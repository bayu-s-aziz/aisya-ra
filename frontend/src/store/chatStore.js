import { create } from 'zustand'
import api from '../lib/api'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const ROOM_FETCH_LIMIT = 100
let activeRoomChannel = null
const DRAFT_ROOM_PREFIX = 'draft-'

function authHeader() {
  const token = localStorage.getItem('aisya_access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function normalizeMessage(row) {
  if (!row) return null

  return {
    id: String(row.id || crypto.randomUUID()),
    room_id: row.room_id || row.roomId || '',
    role_msg: row.role_msg || row.role || 'assistant',
    content: row.content || row.message || '',
    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    media_type: row.media_type || null,
    media_url: row.media_url || null,
  }
}

function uniqueById(messages) {
  const map = new Map()
  messages.forEach((message) => {
    if (message?.id) {
      map.set(message.id, message)
    }
  })
  return Array.from(map.values())
}

function upsertRoomPreview(rooms, message) {
  if (!message?.room_id) return rooms

  const index = rooms.findIndex((room) => room.id === message.room_id)
  if (index < 0) return rooms

  const updated = {
    ...rooms[index],
    last_message: message,
    updated_at: message.timestamp,
  }

  const next = [...rooms]
  next.splice(index, 1)
  return [updated, ...next]
}

function isDraftRoomId(roomId) {
  return String(roomId || '').startsWith(DRAFT_ROOM_PREFIX)
}

function createDraftRoomName() {
  return `Percakapan ${new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())}`
}

async function persistDraftRoom(draftRoom) {
  const nama = String(draftRoom?.nama || '').trim() || createDraftRoomName()
  const tipe = draftRoom?.tipe || 'custom'
  const response = await api.post(
    '/chat/rooms',
    { nama, tipe },
    { headers: authHeader() },
  )
  return response?.data?.data || null
}

export const useChatStore = create((set, get) => ({
  rooms: [],
  roomsLoading: false,
  roomsError: '',

  selectedRoomId: '',
  selectedRoom: null,

  incomingMessages: [],
  sending: false,
  sendError: '',

  realtimeConnected: false,
  realtimeError: '',

  setSelectedRoom: (room) => {
    const previousSelectedRoomId = get().selectedRoomId
    set({
      selectedRoomId: room?.id || '',
      selectedRoom: room,
      incomingMessages: [],
      sendError: '',
      rooms: isDraftRoomId(previousSelectedRoomId) && previousSelectedRoomId !== room?.id
        ? get().rooms.filter((item) => item.id !== previousSelectedRoomId)
        : get().rooms,
    })
  },

  setSelectedRoomId: (roomId) => {
    const targetRoomId = roomId || ''
    const previousSelectedRoomId = get().selectedRoomId
    const room = get().rooms.find((item) => item.id === targetRoomId) || null
    set({
      selectedRoomId: targetRoomId,
      selectedRoom: room,
      incomingMessages: [],
      sendError: '',
      rooms: isDraftRoomId(previousSelectedRoomId) && previousSelectedRoomId !== targetRoomId
        ? get().rooms.filter((item) => item.id !== previousSelectedRoomId)
        : get().rooms,
    })
  },

  prependRoom: (room) => {
    if (!room?.id) return

    set((state) => {
      const nextRooms = [room, ...state.rooms.filter((item) => item.id !== room.id)]
      return {
        rooms: nextRooms,
      }
    })
  },

  createDraftRoom: () => {
    const draftRoomId = `${DRAFT_ROOM_PREFIX}${Date.now()}`
    const draftRoom = {
      id: draftRoomId,
      ra_id: '',
      tipe: 'custom',
      nama: createDraftRoomName(),
      isDraft: true,
      created_at: new Date().toISOString(),
    }

    set((state) => ({
      rooms: [
        draftRoom,
        ...state.rooms.filter((item) => !isDraftRoomId(item.id)),
      ],
      selectedRoomId: draftRoomId,
      selectedRoom: draftRoom,
      incomingMessages: [],
      sendError: '',
    }))
  },

  deleteRoom: async (roomId) => {
    if (!roomId) return { ok: false, error: 'Room tidak valid' }

    const currentRooms = get().rooms
    const fallbackRoom = currentRooms.find((item) => item.id !== roomId) || null

    if (isDraftRoomId(roomId)) {
      set((state) => ({
        rooms: state.rooms.filter((item) => item.id !== roomId),
        selectedRoomId: state.selectedRoomId === roomId ? (fallbackRoom?.id || '') : state.selectedRoomId,
        selectedRoom: state.selectedRoomId === roomId ? fallbackRoom : state.selectedRoom,
        incomingMessages: state.selectedRoomId === roomId ? [] : state.incomingMessages,
      }))
      return { ok: true }
    }

    try {
      await api.delete(`/chat/rooms/${roomId}`, { headers: authHeader() })

      set((state) => ({
        rooms: state.rooms.filter((item) => item.id !== roomId),
        selectedRoomId: state.selectedRoomId === roomId ? (fallbackRoom?.id || '') : state.selectedRoomId,
        selectedRoom: state.selectedRoomId === roomId ? fallbackRoom : state.selectedRoom,
        incomingMessages: state.selectedRoomId === roomId ? [] : state.incomingMessages,
      }))

      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error: err?.response?.data?.detail || 'Gagal menghapus ruang chat',
      }
    }
  },

  refreshRooms: async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      set({ rooms: [], roomsLoading: false, roomsError: '' })
      return
    }

    set({ roomsLoading: true, roomsError: '' })

    try {
      const response = await api.get('/chat/rooms', {
        headers: authHeader(),
        params: { limit: ROOM_FETCH_LIMIT },
      })

      const fetchedRooms = Array.isArray(response?.data?.data) ? response.data.data : []
      const selectedRoomId = get().selectedRoomId || get().selectedRoom?.id

      const selectedFromFetch = selectedRoomId
        ? fetchedRooms.find((room) => room.id === selectedRoomId) || null
        : null

      set({
        rooms: fetchedRooms,
        selectedRoomId: selectedFromFetch?.id || fetchedRooms[0]?.id || '',
        selectedRoom: selectedFromFetch || fetchedRooms[0] || null,
        roomsLoading: false,
      })
    } catch (err) {
      set({
        roomsLoading: false,
        roomsError: err?.response?.data?.detail || 'Gagal memuat daftar room',
      })
    }
  },

  pushIncomingMessages: (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return

    const selectedRoomId = get().selectedRoom?.id
    const normalized = messages
      .map((message) => normalizeMessage(message))
      .filter((message) => message && (!selectedRoomId || message.room_id === selectedRoomId || !message.room_id))

    if (normalized.length === 0) return

    set((state) => ({
      incomingMessages: uniqueById([...state.incomingMessages, ...normalized]).slice(-100),
      rooms: upsertRoomPreview(state.rooms, normalized[normalized.length - 1]),
    }))
  },

  sendMessage: async (content) => {
    const trimmedContent = content?.trim()
    if (!trimmedContent) return

    let selectedRoomId = get().selectedRoomId || get().selectedRoom?.id
    const selectedRoom = get().selectedRoom
    if (!selectedRoomId) return

    set({ sending: true, sendError: '' })

    try {
      if (isDraftRoomId(selectedRoomId) || selectedRoom?.isDraft) {
        const persistedRoom = await persistDraftRoom(selectedRoom)
        if (!persistedRoom?.id) {
          throw new Error('Gagal membuat ruang chat baru')
        }

        set((state) => ({
          rooms: [
            persistedRoom,
            ...state.rooms.filter((item) => item.id !== selectedRoomId),
          ],
          selectedRoomId: persistedRoom.id,
          selectedRoom: persistedRoom,
        }))

        selectedRoomId = persistedRoom.id
      }

      const response = await api.post(
        `/chat/rooms/${selectedRoomId}/messages`,
        { content: trimmedContent },
        { headers: authHeader() },
      )

      const { user_message, bot_message } = response?.data?.data || {}
      const batch = [user_message, bot_message].filter(Boolean)

      get().pushIncomingMessages(batch)
    } catch (err) {
      set({ sendError: err?.response?.data?.detail || 'Gagal mengirim pesan' })
    } finally {
      set({ sending: false })
    }
  },

  sendVoice: async (audioBlob) => {
    let selectedRoomId = get().selectedRoomId || get().selectedRoom?.id
    const selectedRoom = get().selectedRoom
    if (!selectedRoomId || !audioBlob) return

    set({ sending: true, sendError: '' })

    try {
      if (isDraftRoomId(selectedRoomId) || selectedRoom?.isDraft) {
        const persistedRoom = await persistDraftRoom(selectedRoom)
        if (!persistedRoom?.id) {
          throw new Error('Gagal membuat ruang chat baru')
        }

        set((state) => ({
          rooms: [
            persistedRoom,
            ...state.rooms.filter((item) => item.id !== selectedRoomId),
          ],
          selectedRoomId: persistedRoom.id,
          selectedRoom: persistedRoom,
        }))

        selectedRoomId = persistedRoom.id
      }

      const formData = new FormData()
      formData.append('file', audioBlob, 'voice.webm')

      const response = await api.post(`/chat/voice?room_id=${selectedRoomId}`, formData, {
        headers: {
          ...authHeader(),
          'Content-Type': 'multipart/form-data',
        },
      })

      const { user_message, bot_message } = response?.data?.data || {}
      const transcription = response?.data?.transcription || ''
      const normalizedUser = user_message
        ? {
            ...user_message,
            content: transcription ? `🎤 ${transcription}` : user_message.content,
          }
        : null

      const batch = [normalizedUser, bot_message].filter(Boolean)
      get().pushIncomingMessages(batch)
    } catch (err) {
      set({ sendError: err?.response?.data?.detail || 'Gagal mengirim pesan suara' })
    } finally {
      set({ sending: false })
    }
  },

  subscribeActiveRoomRealtime: (roomId) => {
    if (activeRoomChannel) {
      supabase?.removeChannel(activeRoomChannel)
      activeRoomChannel = null
    }

    set({ realtimeConnected: false, realtimeError: '' })

    if (!roomId) return () => {}

    if (!isSupabaseConfigured()) {
      set({ realtimeError: 'Supabase realtime belum dikonfigurasi' })
      return () => {}
    }

    activeRoomChannel = supabase
      .channel(`chat-history-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_history',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const message = normalizeMessage(payload?.new)
          if (!message) return
          get().pushIncomingMessages([message])
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          set({ realtimeConnected: true, realtimeError: '' })
          return
        }

        if (status === 'CHANNEL_ERROR') {
          set({ realtimeConnected: false, realtimeError: 'Realtime room gagal terhubung' })
          return
        }

        if (status === 'CLOSED') {
          set({ realtimeConnected: false })
        }
      })

    return () => {
      if (activeRoomChannel) {
        supabase.removeChannel(activeRoomChannel)
        activeRoomChannel = null
      }
      set({ realtimeConnected: false })
    }
  },

  clearSendError: () => set({ sendError: '' }),
}))
