import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import api from '../lib/api'

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function NotifikasiView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [markingId, setMarkingId] = useState('')

  const token = localStorage.getItem('aisya_access_token')

  const fetchNotifikasi = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')
    try {
      const response = await api.get('/notifikasi/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setItems(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal memuat notifikasi')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchNotifikasi()
  }, [fetchNotifikasi])

  const unreadCount = useMemo(
    () => items.filter((item) => !item?.dibaca).length,
    [items],
  )

  const markAsRead = async (id) => {
    if (!token || !id) return

    setMarkingId(id)
    setError('')
    try {
      const response = await api.put(
        `/notifikasi/${id}/baca`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const updated = response?.data
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (err) {
      setError(err?.response?.data?.detail || 'Gagal menandai notifikasi')
    } finally {
      setMarkingId('')
    }
  }

  const markAllAsRead = async () => {
    const unreadItems = items.filter((item) => !item?.dibaca)
    for (const item of unreadItems) {
      // Menjalankan berurutan agar status sinkron dengan endpoint existing.
      await markAsRead(item.id)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc] px-4 py-4 md:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <section className="rounded-3xl border border-[#e2e8f0] bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Notifikasi</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#0f172a]">Pusat Notifikasi AISYA</h2>
              <p className="mt-2 text-sm text-[#64748b]">Pantau pemberitahuan terbaru dan tandai yang sudah dibaca.</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#334155]">
                {unreadCount} belum dibaca
              </span>
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0 || Boolean(markingId)}
                className="inline-flex items-center gap-2 rounded-full border border-[#d1d5db] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Tandai Semua
              </button>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {loading ? (
            <p className="mt-4 text-sm text-[#64748b]">Memuat notifikasi...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-10 text-center">
              <BellIcon className="mx-auto h-8 w-8 text-[#94a3b8]" />
              <p className="mt-3 text-sm text-[#64748b]">Belum ada notifikasi.</p>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={[
                    'rounded-2xl border px-4 py-3',
                    item.dibaca ? 'border-[#e2e8f0] bg-white' : 'border-[#bfdbfe] bg-[#f8fbff]',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0f172a]">{item.judul || '-'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{item.pesan || '-'}</p>
                      <p className="mt-2 text-xs text-[#64748b]">{formatDateTime(item.created_at)}</p>
                    </div>

                    {!item.dibaca ? (
                      <button
                        type="button"
                        onClick={() => markAsRead(item.id)}
                        disabled={markingId === item.id}
                        className="inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {markingId === item.id ? 'Memproses...' : 'Tandai Dibaca'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#ecfdf3] px-2.5 py-1 text-xs font-semibold text-[#047857]">
                        Sudah dibaca
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default NotifikasiView
