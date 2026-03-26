import { Fragment, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Dialog, Transition } from '@headlessui/react'
import { useDropzone } from 'react-dropzone'
import api from '../../lib/api'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

function UploadDocumentModal({ isOpen, onClose, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [progress, setProgress] = useState(0)

  const token = localStorage.getItem('aisya_access_token')

  const dropzoneConfig = useMemo(
    () => ({
      accept: ACCEPTED_TYPES,
      maxFiles: 1,
      multiple: false,
      disabled: uploading,
      onDrop: (acceptedFiles, rejectedFiles) => {
        if (rejectedFiles?.length) {
          setUploadError('File harus berformat PDF, DOCX, atau TXT')
          return
        }
        setUploadError('')
        setSelectedFile(acceptedFiles?.[0] || null)
      },
    }),
    [uploading],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneConfig)

  const resetState = () => {
    if (uploading) return
    setSelectedFile(null)
    setUploadError('')
    setProgress(0)
  }

  const handleClose = () => {
    resetState()
    onClose?.()
  }

  const handleUpload = async () => {
    if (!selectedFile || !token) return

    setUploading(true)
    setUploadError('')
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      await api.post('/knowledge/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (event) => {
          if (!event?.total) return
          const value = Math.round((event.loaded * 100) / event.total)
          setProgress(value)
        },
      })

      onUploadSuccess?.()
      handleClose()
    } catch (err) {
      setUploadError(err?.response?.data?.detail || 'Gagal upload dokumen')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl bg-white p-5">
                <Dialog.Title className="text-base font-semibold text-[#111b21]">Upload Dokumen</Dialog.Title>
                <p className="mt-1 text-sm text-[#667781]">Tarik file ke area di bawah atau klik untuk memilih.</p>

                <div
                  {...getRootProps()}
                  className={[
                    'mt-4 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                    isDragActive ? 'border-[#00a884] bg-[#f0fffb]' : 'border-[#d1d7db] bg-white',
                    uploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <input {...getInputProps()} />
                  <p className="text-sm text-[#41525d]">
                    {selectedFile ? selectedFile.name : 'Drop file PDF, DOCX, atau TXT di sini'}
                  </p>
                  <p className="mt-1 text-xs text-[#667781]">Maksimal 1 file</p>
                </div>

                {uploading ? (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e9edef]">
                      <div className="h-full bg-[#00a884] transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-[#667781]">{progress}%</p>
                  </div>
                ) : null}

                {uploadError ? <div className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{uploadError}</div> : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={uploading}
                    className="rounded-full border border-[#d1d7db] px-4 py-2 text-sm text-[#41525d] hover:bg-[#f5f6f6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile}
                    className="rounded-full bg-[#00a884] px-4 py-2 text-sm font-medium text-white hover:bg-[#017c63] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? 'Mengupload...' : 'Upload'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

UploadDocumentModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onUploadSuccess: PropTypes.func,
}

UploadDocumentModal.defaultProps = {
  isOpen: false,
  onUploadSuccess: undefined,
}

export default UploadDocumentModal
