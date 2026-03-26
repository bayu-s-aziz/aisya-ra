import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import PropTypes from 'prop-types'
import api from '../lib/api'

const AppContext = createContext(null)

const initialState = {
  selectedTab: 'chat',
  selectedRoomId: null,
  selectedDocId: null,
  rooms: [],
  documents: [],
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SELECTED_TAB':
      return { ...state, selectedTab: action.payload }
    case 'SET_SELECTED_ROOM_ID':
      return { ...state, selectedRoomId: action.payload }
    case 'SET_SELECTED_DOC_ID':
      return { ...state, selectedDocId: action.payload }
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload }
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setSelectedTab = useCallback((tab) => {
    dispatch({ type: 'SET_SELECTED_TAB', payload: tab })
  }, [])

  const setSelectedRoomId = useCallback((roomId) => {
    dispatch({ type: 'SET_SELECTED_ROOM_ID', payload: roomId || null })
  }, [])

  const setSelectedDocId = useCallback((docId) => {
    dispatch({ type: 'SET_SELECTED_DOC_ID', payload: docId || null })
  }, [])

  const setRooms = useCallback((rooms) => {
    dispatch({ type: 'SET_ROOMS', payload: Array.isArray(rooms) ? rooms : [] })
  }, [])

  const setDocuments = useCallback((documents) => {
    dispatch({ type: 'SET_DOCUMENTS', payload: Array.isArray(documents) ? documents : [] })
  }, [])

  const refreshRooms = useCallback(async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      dispatch({ type: 'SET_ROOMS', payload: [] })
      return []
    }

    const response = await api.get('/chat/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const rooms = Array.isArray(response?.data?.data) ? response.data.data : []
    dispatch({ type: 'SET_ROOMS', payload: rooms })
    return rooms
  }, [])

  const refreshDocuments = useCallback(async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) {
      dispatch({ type: 'SET_DOCUMENTS', payload: [] })
      return []
    }

    const response = await api.get('/knowledge/documents', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const documents = Array.isArray(response?.data) ? response.data : []
    dispatch({ type: 'SET_DOCUMENTS', payload: documents })
    return documents
  }, [])

  const value = useMemo(() => ({
    selectedTab: state.selectedTab,
    selectedRoomId: state.selectedRoomId,
    selectedDocId: state.selectedDocId,
    rooms: state.rooms,
    documents: state.documents,
    setSelectedTab,
    setSelectedRoomId,
    setSelectedDocId,
    setRooms,
    setDocuments,
    refreshRooms,
    refreshDocuments,
  }), [
    state.selectedTab,
    state.selectedRoomId,
    state.selectedDocId,
    state.rooms,
    state.documents,
    setSelectedTab,
    setSelectedRoomId,
    setSelectedDocId,
    setRooms,
    setDocuments,
    refreshRooms,
    refreshDocuments,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
