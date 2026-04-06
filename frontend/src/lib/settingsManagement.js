import api from './api'

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` })

export async function fetchKelompok(token) {
  const response = await api.get('/kelompok', { headers: authHeaders(token) })
  return response?.data?.data || []
}

export async function fetchSiswa(token, kelompokId) {
  const response = await api.get('/siswa', {
    headers: authHeaders(token),
    params: kelompokId ? { kelompok_id: kelompokId } : undefined,
  })
  return response?.data?.data || []
}

export async function createSiswa(token, payload) {
  const response = await api.post('/siswa', payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function updateSiswa(token, siswaId, payload) {
  const response = await api.put(`/siswa/${siswaId}`, payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function deactivateSiswa(token, siswaId) {
  const response = await api.delete(`/siswa/${siswaId}`, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function importSiswaFromFile(token, file, kelompokId) {
  const formData = new FormData()
  formData.append('file', file)

  const query = kelompokId ? `?kelompok_id=${encodeURIComponent(kelompokId)}` : ''
  const response = await api.post(`/siswa/import${query}`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  })
  return response?.data
}

export async function createKelompok(token, payload) {
  const response = await api.post('/kelompok', payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function updateKelompok(token, kelompokId, payload) {
  const response = await api.put(`/kelompok/${kelompokId}`, payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function deleteKelompok(token, kelompokId) {
  const response = await api.delete(`/kelompok/${kelompokId}`, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function fetchManagedUsers(token) {
  const response = await api.get('/auth/users', { headers: authHeaders(token) })
  return response?.data?.data || []
}

export async function createManagedUser(token, payload) {
  const response = await api.post('/auth/users', payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function updateManagedUser(token, userId, payload) {
  const response = await api.put(`/auth/users/${userId}`, payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function deleteManagedUser(token, userId) {
  const response = await api.delete(`/auth/users/${userId}`, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function importGuruFromGtkFile(token, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/auth/users/import-gtk', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  })
  return response?.data
}

export async function fetchPresensiRekap(token, kelompokId, tanggal) {
  const response = await api.get('/presensi/rekap', {
    headers: authHeaders(token),
    params: {
      kelompok_id: kelompokId,
      tanggal,
    },
  })
  return response?.data
}

export async function savePresensiBatch(token, payload) {
  const response = await api.post('/presensi/batch', payload, {
    headers: authHeaders(token),
  })
  return response?.data
}

export async function fetchAcademicYears(token) {
  const response = await api.get('/tahun-ajaran', { headers: authHeaders(token) })
  return {
    data: response?.data?.data || [],
    activeId: response?.data?.active_id || null,
  }
}

export async function createAcademicYear(token, payload) {
  const response = await api.post('/tahun-ajaran', payload, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function activateAcademicYear(token, tahunAjaranId) {
  const response = await api.patch(`/tahun-ajaran/${tahunAjaranId}/activate`, {}, { headers: authHeaders(token) })
  return response?.data?.data
}

export async function deleteAcademicYear(token, tahunAjaranId) {
  const response = await api.delete(`/tahun-ajaran/${tahunAjaranId}`, { headers: authHeaders(token) })
  return response?.data
}
