import { useMemo } from 'react'
import PropTypes from 'prop-types'
import UsersManagementPanel from '../components/Settings/UsersManagementPanel'

function SettingsView({ profile }) {
  const isKepalaRole = useMemo(() => {
    const role = (profile?.role || '').toLowerCase()
    return ['kepala_ra', 'kepala', 'admin', 'admin_ra'].includes(role)
  }, [profile?.role])

  return (
    <div className="h-full overflow-y-auto bg-[#f0f2f5] p-4">
      <div className="rounded-xl bg-white p-5">
        <h2 className="text-lg font-semibold text-[#111b21]">Pengaturan</h2>
        <p className="mt-2 text-sm text-[#667781]">Profil Pengguna dan Profil RA sudah dipindahkan ke panel Profil.</p>

        {isKepalaRole ? <div className="mt-4"><UsersManagementPanel /></div> : null}
        {!isKepalaRole ? <p className="mt-4 text-sm text-[#667781]">Tidak ada pengaturan tambahan untuk peran Anda.</p> : null}
      </div>
    </div>
  )
}

SettingsView.propTypes = {
  profile: PropTypes.shape({
    nama: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    telepon: PropTypes.string,
    jabatan: PropTypes.string,
  }),
}

SettingsView.defaultProps = {
  profile: null,
}

export default SettingsView
