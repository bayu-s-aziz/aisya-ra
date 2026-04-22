import { ShieldExclamationIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import PropTypes from 'prop-types'

export default function ActionConfirmationCard({
  title = 'Konfirmasi Tindakan',
  description = 'Apakah Anda yakin ingin menyimpan data ini ke sistem?',
  status = 'pending',
  onConfirm,
  onCancel,
}) {
  if (status === 'success') {
    return (
      <div className="my-3 flex items-center gap-3 rounded-xl border border-[#d1fae5] bg-[#ecfdf5] p-4 text-[#065f46] shadow-sm">
        <CheckCircleIcon className="h-6 w-6 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold">Tindakan Berhasil</p>
          <p className="text-[12px] opacity-90">Data telah disimpan dengan aman ke sistem.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#fef08a] bg-[#fefce8] p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">
          <ShieldExclamationIcon className="h-6 w-6 text-[#ca8a04]" />
        </div>
        <div className="flex-1">
          <h4 className="text-[14px] font-semibold text-[#854d0e]">{title}</h4>
          <p className="mt-1 text-[13px] text-[#a16207]/90 leading-relaxed">{description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#854d0e] shadow-sm ring-1 ring-inset ring-[#fde047] hover:bg-[#fef9c3] transition-colors"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-[#a16207] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#854d0e] transition-colors"
            >
              Konfirmasi & Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

ActionConfirmationCard.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  status: PropTypes.oneOf(['pending', 'success', 'failed']),
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
}
