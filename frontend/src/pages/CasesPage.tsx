import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react'
import api from '../config/api'
import { formatDate, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_investigation', label: 'Under Investigation' },
  { key: 'pending_regulatory', label: 'Pending Regulatory' },
  { key: 'closed_true_positive', label: 'Closed (TP)' },
  { key: 'closed_false_positive', label: 'Closed (FP)' },
]

export default function CasesPage() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }
    if (tab) params.status = tab
    if (search) params.search = search

    api.get('/cases', { params })
      .then(res => {
        const d = res.data
        setCases(d.items || d.data || d.cases || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load cases'))
      .finally(() => setLoading(false))
  }, [page, tab, search])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
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

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search cases..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Case#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Investigator</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Alerts</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline font-mono text-xs">{c.case_number || c.id}</Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(c.case_type || c.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={c.priority || '-'} colors={priorityColors[c.priority] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{c.customer_name || c.customer_id || '-'}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={c.status || '-'} colors={statusColors[c.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{c.investigator_name || c.assigned_to_name || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{c.alert_count ?? c.alerts_count ?? '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400">No cases found</td></tr>
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
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
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
