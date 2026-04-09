import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronLeft, ChevronRight, Search, Clock, AlertTriangle } from 'lucide-react'
import api from '../config/api'
import { formatDate, timeAgo, priorityColors, statusColors } from '../utils/formatters'

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
  const color =
    score > 70 ? 'text-red-600 bg-red-50' :
    score > 40 ? 'text-amber-600 bg-amber-50' :
    'text-green-600 bg-green-50'
  return (
    <span className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${color}`}>
      {score}
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

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }
    if (tab) params.status = tab
    if (search) params.search = search

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
  }, [page, tab, search])

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

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search alerts..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
          />
        </div>
      </div>

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
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Alert#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Title</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">SLA</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Assignee</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Age</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <Link to={`/alerts/${a.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                        {a.alert_number || a.id}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={a.priority || '-'} colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize text-xs">
                      {(a.alert_type || a.type || '-').replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs">{a.customer_name || a.customer_id || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700 truncate max-w-[200px] text-xs">{a.title || '-'}</td>
                    <td className="py-2.5 px-3">
                      <RiskScoreBadge score={a.risk_score} />
                    </td>
                    <td className="py-2.5 px-3">
                      <SlaCountdown slaDueAt={a.sla_due_at} />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={a.status || '-'} colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs">{a.assigned_to_name || a.assigned_to || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                      {a.created_at ? timeAgo(a.created_at) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => navigate(`/alerts/${a.id}`)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
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
