import PropTypes from 'prop-types'
import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { savePresensiBatch } from '../../lib/settingsManagement'
import DocumentDraftCard from './Cards/DocumentDraftCard'
import ActionConfirmationCard from './Cards/ActionConfirmationCard'
import DataTableCard from './Cards/DataTableCard'
import StatusResultCard from './Cards/StatusResultCard'
import StatusIndicator from './Cards/StatusIndicator'

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getImageUrlFromMessage(message) {
  if (message?.media_type?.startsWith('image/') && message?.media_url) {
    return message.media_url
  }

  if (typeof message?.content === 'string') {
    const directImageRegex = /(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp|svg))/i
    const matched = message.content.match(directImageRegex)
    if (matched?.[1]) return matched[1]
  }

  return null
}

function renderInline(line, lineKey) {
  const parts = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index))
    }
    if (match[3]) {
      parts.push(
        <code
          key={`${lineKey}-${match.index}`}
          className="rounded bg-[#eef2f6] px-1 py-[1px] font-mono text-[0.92em] text-[#0f172a]"
        >
          {match[3]}
        </code>,
      )
    } else {
      const boldText = match[1] ?? match[2]
      parts.push(<strong key={`${lineKey}-${match.index}`}>{boldText}</strong>)
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex))
  }

  return parts
}

