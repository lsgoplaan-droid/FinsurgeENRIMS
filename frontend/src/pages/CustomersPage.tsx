import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import api from '../config/api'
import { riskColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const RISK_CATEGORIES = ['', 'low', 'medium', 'high', 'very_high']
const KYC_STATUSES = ['', 'approved', 'pending', 'in_progress', 'rejected', 'expired']
const CUSTOMER_TYPES = ['', 'individual', 'business', 'corporate']

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [riskCategory, setRiskCategory] = useState('')
  const [kycStatus, setKycStatus] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }
    if (search) params.search = search
    if (riskCategory) params.risk_category = riskCategory
    if (kycStatus) params.kyc_status = kycStatus
    if (customerType) params.customer_type = customerType

    api.get('/customers', { params })
      .then(res => {
        const d = res.data
        setCustomers(d.items || d.data || d.customers || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load customers'))
      .finally(() => setLoading(false))
  }, [page, search, riskCategory, kycStatus, customerType])

  useEffect(() => { fetchData() }, [fetchData])

  const riskColor = (score: number) => {
    if (score >= 75) return '#ef4444'
    if (score >= 50) return '#f97316'
    if (score >= 25) return '#f59e0b'
    return '#10b981'
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search by name, customer number, or ID..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
          </div>

          <select
            value={riskCategory}
            onChange={e => { setRiskCategory(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All Risk</option>
            {RISK_CATEGORIES.filter(Boolean).map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={kycStatus}
            onChange={e => { setKycStatus(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All KYC</option>
            {KYC_STATUSES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            value={customerType}
            onChange={e => { setCustomerType(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All Types</option>
            {CUSTOMER_TYPES.filter(Boolean).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">{total.toLocaleString()} customers found</p>

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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk Category</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk Score</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">KYC Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">City</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <Link to={`/customers/${c.id}/360`} className="text-blue-600 hover:underline font-mono text-xs">{c.customer_number || c.id}</Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <Link to={`/customers/${c.id}/360`} className="text-slate-800 hover:text-blue-600 font-medium">{c.full_name || c.name || '-'}</Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(c.customer_type || c.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={c.risk_category || '-'} colors={riskColors[c.risk_category] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.risk_score || 0}%`, backgroundColor: riskColor(c.risk_score || 0) }} />
                        </div>
                        <span className="text-xs font-mono w-6 text-right">{c.risk_score ?? '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={c.kyc_status || '-'} colors={statusColors[c.kyc_status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{c.city || '-'}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
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
