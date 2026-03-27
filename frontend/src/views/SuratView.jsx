import { useState } from 'react'
import { DocumentTextIcon, ArchiveBoxIcon, RectangleStackIcon } from '@heroicons/react/24/outline'
import BuatSuratPage from '../pages/BuatSuratPage'
import ArsipSuratPage from '../pages/ArsipSuratPage'
import TemplateSuratPage from '../pages/TemplateSuratPage'

const TABS = [
  {
    id: 'buat',
    title: 'Buat Surat',
    icon: DocumentTextIcon,
    description: 'Generate surat dari template dinamis',
  },
  {
    id: 'arsip',
    title: 'Arsip Surat',
    icon: ArchiveBoxIcon,
    description: 'Lihat, unduh, dan hapus surat terdokumentasi',
  },
  {
    id: 'template',
    title: 'Template Surat',
    icon: RectangleStackIcon,
    description: 'Kelola template untuk berbagai jenis surat',
  },
]

function SuratView() {
  const [activeTab, setActiveTab] = useState('buat')

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc]">
      <div className="border-b border-[#e2e8f0] bg-white px-4 py-3 md:px-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'border-[#cbd5e1] bg-[#f1f5f9] font-semibold text-[#0f172a]'
                    : 'border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc]',
                ].join(' ')}
                title={tab.description}
              >
                <Icon className="h-4 w-4" />
                {tab.title}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'buat' ? <BuatSuratPage /> : null}
        {activeTab === 'arsip' ? <ArsipSuratPage /> : null}
        {activeTab === 'template' ? <TemplateSuratPage /> : null}
      </div>
    </div>
  )
}

export default SuratView
