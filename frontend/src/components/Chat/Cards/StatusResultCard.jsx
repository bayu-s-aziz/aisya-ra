import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import PropTypes from 'prop-types'

export default function StatusResultCard({ status = 'success', message = '' }) {
  const isSuccess = status === 'success'
  
  return (
    <div
      className={`my-3 flex items-center gap-3 rounded-xl border p-4 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isSuccess
          ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
          : 'border-rose-100 bg-rose-50 text-rose-800'
      }`}
    >
      {isSuccess ? (
        <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" />
      ) : (
        <XCircleIcon className="h-6 w-6 shrink-0 text-rose-500" />
      )}
      <div className="flex-1">
        <p className="text-[13px] font-semibold">{isSuccess ? 'Berhasil' : 'Gagal'}</p>
        <p className="text-[12px] opacity-90">{message}</p>
      </div>
    </div>
  )
}

StatusResultCard.propTypes = {
  status: PropTypes.oneOf(['success', 'failed']),
  message: PropTypes.string.isRequired,
}
