import PropTypes from 'prop-types'
import KnowledgeBaseDetail from '../components/KnowledgeBase/KnowledgeBaseDetail'

function KnowledgeBaseView({ selectedDocId, selectedDoc, onDocDeleted }) {
  return (
    <div className="h-full overflow-y-auto bg-[#f0f2f5] p-4">
      <div className="rounded-xl bg-white p-5">
        <h2 className="text-lg font-semibold text-[#111b21]">Knowledge Base</h2>

        {selectedDocId ? (
          <KnowledgeBaseDetail
            selectedDocId={selectedDocId}
            selectedDoc={selectedDoc}
            onDocDeleted={onDocDeleted}
          />
        ) : (
          <p className="mt-5 text-sm text-[#667781]">Pilih dokumen dari secondary sidebar.</p>
        )}

      </div>
    </div>
  )
}

KnowledgeBaseView.propTypes = {
  selectedDocId: PropTypes.string,
  selectedDoc: PropTypes.shape({
    nama_file: PropTypes.string,
    total_chunks: PropTypes.number,
  }),
  onDocDeleted: PropTypes.func,
}

KnowledgeBaseView.defaultProps = {
  selectedDocId: '',
  selectedDoc: null,
  onDocDeleted: undefined,
}

export default KnowledgeBaseView
