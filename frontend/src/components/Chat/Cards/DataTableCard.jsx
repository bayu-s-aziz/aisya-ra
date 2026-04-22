import { useState } from 'react'
import PropTypes from 'prop-types'
import { CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function DataTableCard({ 
  rows = [], 
  onSave, 
  title = 'Data Kehadiran Siswa', 
  status = 'pending' 
}) {
  const [data, setData] = useState(rows)
  const [isSaving, setIsSaving] = useState(false)

  const updateStatus = (id, newStatus) => {
    setData(prev =>
      prev.map(r => (r.id === id ? { ...r, status: newStatus } : r))
    )
  }

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave(data)
    } finally {
      setIsSaving(false)
    }
  }

  const isReadOnly = status === 'success'

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-black/5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[#0f172a]">{title}</h3>
        {isReadOnly && (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            <CheckIcon className="h-3.5 w-3.5" /> Terkunci
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#fcfdfe] text-[#64748b]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Nama Siswa</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Status Kehadiran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-[#fafbfc] transition-colors">
                <td className="px-4 py-3 font-medium text-[#1e293b]">{row.name}</td>
                <td className="px-4 py-3 text-right sm:text-left">
                  <select
                    disabled={isReadOnly || isSaving}
                    value={row.status}
                    onChange={(e) => updateStatus(row.id, e.target.value)}
                    className="w-full sm:w-auto rounded-lg border border-[#d1d5db] bg-[#fdfdfd] px-2 py-1 text-xs text-[#334155] shadow-sm transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="Hadir">Hadir</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Alpa">Alpa</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end border-t border-[#f1f5f9] bg-[#fcfdfe] px-4 py-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-black/10 transition-all hover:bg-[#1e293b] active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Menyimpan...
              </>
            ) : 'Simpan Perubahan'}
          </button>
        </div>
      )}
    </div>
  )
}

DataTableCard.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ),
  onSave: PropTypes.func,
  title: PropTypes.string,
  status: PropTypes.string,
}
