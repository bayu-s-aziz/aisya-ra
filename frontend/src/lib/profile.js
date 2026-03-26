import api from './api'
import { supabase } from './supabase'

async function ensureSupabaseSession() {
  if (!supabase) return false

  const accessToken = localStorage.getItem('aisya_access_token')
  const refreshToken = localStorage.getItem('aisya_refresh_token')
  if (!accessToken || !refreshToken) return false

  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    return !error
  } catch {
    return false
  }
}

export async function saveUserProfile({ token, name, email, password, currentEmail }) {
  await api.patch(
    '/auth/profile',
    {
      nama: name,
      email,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  )

  if (password || email !== (currentEmail || '')) {
    const hasSupabaseSession = await ensureSupabaseSession()
    if (!hasSupabaseSession) {
      throw new Error('Sesi Supabase tidak tersedia, silakan login ulang')
    }

    const updatePayload = {
      email,
      ...(password ? { password } : {}),
    }

    const { error } = await supabase.auth.updateUser(updatePayload)
    if (error) {
      throw new Error(error.message || 'Gagal memperbarui Auth user')
    }
  }

  return { nama: name, email }
}
