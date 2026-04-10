import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, Search, Clock, AlertTriangle } from 'lucide-react'
import api from '../config/api'
import { formatDate, formatINR, timeAgo, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
    {text.replace(/_/g, ' ')}
  </span>
)

const TABS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'closed_true_positive', label: 'Closed' },
]

function RiskScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-slate-400">-</span>
  const rounded = Math.round(score * 100) / 100
  const color =
    score > 70 ? 'text-red-700 bg-red-100 border border-red-200' :
    score > 40 ? 'text-amber-700 bg-amber-100 border border-amber-200' :
    'text-green-700 bg-green-100 border border-green-200'
  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-bold ${color}`}>
      {rounded.toFixed(2)}
    </span>
  )
}

function SlaCountdown({ slaDueAt }: { slaDueAt: string | null | undefined }) {
  if (!slaDueAt) return <span className="text-xs text-slate-400">-</span>

  const now = Date.now()
  const due = new Date(slaDueAt).getTime()
  const diff = due - now
  const isOverdue = diff < 0
  const absDiff = Math.abs(diff)

  const totalMinutes = Math.floor(absDiff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  let display: string
  if (hours > 0) {
    display = `${hours}h ${minutes}m`
  } else {
    display = `${minutes}m`
  }

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <Clock size={10} />
        OVERDUE {display}
      </span>
    )
  }

  const isUrgent = diff < 3600000 // less than 1 hour
  const colorClass = isUrgent
    ? 'bg-amber-100 text-amber-700'
    : 'bg-green-100 text-green-700'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      <Clock size={10} />
      {display}
    </span>
  )
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [priorityCounts, setPriorityCounts] = useState<Record<string, number>>({})
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showClose, setShowClose] = useState<string | null>(null)
  const [closeDisposition, setCloseDisposition] = useState('closed_false_positive')
  const [closeJustification, setCloseJustification] = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }
    if (tab) params.status = tab
    if (search) params.search = search
    if (priorityFilter) params.priority = priorityFilter

    api.get('/alerts', { params })
      .then(res => {
        const d = res.data
        setAlerts(d.items || d.data || d.alerts || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
        if (d.priority_counts) setPriorityCounts(d.priority_counts)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load alerts'))
      .finally(() => setLoading(false))
  }, [page, tab, search, priorityFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    api.get('/alerts', { params: { page: 1, page_size: 1 } })
      .then(res => {
        if (res.data.priority_counts) setPriorityCounts(res.data.priority_counts)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Alerts</h1>
          <p className="text-xs text-slate-500">{total} total alerts in system</p>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {Object.keys(priorityCounts).length > 0 && (
        <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-3 px-5">
          {Object.entries(priorityCounts).map(([priority, count]) => (
            <div key={priority} className="flex items-center gap-2">
              <Badge text={priority} colors={priorityColors[priority] || 'bg-gray-100 text-gray-800'} />
              <span className="text-sm font-semibold text-slate-700">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by alert#, customer, title..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </div>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white">
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Close Alert Modal */}
      {showClose && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Close Alert</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disposition</label>
                <select value={closeDisposition} onChange={e => setCloseDisposition(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="closed_true_positive">Confirmed Fraud (True Positive) → Create Case</option>
                  <option value="closed_false_positive">False Alarm (False Positive)</option>
                  <option value="closed_inconclusive">Inconclusive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Justification <span className="text-red-500">*</span></label>
                <textarea value={closeJustification} onChange={e => setCloseJustification(e.target.value)} rows={3} placeholder="Provide justification for closure..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowClose(null); setCloseJustification('') }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                disabled={!closeJustification.trim()}
                onClick={() => {
                  api.put(`/alerts/${showClose}/status`, { status: closeDisposition, notes: closeJustification })
                    .then(() => {
                      if (closeDisposition === 'closed_true_positive') {
                        navigate(`/cases?from_alert=${showClose}`)
                      }
                      setShowClose(null)
                      setCloseJustification('')
                      fetchData()
                    })
                    .catch(() => {})
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {closeDisposition === 'closed_true_positive' ? 'Close & Create Case' : 'Close Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading alerts...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[170px]">Alert#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[75px]">Priority</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[120px]">Customer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Title</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[110px]">Assigned To</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600 w-[100px]">Amount</th>
                  <th className="text-center py-2.5 px-3 font-medium text-slate-600 w-[70px]">Risk</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[150px]">SLA</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[145px]">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[95px]"></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Link to={`/alerts/${a.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {a.alert_number || a.id}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={a.priority || '-'} colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs truncate">{a.customer_name || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs truncate">{a.title || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs truncate">{a.assignee_name || '-'}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-mono text-slate-700">
                      {(() => { try { const d = typeof a.details === 'string' ? JSON.parse(a.details) : a.details; return d?.triggered_values?.amount ? formatINR(d.triggered_values.amount) : '-' } catch { return '-' } })()}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <RiskScoreBadge score={a.risk_score} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SlaCountdown slaDueAt={a.sla_due_at} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge text={a.status || '-'} colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {a.status === 'new' ? (
                          <button
                            onClick={() => navigate(`/alerts/${a.id}`)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Investigate
                          </button>
                        ) : a.case_id ? (
                          <Link to={`/cases/${a.case_id}`} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md hover:bg-indigo-100 transition-colors inline-block">
                            Case&rarr;
                          </Link>
                        ) : a.status?.startsWith('closed') ? (
                          <span className="px-2.5 py-1 bg-slate-50 text-slate-500 text-xs rounded-md">{a.status.includes('true') ? 'Confirmed' : a.status.includes('false') ? 'False Alarm' : 'Closed'}</span>
                        ) : (
                          <>
                            <button
                              onClick={() => navigate(`/alerts/${a.id}`)}
                              className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md hover:bg-slate-200 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setShowClose(a.id)}
                              className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-100 transition-colors"
                            >
                              Close
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No alerts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              if (p > totalPages) return null
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