function RichText({ text }) {
  if (!text) return null

  const blocks = text.split(/```/)

  return (
    <div className="space-y-3 break-words">
      {blocks.map((block, blockIndex) => {
        const isCodeBlock = blockIndex % 2 === 1

        if (isCodeBlock) {
          return (
            <pre
              key={`code-${blockIndex}`}
              className="overflow-x-auto rounded-xl border border-[#d0d5dd] bg-[#0b1220] px-3 py-3 text-xs text-[#e2e8f0]"
            >
              <code>{block.trim()}</code>
            </pre>
          )
        }

        const lines = block.split('\n')
        return (
          <div key={`text-${blockIndex}`} className="space-y-1">
            {lines.map((line, lineIndex) => {
              const trimmed = line.trim()
              if (!trimmed) {
                return <div key={`line-${blockIndex}-${lineIndex}`} className="h-2" />
              }

              const listMatch = trimmed.match(/^[-*]\s+(.+)/)
              if (listMatch) {
                return (
                  <div key={`line-${blockIndex}-${lineIndex}`} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#475467]" />
                    <span>{renderInline(listMatch[1], `${blockIndex}-${lineIndex}`)}</span>
                  </div>
                )
              }

              return (
                <p key={`line-${blockIndex}-${lineIndex}`} className="leading-[1.6]">
                  {renderInline(line, `${blockIndex}-${lineIndex}`)}
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message?.role_msg === 'user'
  const timeLabel = formatTime(message?.timestamp)
  const imageUrl = getImageUrlFromMessage(message)
  const isPending = message?.status === 'pending'
  const isFailed = message?.status === 'failed'

  const raProfile = useChatStore((state) => state.raProfile)
  const activeAcademicYearId = useChatStore((state) => state.activeAcademicYearId)
  const [confirmStatus, setConfirmStatus] = useState('pending')
  const [tableStatus, setTableStatus] = useState('pending')
  const [errorMessage, setErrorMessage] = useState('')

  const handleConfirm = () => {
    console.log('Action confirmed')
    setConfirmStatus('success')
    // TODO: integrate actual save logic here (e.g., API call to Supabase)
  }

  const handleCancel = () => {
    console.log('Action cancelled')
    setConfirmStatus('pending')
    // TODO: handle cancel logic if needed
  }

  const handleSaveTable = async (data) => {
    const token = localStorage.getItem('aisya_access_token')
    if (!token || !raProfile?.id || !activeAcademicYearId) {
      setErrorMessage('Konteks sistem (RA ID/Tahun Ajaran) tidak ditemukan. Silakan refresh halaman.')
      setTableStatus('failed')
      return
    }

    console.log('Saving table data to backend:', data)
    
    try {
      // Build payload for savePresensiBatch
      const payload = {
        tanggal: new Date().toISOString().split('T')[0], // today
        kelompok_id: message?.kelompok_id || null, // Best effort from message metadata if exists
        records: data.map(row => ({
          siswa_id: row.id,
          status: row.status.toLowerCase(),
          keterangan: '',
          sumber_pencatatan: 'ai_chat_workspace'
        }))
      }

      const result = await savePresensiBatch(token, payload)
      console.log('Save result:', result)
      setTableStatus('success')
    } catch (err) {
      console.error('Failed to save attendance:', err)
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Gagal menyimpan presensi ke database.')
      setTableStatus('failed')
    }
  }

  return (
    <div className={`message-enter mb-6 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`min-w-0 text-sm ${isUser ? 'max-w-[88%] md:max-w-[76%]' : 'w-full max-w-[52rem]'}`}>
        {!isUser ? (
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0f172a] text-[11px] font-bold text-white">AI</div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">AISYA</p>
          </div>
        ) : null}

        <div
          className={[
            'min-w-0',
            isUser
              ? 'rounded-3xl border border-[#d0d5dd] bg-white px-4 py-3 shadow-sm'
              : 'rounded-2xl border border-transparent bg-transparent px-0 py-0 text-[#0f172a]',
            isFailed ? 'border-red-200 bg-red-50' : '',
          ].join(' ')}
        >
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer" className="mb-3 block">
              <img
                src={imageUrl}
                alt="Media pesan"
                className="max-h-72 w-full rounded-xl object-cover"
                loading="lazy"
              />
            </a>
          ) : null}

          {/* Render UI cards based on special markers */}
          {(() => {
            const content = message?.content || ''
            
            // 1. Handle Table Marker
            if (content.includes('[[TABLE]]')) {
              const parts = content.split('[[TABLE]]')
              const jsonStr = parts[1]?.trim() || '[]'
              let tableData = []
              try {
                tableData = JSON.parse(jsonStr)
              } catch (e) {
                console.error('Failed to parse table JSON:', e)
              }
              
              return (
                <>
                  <RichText text={parts[0]} />
                  <DataTableCard 
                    rows={tableData} 
                    onSave={handleSaveTable} 
                    status={tableStatus}
                  />
                  {tableStatus === 'success' && (
                    <StatusResultCard status="success" message="Data kehadiran berhasil diperbarui ke database." />
                  )}
                  {tableStatus === 'failed' && (
                    <StatusResultCard status="failed" message={errorMessage} />
                  )}
                </>
              )
            }

            // 2. Handle Loading/Thinking Marker
            if (content.includes('[[LOADING]]')) {
              const parts = content.split('[[LOADING]]')
              const label = parts[1]?.trim() || undefined
              return (
                <>
                  <RichText text={parts[0]} />
                  <StatusIndicator label={label} />
                </>
              )
            }

            // 3. Handle Draft Marker
            if (content.includes('[[DRAFT]]')) {
              const parts = content.split('[[DRAFT]]')
              const excerpt = parts[1]?.trim() || ''
              return (
                <>
                  <RichText text={parts[0]} />
                  <DocumentDraftCard excerpt={excerpt} />
                </>
              )
            }

            // 4. Handle Confirm Action Marker
            if (content.includes('[[CONFIRM]]')) {
              const parts = content.split('[[CONFIRM]]')
              const description = parts[1]?.trim() || ''
              return (
                <>
                  <RichText text={parts[0]} />
                  <ActionConfirmationCard 
                    description={description} 
                    status={confirmStatus} 
                    onConfirm={handleConfirm} 
                    onCancel={handleCancel} 
                  />
                </>
              )
            }

            return <RichText text={content} />
          })()}
          

          <div className="mt-2 flex items-center gap-2 text-[11px] leading-none text-[#98a2b3]">
            {timeLabel ? <span>{timeLabel}</span> : null}
            {isPending ? <span className="text-[#98a2b3]">mengirim...</span> : null}
            {isFailed ? <span className="font-medium text-red-600">gagal dikirim</span> : null}
          </div>
        </div>

      </div>
    </div>
  )
}

MessageBubble.propTypes = {
  message: PropTypes.shape({
    role_msg: PropTypes.string,
    content: PropTypes.string,
    timestamp: PropTypes.string,
    media_type: PropTypes.string,
    media_url: PropTypes.string,
    status: PropTypes.string,
  }).isRequired,
}

export default MessageBubble
