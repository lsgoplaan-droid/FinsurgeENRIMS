import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, UserPlus, AlertTriangle, XCircle, Send, Clock, User } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDateTime, timeAgo, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [alert, setAlert] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

  const fetchAlert = () => {
    setLoading(true)
    api.get(`/alerts/${id}`)
      .then(res => setAlert(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load alert'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAlert() }, [id])

  const handleAction = async (action: string) => {
    setActionLoading(action)
    try {
      await api.post(`/alerts/${id}/${action}`)
      fetchAlert()
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${action}`)
    } finally {
      setActionLoading('')
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/alerts/${id}/notes`, { content: noteText })
      setNoteText('')
      fetchAlert()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && !alert) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>
  if (!alert) return <div className="flex items-center justify-center h-full text-slate-400">Alert not found</div>

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/alerts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} /> Back to Alerts
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">{alert.alert_number || `Alert #${id}`}</h1>
              <Badge text={alert.priority || '-'} colors={priorityColors[alert.priority] || 'bg-gray-100 text-gray-800'} />
              <Badge text={alert.status || '-'} colors={statusColors[alert.status] || 'bg-gray-100 text-gray-800'} />
            </div>
            <p className="text-slate-600 mt-1">{alert.title}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> Created {formatDateTime(alert.created_at)}</span>
              {alert.assigned_to_name && (
                <span className="flex items-center gap-1"><User size={12} /> {alert.assigned_to_name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alert.risk_score != null && (
              <div className="text-center px-4">
                <div className="text-2xl font-bold" style={{ color: alert.risk_score >= 75 ? '#ef4444' : alert.risk_score >= 50 ? '#f97316' : alert.risk_score >= 25 ? '#f59e0b' : '#10b981' }}>
                  {alert.risk_score}
                </div>
                <div className="text-xs text-slate-400">Risk Score</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column - details */}
        <div className="xl:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{alert.description || 'No description provided.'}</p>
          </div>

          {/* Trigger Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Trigger Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Rule', alert.rule_name || alert.triggered_rule || '-'],
                ['Alert Type', (alert.alert_type || alert.type || '-').replace(/_/g, ' ')],
                ['Category', alert.category || '-'],
                ['Score at Trigger', alert.risk_score_at_trigger ?? alert.risk_score ?? '-'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {alert.trigger_details && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <pre className="text-xs text-slate-600 whitespace-pre-wrap">{typeof alert.trigger_details === 'string' ? alert.trigger_details : JSON.stringify(alert.trigger_details, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Linked Transaction */}
          {(alert.transaction || alert.transaction_id) && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Linked Transaction</h3>
              {alert.transaction ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['Reference', alert.transaction.reference_number || alert.transaction.id],
                    ['Amount', formatINR(alert.transaction.amount)],
                    ['Channel', (alert.transaction.channel || '-').replace(/_/g, ' ')],
                    ['Date', formatDateTime(alert.transaction.transaction_date || alert.transaction.created_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Transaction ID: {alert.transaction_id}</p>
              )}
            </div>
          )}

          {/* Customer Info */}
          {(alert.customer || alert.customer_name) && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{alert.customer?.full_name || alert.customer_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{alert.customer?.customer_number || alert.customer_id}</p>
                </div>
                {alert.customer_id && (
                  <Link to={`/customers/${alert.customer_id}/360`} className="text-sm text-blue-600 hover:underline">
                    View Customer 360
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Notes & Activity</h3>
            <div className="space-y-3">
              {(alert.notes || []).map((note: any, i: number) => (
                <div key={note.id || i} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{note.author_name || note.created_by || 'System'}</span>
                    <span className="text-xs text-slate-400">{note.created_at ? timeAgo(note.created_at) : ''}</span>
                  </div>
                  <p className="text-sm text-slate-600">{note.content || note.text}</p>
                </div>
              ))}
              {(!alert.notes || alert.notes.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
              )}
            </div>

            {/* Add note form */}
            <form onSubmit={handleAddNote} className="mt-4 flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={submitting || !noteText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send size={14} /> Add
              </button>
            </form>
          </div>
        </div>

        {/* Right column - actions */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleAction('assign')}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                <UserPlus size={16} />
                {actionLoading === 'assign' ? 'Assigning...' : 'Assign to Me'}
              </button>
              <button
                onClick={() => handleAction('escalate')}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <AlertTriangle size={16} />
                {actionLoading === 'escalate' ? 'Escalating...' : 'Escalate'}
              </button>
              <button
                onClick={() => handleAction('close')}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                {actionLoading === 'close' ? 'Closing...' : 'Close Alert'}
              </button>
            </div>
          </div>

          {/* Alert Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Alert Information</h3>
            <div className="space-y-3">
              {[
                ['Status', alert.status],
                ['Priority', alert.priority],
                ['Assigned To', alert.assigned_to_name || 'Unassigned'],
                ['Created', formatDateTime(alert.created_at)],
                ['Updated', formatDateTime(alert.updated_at)],
                ['Case', alert.case_id ? `Case #${alert.case_id}` : 'No linked case'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-medium text-slate-700">{(value || '-').toString().replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
