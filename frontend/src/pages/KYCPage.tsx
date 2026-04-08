import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Shield } from 'lucide-react'
import api from '../config/api'
import { formatDate, statusColors, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function KYCPage() {
  const [reviews, setReviews] = useState<any[]>([])
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

    api.get('/kyc/reviews', { params })
      .then(res => {
        const d = res.data
        setReviews(d.items || d.data || d.reviews || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load KYC reviews'))
      .finally(() => setLoading(false))
  }, [page, tab, search])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
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

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search KYC reviews..."
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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Review Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk Assessment</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Due Date</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Reviewer</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div>
                        <Link to={`/customers/${r.customer_id}/360`} className="text-blue-600 hover:underline font-medium text-sm">
                          {r.customer_name || r.customer_id}
                        </Link>
                        {r.customer_number && <p className="text-xs text-slate-400 font-mono">{r.customer_number}</p>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(r.review_type || r.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.risk_assessment || r.risk_category || '-'} colors={riskColors[r.risk_assessment || r.risk_category] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.status || '-'} colors={statusColors[r.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(r.due_date)}
                      {r.due_date && new Date(r.due_date) < new Date() && r.status !== 'approved' && r.status !== 'rejected' && (
                        <span className="ml-1 text-red-500 font-medium">Overdue</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.reviewer_name || r.reviewer || r.assigned_to || '-'}</td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No KYC reviews found</td></tr>
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
