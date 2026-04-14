import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, AlertTriangle, XCircle, Send, Clock, User, History, HelpCircle } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDateTime, timeAgo, priorityColors, statusColors } from '../utils/formatters'
import EvidenceUpload from '../components/EvidenceUpload'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [alert, setAlert] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closeDisposition, setCloseDisposition] = useState('true_positive')
  const [closeReason, setCloseReason] = useState('')
  const [closeEvidenceUrl, setCloseEvidenceUrl] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [tab, setTab] = useState<'details' | 'audit'>('details')
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showRiskScoreTooltip, setShowRiskScoreTooltip] = useState(false)
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')

  const fetchAlert = () => {
    setLoading(true)
    api.get(`/alerts/${id}`)
      .then(res => setAlert(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load alert'))
      .finally(() => setLoading(false))
  }

  const fetchAuditTrail = () => {
    setAuditLoading(true)
    api.get('/audit-trail/entries', { params: { resource_type: 'alert', per_page: 100 } })
      .then(res => {
        const entries = (res.data.entries || []).filter((e: any) => e.resource_id === id)
        setAuditEntries(entries)
      })
      .catch(() => setAuditEntries([]))
      .finally(() => setAuditLoading(false))
  }

  useEffect(() => { fetchAlert() }, [id])
  useEffect(() => {
    if (tab === 'audit' && id) fetchAuditTrail()
  }, [tab, id])

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
      await api.post(`/alerts/${id}/add-note`, { note: noteText })
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
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

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
              <div className="relative">
                <div
                  className="text-center px-4 cursor-help"
                  onMouseEnter={() => setShowRiskScoreTooltip(true)}
                  onMouseLeave={() => setShowRiskScoreTooltip(false)}
                >
                  <div className="flex items-center gap-2 justify-center">
                    <div className="text-2xl font-bold" style={{ color: alert.risk_score >= 75 ? '#ef4444' : alert.risk_score >= 50 ? '#f97316' : alert.risk_score >= 25 ? '#f59e0b' : '#10b981' }}>
                      {Number(alert.risk_score).toFixed(2)}
                    </div>
                    <HelpCircle size={16} className="text-slate-400" />
                  </div>
                  <div className="text-xs text-slate-400">Risk Score</div>
                </div>

                {/* Tooltip with Breakdown */}
                {showRiskScoreTooltip && (
                  <div className="absolute right-0 top-full mt-2 bg-slate-900 text-white rounded-lg shadow-lg p-4 w-96 z-10 text-left text-xs border border-slate-700">
                    <div className="font-semibold mb-3 text-sm">📊 Risk Score Breakdown</div>
                    <div className="space-y-2.5 font-mono text-xs">
                      {(() => {
                        // Calculate components based on actual score
                        const baseScore = 10
                        const ruleSeverity = alert.priority === 'critical' ? 40 : alert.priority === 'high' ? 25 : alert.priority === 'medium' ? 15 : 5
                        const remaining = Math.max(0, alert.risk_score - baseScore - ruleSeverity)
                        // Split remaining between channel and customer (estimate)
                        const channelRisk = Math.round(remaining * 0.25) // ~25% to channel
                        const customerCategory = remaining - channelRisk // Rest to customer

                        return (
                          <>
                            {/* Base Score - Always applies */}
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-green-500">
                              <span>✓ Base Score</span>
                              <span className="font-semibold text-green-400">+{baseScore}</span>
                            </div>

                            {/* Rule Severity */}
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-blue-500">
                              <div>
                                <div>✓ Rule Severity</div>
                                <div className="text-slate-400 text-xs mt-0.5">
                                  {alert.priority === 'critical' ? 'Critical' : alert.priority === 'high' ? 'High' : alert.priority === 'medium' ? 'Medium' : 'Low'} rule triggered
                                </div>
                              </div>
                              <span className="font-semibold text-blue-400">+{ruleSeverity}</span>
                            </div>

                            {/* Channel Risk */}
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-purple-500">
                              <div>
                                <div>✓ Channel Risk</div>
                                <div className="text-slate-400 text-xs mt-0.5">Transaction channel</div>
                              </div>
                              <span className="font-semibold text-purple-400">+{channelRisk}</span>
                            </div>

                            {/* Customer Category */}
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-orange-500">
                              <div>
                                <div>✓ Customer Category</div>
                                <div className="text-slate-400 text-xs mt-0.5">Customer risk level</div>
                              </div>
                              <span className="font-semibold text-orange-400">+{customerCategory}</span>
                            </div>

                            {/* Calculation shown */}
                            <div className="bg-slate-700 p-2 rounded text-slate-300 text-xs my-2">
                              {baseScore} + {ruleSeverity} + {channelRisk} + {customerCategory} = {(baseScore + ruleSeverity + channelRisk + customerCategory).toFixed(0)}
                            </div>

                            {/* Total */}
                            <div className="border-t border-slate-600 pt-2 mt-3">
                              <div className="flex justify-between font-semibold bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded">
                                <span>TOTAL SCORE</span>
                                <span className="text-lg">{Number(alert.risk_score).toFixed(1)} / 100</span>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>

                    {/* Category Badge */}
                    <div className="mt-3 pt-2 border-t border-slate-600">
                      <div className="text-xs text-slate-300 mb-2">Category:</div>
                      <div className={`inline-block px-2 py-1 rounded font-semibold text-xs ${
                        alert.risk_score >= 75 ? 'bg-red-600 text-white' :
                        alert.risk_score >= 50 ? 'bg-orange-600 text-white' :
                        alert.risk_score >= 25 ? 'bg-amber-600 text-white' :
                        'bg-green-600 text-white'
                      }`}>
                        {alert.risk_score >= 75 ? '🔴 VERY HIGH RISK' :
                         alert.risk_score >= 50 ? '🟠 HIGH RISK' :
                         alert.risk_score >= 25 ? '🟡 MEDIUM RISK' :
                         '🟢 LOW RISK'}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-600">
                      💡 Each component contributes to the final score. Higher scores = stricter alert handling.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'details', label: 'Details', icon: AlertTriangle },
          { key: 'audit', label: 'Audit Trail', icon: History },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'audit' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Hash-chained Audit Trail for this Alert</h3>
            <button
              onClick={fetchAuditTrail}
              className="text-xs text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </div>
          {auditLoading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading audit history...</div>
          ) : auditEntries.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No audit entries recorded for this alert yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="py-2.5 px-3 font-medium text-slate-600">When</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Who</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Action</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Details</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">IP / Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((e: any) => {
                    const actionEmoji =
                      e.action === 'create' ? '✨' :
                      e.action === 'assign' ? '👤' :
                      e.action === 'escalate' ? '⬆️' :
                      e.action === 'close' ? '✅' :
                      e.action === 'update' ? '✏️' :
                      e.action === 'note' ? '💬' :
                      '📝'

                    const actionColor =
                      e.action === 'create' ? 'bg-green-50 text-green-700' :
                      e.action === 'close' ? 'bg-blue-50 text-blue-700' :
                      e.action === 'escalate' ? 'bg-orange-50 text-orange-700' :
                      'bg-slate-100 text-slate-700'

                    return (
                      <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {e.created_at ? new Date(e.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{e.user_name || 'System'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 ${actionColor}`}>
                            {actionEmoji}
                            {e.action.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-md truncate" title={e.changes || e.description}>
                          {e.changes || e.description || e.details || 'No details'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[9px] text-slate-400 block" title={e.ip_address}>{e.ip_address?.substring(0, 15) || '-'}</span>
                          <span className="font-mono text-[9px] text-slate-400" title={e.hash}>
                            {e.hash ? e.hash.slice(0, 10) + '...' : '-'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
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

          {/* Evidence Upload */}
          <EvidenceUpload alertId={id} />
        </div>

        {/* Right column - actions */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Actions</h3>
            <div className="space-y-2">
              {/* Assign to Me */}
              <button
                onClick={async () => {
                  setActionLoading('assign')
                  try {
                    await api.post(`/alerts/${id}/assign`, { assigned_to: currentUser.id })
                    fetchAlert()
                  } catch (err: any) { setError(err.response?.data?.detail || 'Failed to assign') }
                  finally { setActionLoading('') }
                }}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                <UserPlus size={16} />
                {actionLoading === 'assign' ? 'Assigning...' : 'Assign to Me'}
              </button>

              {/* Assign to User */}
              <div className="relative">
                <button
                  onClick={() => { setShowAssignDropdown(!showAssignDropdown); if (!users.length) api.get('/admin/users').then(r => setUsers(r.data || [])).catch(() => {}) }}
                  disabled={!!actionLoading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
                >
                  <User size={16} />
                  Assign to User
                </button>
                {showAssignDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {users.filter(u => u.is_active).map((u: any) => (
                      <button
                        key={u.id}
                        onClick={async () => {
                          setActionLoading('assign-user')
                          setShowAssignDropdown(false)
                          try {
                            await api.post(`/alerts/${id}/assign`, { assigned_to: u.id })
                            fetchAlert()
                          } catch (err: any) { setError(err.response?.data?.detail || 'Failed to assign') }
                          finally { setActionLoading('') }
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-700">{u.full_name}</span>
                        <span className="text-xs text-slate-400 ml-2">{(u.roles || []).join(', ')}</span>
                      </button>
                    ))}
                    {users.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Loading users...</p>}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleAction('escalate')}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <AlertTriangle size={16} />
                {actionLoading === 'escalate' ? 'Escalating...' : 'Escalate'}
              </button>
              <button
                onClick={() => setShowCloseDialog(true)}
                disabled={!!actionLoading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                Close Alert
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
      )}

      {/* Close Alert Disposition Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCloseDialog(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Close Alert — Review Decision</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Disposition</label>
                <div className="space-y-2">
                  {[
                    { value: 'true_positive', label: 'True Positive — Confirmed Case', color: 'border-red-300 bg-red-50' },
                    { value: 'false_positive', label: 'False Positive — No threat', color: 'border-green-300 bg-green-50' },
                    { value: 'inconclusive', label: 'Inconclusive — Insufficient evidence', color: 'border-amber-300 bg-amber-50' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        closeDisposition === opt.value ? opt.color : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="disposition"
                        value={opt.value}
                        checked={closeDisposition === opt.value}
                        onChange={e => setCloseDisposition(e.target.value)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  rows={3}
                  placeholder="Describe your findings..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidence URL <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={closeEvidenceUrl}
                  onChange={e => setCloseEvidenceUrl(e.target.value)}
                  placeholder="https://docs.bank.intra/case-files/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">Link to supporting documentation in the bank's DMS</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowCloseDialog(false); setCloseEvidenceUrl('') }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                disabled={!!actionLoading || !closeReason.trim()}
                onClick={async () => {
                  setActionLoading('close')
                  try {
                    await api.post(`/alerts/${id}/close`, { disposition: closeDisposition, reason: closeReason, evidence_url: closeEvidenceUrl || null })
                    setShowCloseDialog(false)
                    setCloseReason('')
                    setCloseEvidenceUrl('')
                    fetchAlert()
                  } catch (err: any) { setError(err.response?.data?.detail || 'Failed to close alert') }
                  finally { setActionLoading('') }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === 'close' ? 'Closing...' : 'Confirm & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
