import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, User, FileText, Bell, Activity } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, formatINR, timeAgo, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

type Tab = 'summary' | 'alerts' | 'timeline'

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [caseData, setCaseData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('summary')

  useEffect(() => {
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
  }, [id])

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
          <div className="text-right">
            {caseData.total_amount != null && (
              <div>
                <div className="text-lg font-bold text-slate-800">{formatINR(caseData.total_amount)}</div>
                <div className="text-xs text-slate-400">Total Amount</div>
              </div>
            )}
          </div>
        </div>
      </div>

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
                    event.event_type === 'created' ? 'bg-blue-100 text-blue-600' :
                    event.event_type === 'escalated' ? 'bg-orange-100 text-orange-600' :
                    event.event_type === 'closed' ? 'bg-green-100 text-green-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    <Activity size={14} />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">{event.description || event.title || event.event_type || 'Activity'}</p>
                      <span className="text-xs text-slate-400">{event.created_at ? timeAgo(event.created_at) : ''}</span>
                    </div>
                    {event.details && <p className="text-xs text-slate-500 mt-1">{event.details}</p>}
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
    </div>
  )
}
