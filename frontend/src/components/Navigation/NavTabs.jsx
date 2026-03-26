import PropTypes from 'prop-types'

function NavTabs({ tabs, activeTab, onTabChange, compact }) {
  return (
    <nav className={[ 'flex flex-col', compact ? 'items-center gap-1' : '' ].join(' ')}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            className={[
              compact
                ? 'flex h-11 w-11 items-center justify-center rounded-full transition-colors'
                : 'flex items-center gap-3 px-4 py-3 text-left text-sm text-[#111b21] transition-colors',
              isActive
                ? compact ? 'bg-[#e9edef]' : 'bg-[#e9edef] font-semibold'
                : compact ? 'hover:bg-[#f5f6f6]' : 'font-normal hover:bg-[#f5f6f6]',
            ].join(' ')}
          >
            <Icon className="h-6 w-6 shrink-0 text-[#54656f]" />
            {!compact ? <span>{tab.label}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}

NavTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
    }),
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  compact: PropTypes.bool,
}

NavTabs.defaultProps = {
  compact: false,
}

export default NavTabs
