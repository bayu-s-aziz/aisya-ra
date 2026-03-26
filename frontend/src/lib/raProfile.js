import api from './api'
import { fetchAuthMeData } from './authMe'

export async function fetchRAProfile(token) {
  const me = await fetchAuthMeData(token)
  return me?.ra_profile || null
}

export async function saveRAProfile(token, payload) {
  await api.patch('/auth/ra-profile', payload, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return payload
}
