import { useState, useEffect } from 'react'
import { Upload, X, FileText, Image, Trash2 } from 'lucide-react'
import api from '../config/api'

interface Evidence {
  id: string
  file_name: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
  description: string
}

interface EvidenceUploadProps {
  alertId?: string
  caseId?: string
  onUploadSuccess?: () => void
}

export default function EvidenceUpload({ alertId, caseId, onUploadSuccess }: EvidenceUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ file: null as File | null, description: '' })
  const [listLoading, setListLoading] = useState(false)

  const resourceId = alertId || caseId
  const resourceType = alertId ? 'alert' : 'case'

  const fetchEvidenceList = async () => {
    if (!resourceId) return
    setListLoading(true)
    try {
      const endpoint = alertId ? `/evidence/alert/${alertId}` : `/evidence/case/${caseId}`
      const res = await api.get(endpoint)
      setEvidenceList(res.data.evidence || [])
    } catch (err: any) {
      console.error('Failed to fetch evidence:', err)
    } finally {
      setListLoading(false)
    }
  }

  // Fetch evidence list on mount
  useEffect(() => {
    fetchEvidenceList()
  }, [resourceId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const maxSize = 50 * 1024 * 1024 // 50 MB
      if (file.size > maxSize) {
        setError('File too large (max 50 MB)')
        return
      }
      setFormData({ ...formData, file })
      setError('')
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.file || !resourceId) {
      setError('File required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formDataObj = new FormData()
      formDataObj.append('file', formData.file)
      formDataObj.append('description', formData.description)

      const endpoint = alertId ? `/evidence/upload/alert/${alertId}` : `/evidence/upload/case/${caseId}`
      await api.post(endpoint, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setFormData({ file: null, description: '' })
      setShowForm(false)
      fetchEvidenceList()
      onUploadSuccess?.()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Delete this evidence?')) return

    try {
      await api.delete(`/evidence/evidence/${evidenceId}`)
      fetchEvidenceList()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Delete failed')
    }
  }

  const getFileIcon = (fileType: string) => {
    return fileType === 'image' ? (
      <Image size={14} className="text-blue-600" />
    ) : (
      <FileText size={14} className="text-slate-600" />
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">📎 Evidence & Documents</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          {showForm ? '✕ Cancel' : '+ Add Evidence'}
        </button>
      </div>

      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}

      {/* Upload Form */}
      {showForm && (
        <form onSubmit={handleUpload} className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Upload File (PDF, JPG, PNG, DOC, etc.)</label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  disabled={loading}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    formData.file
                      ? 'bg-green-50 border-green-300'
                      : 'bg-slate-100 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <Upload size={16} className={formData.file ? 'text-green-600' : 'text-slate-500'} />
                  <span className={`text-sm font-medium ${formData.file ? 'text-green-700' : 'text-slate-600'}`}>
                    {formData.file ? formData.file.name : 'Click to upload or drag file'}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Bank statement, Customer ID, Transaction proof..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !formData.file}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Uploading...' : 'Upload Evidence'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormData({ file: null, description: '' })
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Evidence List */}
      {listLoading ? (
        <div className="py-8 text-center text-slate-400 text-sm">Loading evidence...</div>
      ) : evidenceList.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm">
          No evidence uploaded yet
        </div>
      ) : (
        <div className="space-y-2">
          {evidenceList.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(e.file_type)}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{e.file_name}</div>
                  <div className="text-xs text-slate-500">
                    {formatFileSize(e.file_size)} • Uploaded by {e.uploaded_by} • {new Date(e.uploaded_at).toLocaleDateString('en-IN')}
                  </div>
                  {e.description && <div className="text-xs text-slate-600 mt-1">{e.description}</div>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(e.id)}
                className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete evidence"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
