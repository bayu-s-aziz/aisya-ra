import PropTypes from 'prop-types'

export default function StatusIndicator({ label = 'Menganalisis permintaan...' }) {
  return (
    <div className="my-2 flex items-center gap-3 px-1 text-[#64748b]">
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#98a2b3]" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#98a2b3]" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#98a2b3]" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-[12px] font-medium italic tracking-wide">{label}</span>
    </div>
  )
}

StatusIndicator.propTypes = {
  label: PropTypes.string,
}
