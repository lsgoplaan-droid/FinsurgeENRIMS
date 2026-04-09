import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, User, FileText, Bell, Activity, ChevronRight, Edit3, UserPlus, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, formatINR, timeAgo, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

type Tab = 'summary' | 'alerts' | 'timeline'

const STATUS_TRANSITIONS: Record<string, { label: string; value: string; color: string }[]> = {
  open: [
    { label: 'Start Investigation', value: 'under_investigation', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Escalate', value: 'escalated', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  assigned: [
    { label: 'Start Investigation', value: 'under_investigation', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Escalate', value: 'escalated', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  under_investigation: [
    { label: 'Pending Regulatory', value: 'pending_regulatory', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
    { label: 'Escalate', value: 'escalated', color: 'bg-orange-600 hover:bg-orange-700 text-white' },
  ],
  escalated: [
    { label: 'Resume Investigation', value: 'under_investigation', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Pending Regulatory', value: 'pending_regulatory', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  ],
  pending_regulatory: [
    { label: 'Resume Investigation', value: 'under_investigation', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  ],
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('summary')
  const [actionLoading, setActionLoading] = useState('')
  const [showDisposition, setShowDisposition] = useState(false)
  const [disposition, setDisposition] = useState('true_positive')
  const [dispositionNotes, setDispositionNotes] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', findings: '', recommendation: '' })

  const fetchCase = () => {
    setLoading(true)
    Promise.all([
      api.get(`/cases/${id}`),
      api.get(`/cases/${id}/alerts`).catch(() => ({ data: [] })),
      api.get(`/cases/${id}/timeline`).catch(() => ({ data: [] })),
    ])
      .then(([caseRes, alertsRes, timelineRes]) => {
        setCaseData(caseRes.data)
        setAlerts(alertsRes.data.items || alertsRes.data.alerts || alertsRes.data || [])
        setTimeline(timelineRes.data.items || timelineRes.data.events || timelineRes.data || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load case'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCase() }, [id])

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus)
    try {
      await api.patch(`/cases/${id}/status`, { status: newStatus })
      fetchCase()
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to update status') }
    finally { setActionLoading('') }
  }

  const handleDisposition = async () => {
    setActionLoading('disposition')
    try {
      await api.post(`/cases/${id}/disposition`, { disposition, notes: dispositionNotes })
      setShowDisposition(false)
      setDispositionNotes('')
      fetchCase()
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to set disposition') }
    finally { setActionLoading('') }
  }

  const handleUpdate = async () => {
    setActionLoading('update')
    const body: any = {}
    if (editForm.title && editForm.title !== caseData.title) body.title = editForm.title
    if (editForm.description !== undefined) body.description = editForm.description
    if (editForm.priority && editForm.priority !== caseData.priority) body.priority = editForm.priority
    if (editForm.findings) body.findings = editForm.findings
    if (editForm.recommendation) body.recommendation = editForm.recommendation
    try {
      await api.put(`/cases/${id}`, body)
      setShowEdit(false)
      fetchCase()
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to update case') }
    finally { setActionLoading('') }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && !caseData) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>
  if (!caseData) return <div className="flex items-center justify-center h-full text-slate-400">Case not found</div>

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'summary', label: 'Summary', icon: FileText },
    { key: 'alerts', label: `Related Alerts (${alerts.length})`, icon: Bell },
    { key: 'timeline', label: 'Timeline', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} /> Back to Cases
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">{caseData.case_number || `Case #${id}`}</h1>
              <Badge text={caseData.priority || '-'} colors={priorityColors[caseData.priority] || 'bg-gray-100 text-gray-800'} />
              <Badge text={caseData.status || '-'} colors={statusColors[caseData.status] || 'bg-gray-100 text-gray-800'} />
            </div>
            <p className="text-slate-600 mt-1 capitalize">{(caseData.case_type || caseData.type || '').replace(/_/g, ' ')}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> Created {formatDateTime(caseData.created_at)}</span>
              {caseData.investigator_name && (
                <span className="flex items-center gap-1"><User size={12} /> {caseData.investigator_name}</span>
              )}
              {caseData.customer_name && (
                <Link to={`/customers/${caseData.customer_id}/360`} className="flex items-center gap-1 text-blue-500 hover:underline">
                  <User size={12} /> {caseData.customer_name}
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status transition buttons */}
            {(STATUS_TRANSITIONS[caseData.status] || []).map(t => (
              <button
                key={t.value}
                onClick={() => handleStatusChange(t.value)}
                disabled={!!actionLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${t.color}`}
              >
                <ChevronRight size={14} />
                {actionLoading === t.value ? 'Updating...' : t.label}
              </button>
            ))}
            {/* Close / Disposition */}
            {!caseData.status?.startsWith('closed') && (
              <button
                onClick={() => setShowDisposition(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <XCircle size={14} /> Close Case
              </button>
            )}
            {/* Edit */}
            <button
              onClick={() => { setEditForm({ title: caseData.title || '', description: caseData.description || '', priority: caseData.priority || '', findings: caseData.findings || '', recommendation: caseData.recommendation || '' }); setShowEdit(true) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Edit3 size={14} /> Edit
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Case Details</h3>
            <div className="space-y-3">
              {[
                ['Case Number', caseData.case_number || id],
                ['Type', (caseData.case_type || caseData.type || '-').replace(/_/g, ' ')],
                ['Priority', caseData.priority],
                ['Status', (caseData.status || '-').replace(/_/g, ' ')],
                ['Investigator', caseData.investigator_name || caseData.assigned_to_name || 'Unassigned'],
                ['Created', formatDateTime(caseData.created_at)],
                ['Updated', formatDateTime(caseData.updated_at)],
                ['Due Date', formatDateTime(caseData.due_date)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-medium text-slate-700 capitalize">{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{caseData.description || 'No description provided.'}</p>
            {caseData.findings && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Findings</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{caseData.findings}</p>
              </div>
            )}
            {caseData.recommendation && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Recommendation</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{caseData.recommendation}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Alert#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Title</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <Link to={`/alerts/${a.id}`} className="text-blue-600 hover:underline font-mono text-xs">{a.alert_number || a.id}</Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={a.priority || '-'} colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{a.title || '-'}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={a.status || '-'} colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDateTime(a.created_at)}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">No related alerts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="relative">
            {timeline.length > 0 && <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />}
            <div className="space-y-6">
              {timeline.map((event, i) => (
                <div key={event.id || i} className="flex gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    event.activity_type === 'created' ? 'bg-blue-100 text-blue-600' :
                    event.activity_type === 'escalated' ? 'bg-orange-100 text-orange-600' :
                    event.activity_type === 'status_changed' ? 'bg-purple-100 text-purple-600' :
                    event.activity_type === 'disposition_set' ? 'bg-green-100 text-green-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Activity size={14} />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">{event.description || event.title || event.activity_type || 'Activity'}</p>
                      <span className="text-xs text-slate-400">{event.created_at ? timeAgo(event.created_at) : ''}</span>
                    </div>
                    {event.old_value && event.new_value && (
                      <p className="text-xs text-slate-500 mt-1">
                        {event.old_value.replace(/_/g, ' ')} → {event.new_value.replace(/_/g, ' ')}
                      </p>
                    )}
                    {event.user_name && <p className="text-xs text-slate-400 mt-1">by {event.user_name}</p>}
                  </div>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No timeline events</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disposition Dialog */}
      {showDisposition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDisposition(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Close Case — Disposition</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Disposition</label>
                <div className="space-y-2">
                  {[
                    { value: 'true_positive', label: 'True Positive — Confirmed fraud/violation', color: 'border-red-300 bg-red-50' },
                    { value: 'false_positive', label: 'False Positive — No threat found', color: 'border-green-300 bg-green-50' },
                    { value: 'inconclusive', label: 'Inconclusive — Insufficient evidence', color: 'border-amber-300 bg-amber-50' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${disposition === opt.value ? opt.color : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="disposition" value={opt.value} checked={disposition === opt.value} onChange={e => setDisposition(e.target.value)} className="accent-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={dispositionNotes} onChange={e => setDispositionNotes(e.target.value)} rows={3} placeholder="Describe your findings..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowDisposition(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button disabled={!!actionLoading || !dispositionNotes.trim()} onClick={handleDisposition} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {actionLoading === 'disposition' ? 'Closing...' : 'Confirm & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Case Dialog */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Edit Case</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Findings</label>
                <textarea value={editForm.findings} onChange={e => setEditForm({ ...editForm, findings: e.target.value })} rows={2} placeholder="Investigation findings..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recommendation</label>
                <textarea value={editForm.recommendation} onChange={e => setEditForm({ ...editForm, recommendation: e.target.value })} rows={2} placeholder="Recommended actions..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button disabled={!!actionLoading} onClick={handleUpdate} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {actionLoading === 'update' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
