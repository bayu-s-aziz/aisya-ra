import PropTypes from 'prop-types'

function getInitials(name) {
  if (!name) return 'U'
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function ProfileInfoCard({
  avatarUrl,
  avatarAlt,
  avatarFallback,
  title,
  subtitle,
  items,
  className,
}) {
  return (
    <div className={["rounded-xl border border-[#e2e8f0] bg-white", className].filter(Boolean).join(' ')}>
      <div className="flex flex-col items-center border-b border-[#e2e8f0] px-4 py-5 sm:px-5 sm:py-6">
        {avatarUrl ? (
          <img src={avatarUrl} alt={avatarAlt || title || 'Profile'} className="h-16 w-16 rounded-full border border-[#cbd5e1] object-cover sm:h-20 sm:w-20" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e2e8f0] text-base font-semibold text-[#334155] sm:h-20 sm:w-20 sm:text-xl">
            {avatarFallback || getInitials(title)}
          </div>
        )}
        <p className="mt-3 text-sm font-semibold text-[#0f172a] sm:text-base">{title || '-'}</p>
        {subtitle ? <p className="text-xs text-[#64748b] sm:text-sm">{subtitle}</p> : null}
      </div>

      <div className="divide-y divide-[#e2e8f0]">
        {(items || []).map((item) => (
          <div key={item.label} className="px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-xs uppercase tracking-wide text-[#64748b]">{item.label}</p>
            <p className={['mt-1 text-sm text-[#0f172a]', item.capitalize ? 'capitalize' : ''].filter(Boolean).join(' ')}>{item.value || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

ProfileInfoCard.propTypes = {
  avatarUrl: PropTypes.string,
  avatarAlt: PropTypes.string,
  avatarFallback: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string,
      capitalize: PropTypes.bool,
    }),
  ),
  className: PropTypes.string,
}

ProfileInfoCard.defaultProps = {
  avatarUrl: '',
  avatarAlt: '',
  avatarFallback: '',
  title: '',
  subtitle: '',
  items: [],
  className: '',
}

export default ProfileInfoCard