import api from './api'

/**
 * Record GTK attendance
 * @param {Object} data - { pengguna_id, tanggal, status, jam_masuk, jam_keluar, keterangan, sumber_pencatatan }
 */
export const recordGTKPresence = async (data) => {
  const response = await api.post('/presensi-gtk/record', data)
  return response.data
}

/**
 * Fetch current user's attendance history
 */
export const fetchMyPresenceHistory = async () => {
  const response = await api.get('/presensi-gtk/me')
  return response.data
}

/**
 * Fetch all GTK attendance rekap (Admin/Kepala only)
 * @param {string} date - ISO date string
 */
export const fetchRekapPresensiGTK = async (date) => {
  const response = await api.get('/presensi-gtk/rekap', {
    params: { tanggal: date }
  })
  return response.data
}
