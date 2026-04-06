import { useEffect, useMemo, useState } from 'react'
import {
  activateAcademicYear,
  createAcademicCalendarEvent,
  createAcademicYear,
  deleteAcademicCalendarEvent,
  deleteAcademicYear,
  fetchAcademicCalendar,
  fetchAcademicYears,
  updateAcademicYearConfig,
} from '../../lib/settingsManagement'
import AppModal from '../Modal/AppModal'

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function normalizeLabelInput(value) {
  return String(value || '').trim().replace(/\s+/g, '')
}

function formatIsoDate(dateValue) {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getCalendarCells(cursorMonth) {
  const year = cursorMonth.getFullYear()
  const month = cursorMonth.getMonth()
  const firstDate = new Date(year, month, 1)
  const mondayOffset = (firstDate.getDay() + 6) % 7

  return Array.from({ length: 42 }, (_, index) => {
    const dayDate = new Date(year, month, 1 - mondayOffset + index)
    return {
      rawDate: dayDate,
      isoDate: formatIsoDate(dayDate),
      isCurrentMonth: dayDate.getMonth() === month,
    }
  })
}

function buildDateRange(startDate, endDate) {
  if (!startDate || !endDate) return []

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return []
  }

  const dates = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(formatIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function getEventTone(eventItem) {
  if (eventItem?.is_holiday) {
    return {
      badge: 'Libur',
      chipClass: 'bg-rose-50 text-rose-700',
      dotClass: 'bg-rose-500',
      borderClass: 'border-rose-100',
    }
  }

  return {
    badge: 'Event',
    chipClass: 'bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
    borderClass: 'border-sky-100',
  }
}

function AcademicYearManagementPanel() {
  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createModalError, setCreateModalError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [activeSubMenu, setActiveSubMenu] = useState('daftar-tahun-ajaran')

  const [calendarEvents, setCalendarEvents] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const [isCalendarEventModalOpen, setIsCalendarEventModalOpen] = useState(false)
  const [calendarEventModalError, setCalendarEventModalError] = useState('')
  const [calendarEventType, setCalendarEventType] = useState('holiday')
  const [calendarEventName, setCalendarEventName] = useState('')
  const [calendarEventNote, setCalendarEventNote] = useState('')
  const [dateSelectionMode, setDateSelectionMode] = useState('single')
  const [singleDateInput, setSingleDateInput] = useState('')
  const [rangeStartDateInput, setRangeStartDateInput] = useState('')
  const [rangeEndDateInput, setRangeEndDateInput] = useState('')

  const inputClass = 'rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#0f172a]'

  const activeAcademicYear = useMemo(() => {
    return items.find((item) => item.id === activeId) || items.find((item) => item.is_active) || null
  }, [items, activeId])

  const sortedItems = useMemo(() => {
    return [...items].sort((first, second) => {
      if ((first?.is_active || false) !== (second?.is_active || false)) {
        return first.is_active ? -1 : 1
      }
      return String(second?.label || '').localeCompare(String(first?.label || ''))
    })
  }, [items])

  const summary = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((item) => item.is_active).length,
      archived: items.filter((item) => !item.is_active).length,
    }
  }, [items])

  const eventsByDate = useMemo(() => {
    const map = new Map()
    ;(calendarEvents || []).forEach((eventItem) => {
      const key = String(eventItem?.tanggal || '')
      if (!key) return
      const existing = map.get(key) || []
      existing.push(eventItem)
      map.set(key, existing)
    })
    return map
  }, [calendarEvents])

  const calendarCells = useMemo(() => getCalendarCells(calendarCursor), [calendarCursor])

  const monthLabel = useMemo(() => {
    return calendarCursor.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })
  }, [calendarCursor])

  const monthEvents = useMemo(() => {
    const monthPrefix = `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2, '0')}-`
    return (calendarEvents || [])
      .filter((item) => String(item?.tanggal || '').startsWith(monthPrefix))
      .sort((a, b) => {
        const byDate = String(a?.tanggal || '').localeCompare(String(b?.tanggal || ''))
        if (byDate !== 0) return byDate
        if (Boolean(a?.is_holiday) !== Boolean(b?.is_holiday)) {
          return a?.is_holiday ? -1 : 1
        }
        return String(a?.nama_event || '').localeCompare(String(b?.nama_event || ''))
      })
  }, [calendarEvents, calendarCursor])

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return []
    return [...(eventsByDate.get(selectedDate) || [])].sort((a, b) => {
      if (Boolean(a?.is_holiday) !== Boolean(b?.is_holiday)) {
        return a?.is_holiday ? -1 : 1
      }
      return String(a?.nama_event || '').localeCompare(String(b?.nama_event || ''))
    })
  }, [eventsByDate, selectedDate])

  const loadCalendar = async (tahunAjaranId) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token || !tahunAjaranId) {
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const events = await fetchAcademicCalendar(token, tahunAjaranId)
      setCalendarEvents(events)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat kalender pendidikan')
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }

  const loadData = async () => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const response = await fetchAcademicYears(token)
      setItems(response?.data || [])
      setActiveId(response?.activeId || '')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memuat tahun ajaran')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!activeId) {
      setCalendarEvents([])
      return
    }
    loadCalendar(activeId)
  }, [activeId])

  const handleCreate = async () => {
    const label = normalizeLabelInput(labelInput)
    if (!label) {
      setCreateModalError('Label tahun ajaran wajib diisi')
      return
    }

    const confirmed = window.confirm(`Simpan tahun ajaran baru "${label}"?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setCreateModalError('')
    setError('')
    setSuccess('')

    try {
      await createAcademicYear(token, { label })
      setSuccess('Tahun ajaran berhasil ditambahkan')
      setLabelInput('')
      setCreateModalError('')
      setIsCreateModalOpen(false)
      await loadData()
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || 'Gagal menambah tahun ajaran'
      setCreateModalError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (tahunAjaranId) => {
    const selectedItem = items.find((item) => item.id === tahunAjaranId)
    const confirmed = window.confirm(`Jadikan tahun ajaran "${selectedItem?.label || '-'}" sebagai aktif?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await activateAcademicYear(token, tahunAjaranId)
      setSuccess('Tahun ajaran aktif berhasil diperbarui')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal mengaktifkan tahun ajaran')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Hapus tahun ajaran ${item?.label}?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await deleteAcademicYear(token, item.id)
      setSuccess('Tahun ajaran berhasil dihapus')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menghapus tahun ajaran')
    } finally {
      setSaving(false)
    }
  }

  const handleEffectiveDaysChange = async (nextValue) => {
    if (!activeAcademicYear) return

    const nextDays = Number(nextValue)
    if (![5, 6].includes(nextDays)) return

    const confirmed = window.confirm(`Ubah hari efektif belajar tahun ajaran aktif menjadi ${nextDays} hari?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateAcademicYearConfig(token, activeAcademicYear.id, {
        hari_efektif_belajar: nextDays,
      })
      setSuccess('Hari efektif belajar berhasil diperbarui')
      await loadData()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal memperbarui hari efektif belajar')
    } finally {
      setSaving(false)
    }
  }

  const openCalendarEventModal = () => {
    const defaultDate = selectedDate || formatIsoDate(new Date())
    setDateSelectionMode('single')
    setSingleDateInput(defaultDate)
    setRangeStartDateInput(defaultDate)
    setRangeEndDateInput(defaultDate)
    setCalendarEventType('holiday')
    setCalendarEventName('')
    setCalendarEventNote('')
    setCalendarEventModalError('')
    setIsCalendarEventModalOpen(true)
  }

  const closeCalendarEventModal = () => {
    if (!saving) {
      setCalendarEventModalError('')
      setIsCalendarEventModalOpen(false)
    }
  }

  const handleCreateCalendarEvent = async () => {
    if (!activeAcademicYear) return

    const namaEvent = String(calendarEventName || '').trim()
    const isHoliday = calendarEventType === 'holiday'

    if (!namaEvent) {
      setCalendarEventModalError('Nama event wajib diisi')
      return
    }

    let targetDates = []
    if (dateSelectionMode === 'single') {
      const singleDate = String(singleDateInput || '').trim()
      if (!singleDate) {
        setCalendarEventModalError('Tanggal wajib diisi')
        return
      }
      targetDates = [singleDate]
    } else {
      targetDates = buildDateRange(rangeStartDateInput, rangeEndDateInput)
      if (targetDates.length === 0) {
        setCalendarEventModalError('Rentang tanggal tidak valid')
        return
      }
    }

    const labelType = isHoliday ? 'hari libur' : 'event sekolah'
    const labelTanggal = targetDates.length === 1
      ? targetDates[0]
      : `${targetDates[0]} s/d ${targetDates[targetDates.length - 1]}`

    const confirmed = window.confirm(
      `Tambah ${labelType} "${namaEvent}" pada ${labelTanggal} (${targetDates.length} hari)?`,
    )
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')
    setCalendarEventModalError('')

    try {
      let latestEvents = calendarEvents
      for (const tanggal of targetDates) {
        latestEvents = await createAcademicCalendarEvent(token, activeAcademicYear.id, {
          tanggal,
          nama_event: namaEvent,
          is_holiday: isHoliday,
          keterangan: String(calendarEventNote || '').trim() || undefined,
        })
      }

      setCalendarEvents(latestEvents)
      setSelectedDate(targetDates[0])
      setSuccess(targetDates.length === 1 ? 'Event kalender berhasil ditambahkan' : `${targetDates.length} event kalender berhasil ditambahkan`)
      setIsCalendarEventModalOpen(false)
    } catch (err) {
      setCalendarEventModalError(err?.response?.data?.detail || err?.message || 'Gagal menambah event kalender')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCalendarEvent = async (eventItem) => {
    if (!activeAcademicYear || !eventItem?.id) return

    const labelType = eventItem?.is_holiday ? 'libur' : 'event'
    const confirmed = window.confirm(`Hapus ${labelType} "${eventItem.nama_event}" (${eventItem.tanggal})?`)
    if (!confirmed) return

    const token = localStorage.getItem('aisya_access_token')
    if (!token) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await deleteAcademicCalendarEvent(token, activeAcademicYear.id, eventItem.id)
      await loadCalendar(activeAcademicYear.id)
      setSuccess('Event kalender berhasil dihapus')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Gagal menghapus event kalender')
    } finally {
      setSaving(false)
    }
  }

  const handleGoToToday = () => {
    const now = new Date()
    setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(formatIsoDate(now))
  }

  return (
    <div className="space-y-4">
      {success ? <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0f172a]">Manajemen Tahun Ajaran</p>
        <p className="mt-1 text-xs text-[#64748b]">Kelola data tahun ajaran dan kalender pendidikan dari sub menu di bawah ini.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubMenu('daftar-tahun-ajaran')}
            className={[
              'rounded-full border px-4 py-2 text-xs font-medium transition-colors',
              activeSubMenu === 'daftar-tahun-ajaran'
                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]',
            ].join(' ')}
          >
            Daftar Tahun Ajaran
          </button>
          <button
            type="button"
            onClick={() => setActiveSubMenu('kalender-pendidikan')}
            className={[
              'rounded-full border px-4 py-2 text-xs font-medium transition-colors',
              activeSubMenu === 'kalender-pendidikan'
                ? 'border-[#0f172a] bg-[#0f172a] text-white'
                : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]',
            ].join(' ')}
          >
            Kalender Pendidikan
          </button>
        </div>
      </div>

      {activeSubMenu === 'daftar-tahun-ajaran' ? (
        <>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#0f172a]">Pengaturan Tahun Ajaran Aktif</p>
            <p className="mt-1 text-xs text-[#64748b]">Semua modul administrasi mengikuti tahun ajaran aktif.</p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[#334155]">Total: {summary.total}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Aktif: {summary.active}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Nonaktif: {summary.archived}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setLabelInput('')
                  setCreateModalError('')
                  setIsCreateModalOpen(true)
                }}
                disabled={saving}
                className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60 md:max-w-xs"
              >
                Tambah Tahun Ajaran
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] shadow-sm">
            <table className="min-w-full divide-y divide-[#e2e8f0]">
              <thead className="bg-[#f8fafc]">
                <tr className="text-left text-xs uppercase tracking-wide text-[#64748b]">
                  <th className="px-3 py-2">Tahun Ajaran</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2f7] bg-white text-sm text-[#0f172a]">
                {loading ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={3}>Memuat data tahun ajaran...</td>
                  </tr>
                ) : null}

                {!loading && sortedItems.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={3}>Belum ada data tahun ajaran.</td>
                  </tr>
                ) : null}

                {!loading
                  ? sortedItems.map((item) => {
                      const isCurrent = activeId === item.id || Boolean(item.is_active)
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium text-[#0f172a]">{item.label}</td>
                          <td className="px-3 py-2">
                            <span
                              className={[
                                'rounded-full px-3 py-1 text-xs',
                                isCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-[#334155]',
                              ].join(' ')}
                            >
                              {isCurrent ? 'Aktif' : 'Tidak aktif'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleActivate(item.id)}
                                disabled={saving || isCurrent}
                                className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
                              >
                                Jadikan Aktif
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                disabled={saving}
                                className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {activeSubMenu === 'kalender-pendidikan' ? (
        <>
          {activeAcademicYear ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#0f172a]">Pengaturan Kalender Belajar ({activeAcademicYear.label})</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#64748b]">Hari efektif belajar:</span>
                  <button
                    type="button"
                    onClick={() => handleEffectiveDaysChange(5)}
                    disabled={saving || Number(activeAcademicYear.hari_efektif_belajar || 5) === 5}
                    className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-white disabled:opacity-50"
                  >
                    5 Hari (Senin-Jumat)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEffectiveDaysChange(6)}
                    disabled={saving || Number(activeAcademicYear.hari_efektif_belajar || 5) === 6}
                    className="rounded-full border border-[#cbd5e1] px-3 py-1 text-xs text-[#334155] hover:bg-white disabled:opacity-50"
                  >
                    6 Hari (Senin-Sabtu)
                  </button>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                    Aktif: {Number(activeAcademicYear.hari_efektif_belajar || 5)} hari
                  </span>
                </div>

                <p className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
                  Event bertipe Hari Libur akan dikecualikan otomatis dari perhitungan presensi periode. Hari Minggu ditandai merah pada kalender.
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-[#0f172a]">Kalender Pendidikan</p>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                    <button
                      type="button"
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded-full border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      onClick={handleGoToToday}
                      className="rounded-full border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded-full border border-[#cbd5e1] px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-sm font-medium text-[#0f172a]">{monthLabel}</p>
                <p className="mt-1 text-xs text-[#64748b]">Klik tanggal untuk lihat detail event. Penambahan event/libur dilakukan melalui modal.</p>

                <div className="mt-3 overflow-x-auto pb-1">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-7 gap-2">
                      {DAY_LABELS.map((dayLabel, index) => (
                        <div
                          key={dayLabel}
                          className={[
                            'rounded-lg px-2 py-1 text-center text-xs font-semibold',
                            index === 6 ? 'bg-red-50 text-red-700' : 'bg-[#f8fafc] text-[#64748b]',
                          ].join(' ')}
                        >
                          {dayLabel}
                        </div>
                      ))}

                      {calendarCells.map((cell) => {
                        const dayEvents = eventsByDate.get(cell.isoDate) || []
                        const isSelected = selectedDate === cell.isoDate
                        const isSunday = cell.rawDate.getDay() === 0

                        return (
                          <button
                            key={cell.isoDate}
                            type="button"
                            onClick={() => setSelectedDate(cell.isoDate)}
                            className={[
                              'min-h-[70px] rounded-xl border px-2 py-2 text-left transition-colors sm:min-h-[90px]',
                              cell.isCurrentMonth ? 'border-[#e2e8f0] bg-white' : 'border-[#edf2f7] bg-[#f8fafc]',
                              isSunday && cell.isCurrentMonth ? 'border-red-100 bg-red-50/30' : '',
                              isSelected ? 'ring-2 ring-[#0f172a]' : '',
                            ].join(' ')}
                          >
                            <p
                              className={[
                                'text-xs font-semibold',
                                isSunday && cell.isCurrentMonth
                                  ? 'text-red-600'
                                  : cell.isCurrentMonth
                                    ? 'text-[#0f172a]'
                                    : 'text-[#94a3b8]',
                              ].join(' ')}
                            >
                              {cell.rawDate.getDate()}
                            </p>

                            {dayEvents.length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {dayEvents.slice(0, 2).map((eventItem) => {
                                  const tone = getEventTone(eventItem)
                                  return (
                                    <p
                                      key={eventItem.id}
                                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${tone.chipClass}`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dotClass}`} />
                                      <span className="truncate">{eventItem.nama_event}</span>
                                    </p>
                                  )
                                })}
                                {dayEvents.length > 2 ? (
                                  <p className="text-[10px] text-[#64748b]">+{dayEvents.length - 2} event</p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1 text-[10px] text-[#94a3b8]">-</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={openCalendarEventModal}
                    className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617]"
                  >
                    Tambah Libur / Event
                  </button>
                </div>

                {selectedDate ? (
                  <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <p className="text-xs font-semibold text-[#334155]">Event di tanggal {selectedDate}</p>
                    {selectedDateEvents.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {selectedDateEvents.map((eventItem) => {
                          const tone = getEventTone(eventItem)
                          return (
                            <div
                              key={eventItem.id}
                              className={`flex flex-col gap-2 rounded-lg border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${tone.borderClass}`}
                            >
                              <div>
                                <p className="text-sm font-medium text-[#0f172a]">{eventItem.nama_event}</p>
                                <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tone.chipClass}`}>{tone.badge}</p>
                                <p className="text-xs text-[#64748b]">{eventItem.keterangan || '-'}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarEvent(eventItem)}
                                disabled={saving}
                                className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Hapus
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[#64748b]">Belum ada event pada tanggal ini.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#0f172a]">Agenda Bulan Ini</p>
                {calendarLoading ? <p className="mt-2 text-sm text-[#64748b]">Memuat kalender pendidikan...</p> : null}

                {!calendarLoading && monthEvents.length === 0 ? (
                  <p className="mt-2 text-sm text-[#64748b]">Belum ada event kalender untuk bulan ini.</p>
                ) : null}

                {!calendarLoading && monthEvents.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {monthEvents.map((eventItem) => {
                      const tone = getEventTone(eventItem)
                      return (
                        <div
                          key={eventItem.id}
                          className={`flex flex-col gap-2 rounded-lg border bg-[#f8fafc] px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${tone.borderClass}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-[#0f172a]">{eventItem.tanggal} - {eventItem.nama_event}</p>
                            <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tone.chipClass}`}>{tone.badge}</p>
                            <p className="text-xs text-[#64748b]">{eventItem.keterangan || '-'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCalendarEvent(eventItem)}
                            disabled={saving}
                            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Hapus
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b] shadow-sm">
              Belum ada tahun ajaran aktif. Silakan tambahkan dan aktifkan tahun ajaran terlebih dahulu.
            </div>
          )}
        </>
      ) : null}

      <AppModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!saving) {
            setCreateModalError('')
            setIsCreateModalOpen(false)
          }
        }}
        title="Tambah Tahun Ajaran"
        description="Isi label tahun ajaran, lalu konfirmasi sebelum data disimpan."
      >
        <div className="space-y-3">
          {createModalError ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{createModalError}</div> : null}
          <input
            className={inputClass}
            value={labelInput}
            onChange={(ev) => setLabelInput(ev.target.value)}
            placeholder="Contoh: 2026/2027"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateModalError('')
                setIsCreateModalOpen(false)
              }}
              disabled={saving}
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Tahun Ajaran'}
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={isCalendarEventModalOpen}
        onClose={closeCalendarEventModal}
        title="Tambah Libur / Event Kalender"
        description="Pilih tipe, lalu atur tanggal tunggal atau rentang tanggal."
      >
        <div className="space-y-3">
          {calendarEventModalError ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{calendarEventModalError}</div> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              className={inputClass}
              value={calendarEventType}
              onChange={(ev) => setCalendarEventType(ev.target.value)}
            >
              <option value="holiday">Hari Libur</option>
              <option value="event">Acara / Event</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDateSelectionMode('single')}
                className={[
                  'rounded-full border px-3 py-2 text-xs font-medium',
                  dateSelectionMode === 'single'
                    ? 'border-[#0f172a] bg-[#0f172a] text-white'
                    : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]',
                ].join(' ')}
              >
                Tanggal Tunggal
              </button>
              <button
                type="button"
                onClick={() => setDateSelectionMode('range')}
                className={[
                  'rounded-full border px-3 py-2 text-xs font-medium',
                  dateSelectionMode === 'range'
                    ? 'border-[#0f172a] bg-[#0f172a] text-white'
                    : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc]',
                ].join(' ')}
              >
                Rentang Tanggal
              </button>
            </div>
          </div>

          {dateSelectionMode === 'single' ? (
            <input
              type="date"
              className={inputClass}
              value={singleDateInput}
              onChange={(ev) => setSingleDateInput(ev.target.value)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="date"
                className={inputClass}
                value={rangeStartDateInput}
                onChange={(ev) => setRangeStartDateInput(ev.target.value)}
              />
              <input
                type="date"
                className={inputClass}
                value={rangeEndDateInput}
                onChange={(ev) => setRangeEndDateInput(ev.target.value)}
              />
            </div>
          )}

          <input
            className={inputClass}
            value={calendarEventName}
            onChange={(ev) => setCalendarEventName(ev.target.value)}
            placeholder="Nama hari libur / event"
          />

          <input
            className={inputClass}
            value={calendarEventNote}
            onChange={(ev) => setCalendarEventNote(ev.target.value)}
            placeholder="Keterangan (opsional)"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeCalendarEventModal}
              disabled={saving}
              className="rounded-full border border-[#cbd5e1] px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleCreateCalendarEvent}
              disabled={saving}
              className="rounded-full bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#020617] disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Event'}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

export default AcademicYearManagementPanel
