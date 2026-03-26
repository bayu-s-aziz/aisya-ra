import api from './api'

export async function fetchAuthMeData(token) {
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = response?.data?.data || {}
  const authUser = data?.auth_user || {}
  const profile = data?.profile || null

  const normalizedProfile = {
    ...(profile || {}),
    id: profile?.id || authUser?.id || null,
    email: profile?.email || authUser?.email || '',
    nama: profile?.nama || authUser?.email?.split('@')?.[0] || '',
  }

  return {
    ...data,
    profile: normalizedProfile,
    ra_profile: data?.ra_profile || null,
  }
}
