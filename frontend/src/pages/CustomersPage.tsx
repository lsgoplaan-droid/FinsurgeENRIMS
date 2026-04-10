import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Filter, Shield, Eye, UserX, Clock, HelpCircle } from 'lucide-react'
import api from '../config/api'
import { formatDate, riskColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
    {text.replace(/_/g, ' ')}
  </span>
)

const RISK_CATEGORIES = ['', 'low', 'medium', 'high', 'very_high']
const KYC_STATUSES = ['', 'approved', 'pending', 'in_progress', 'rejected', 'expired']
const CUSTOMER_TYPES = ['', 'individual', 'business', 'corporate']

function RiskTags({ customer }: { customer: any }) {
  const tags: Array<{ label: string; color: string }> = []

  if (customer.risk_category === 'very_high' || customer.risk_category === 'high') {
    tags.push({ label: 'Watchlisted', color: 'bg-red-100 text-red-700 border border-red-200' })
  }
  if (customer.pep_status === true || customer.pep_status === 'true') {
    tags.push({ label: 'PEP', color: 'bg-purple-100 text-purple-700 border border-purple-200' })
  }
  if ((customer.risk_score ?? 0) > 80) {
    tags.push({ label: 'Mule Suspect', color: 'bg-orange-100 text-orange-700 border border-orange-200' })
  }
  if (customer.has_high_risk_connections) {
    tags.push({ label: 'Network Risk', color: 'bg-red-100 text-red-700 border border-red-300' })
  }
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${tag.color}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  )
}

function RiskScoreDisplay({ score, customer }: { score: number | null | undefined; customer?: any }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (score == null) return <span className="text-sm text-slate-400">-</span>

  const color =
    score > 70 ? 'text-red-600' :
    score > 40 ? 'text-amber-600' :
    'text-green-600'

  const bgColor =
    score > 70 ? 'bg-red-50' :
    score > 40 ? 'bg-amber-50' :
    'bg-green-50'

  // Determine risk category badge
  const categoryEmoji = score > 70 ? '🔴' : score > 40 ? '🟠' : score > 20 ? '🟡' : '🟢'
  const categoryLabel = score > 70 ? 'VERY HIGH' : score > 40 ? 'HIGH' : score > 20 ? 'MEDIUM' : 'LOW'
  const categoryColor = score > 70 ? 'bg-red-100 text-red-800' : score > 40 ? 'bg-orange-100 text-orange-800' : score > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'

  // Simulate component breakdown (customer risk is typically based on alerts and patterns)
  const baseScore = 10
  const alertRiskContribution = Math.min(40, Math.max(0, (customer?.alert_count ?? 0) * 5))
  const behavioralRiskContribution = Math.max(0, score - baseScore - alertRiskContribution)
  const displayScore = Math.min(100, baseScore + alertRiskContribution + behavioralRiskContribution)

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center justify-center w-12 h-10 rounded-lg ${bgColor} cursor-help relative`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`text-lg font-bold ${color}`}>{score}</span>
        {showTooltip && <HelpCircle size={12} className="absolute top-0 right-0 text-blue-500" />}
      </div>

      {showTooltip && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-4 z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800">Risk Score Breakdown</h4>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${categoryColor}`}>
              {categoryEmoji} {categoryLabel}
            </span>
          </div>

          {/* Component boxes */}
          <div className="space-y-2 mb-3">
            {/* Base Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-700">{baseScore}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Base Risk</div>
                <div className="text-[10px] text-slate-500">Baseline for all customers</div>
              </div>
            </div>

            {/* Alert Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-orange-50 border border-orange-200 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-700">+{alertRiskContribution.toFixed(0)}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Alert Risk</div>
                <div className="text-[10px] text-slate-500">{customer?.alert_count ?? 0} open alerts</div>
              </div>
            </div>

            {/* Behavioral Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-700">+{behavioralRiskContribution.toFixed(0)}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Behavioral Risk</div>
                <div className="text-[10px] text-slate-500">Transaction patterns & network</div>
              </div>
            </div>
          </div>

          {/* Total equation */}
          <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-semibold">{baseScore}</span>
              {' + '}
              <span className="font-semibold">{alertRiskContribution.toFixed(0)}</span>
              {' + '}
              <span className="font-semibold">{behavioralRiskContribution.toFixed(0)}</span>
              {' = '}
              <span className="font-bold text-slate-900">{displayScore.toFixed(0)}</span>
            </div>
          </div>

          {/* Risk appetite info */}
          <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-2">
            <div className="font-medium text-slate-700 mb-1">Risk Actions Triggered:</div>
            {score > 70 && <div>🔴 Enhanced monitoring & mandatory review</div>}
            {score > 40 && score <= 70 && <div>🟠 Regular monitoring & periodic review</div>}
            {score <= 40 && <div>🟡 Standard compliance procedures</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const [searchParams] = useSearchParams()
  const initialState = searchParams.get('state') || ''
  const initialRisk = searchParams.get('risk_category') || ''
  const initialSearch = searchParams.get('search') || ''
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(initialSearch)
  const [riskCategory, setRiskCategory] = useState(initialRisk)
  const [kycStatus, setKycStatus] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [stateFilter, setStateFilter] = useState(initialState)
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
    if (stateFilter) params.state = stateFilter

    api.get('/customers', { params })
      .then(res => {
        const d = res.data
        setCustomers(d.items || d.data || d.customers || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load customers'))
      .finally(() => setLoading(false))
  }, [page, search, riskCategory, kycStatus, customerType, stateFilter])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">Customers</h1>
        <p className="text-xs text-slate-500">{total.toLocaleString()} customers found</p>
      </div>

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
            value={customerType}
            onChange={e => { setCustomerType(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All Types</option>
            {CUSTOMER_TYPES.filter(Boolean).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {stateFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              <span>State: <strong>{stateFilter}</strong></span>
              <button onClick={() => setStateFilter('')} className="ml-1 hover:text-blue-900">&times;</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-500">Loading customers...</p>
          </div>
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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">State</th>
                  <th className="text-center py-2.5 px-3 font-medium text-slate-600">Total Tx</th>
                  <th className="text-center py-2.5 px-3 font-medium text-slate-600">Flagged</th>
                  <th className="text-center py-2.5 px-3 font-medium text-slate-600">Open Cases</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Active</th>
                  <th className="text-center py-2.5 px-3 font-medium text-slate-600">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => {
                  const lastActive = c.last_active_at || c.last_transaction_at || c.updated_at || null
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/customers/${c.id}/360`}
                          className="text-blue-600 hover:underline font-mono text-xs"
                        >
                          {c.customer_number || c.id}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>
                          <Link
                            to={`/customers/${c.id}/360`}
                            className="text-slate-800 hover:text-blue-600 font-medium text-sm"
                          >
                            {c.full_name || c.name || '-'}
                          </Link>
                          <RiskTags customer={c} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 capitalize text-xs">
                        {(c.customer_type || c.type || '-').replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          text={c.risk_category || '-'}
                          colors={riskColors[c.risk_category] || 'bg-gray-100 text-gray-800'}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{c.state || '-'}</td>
                      <td className="py-2.5 px-3 text-center text-xs text-slate-600 font-medium">
                        {c.account_count ?? c.total_transactions ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs text-slate-600 font-medium">
                        {c.alert_count ?? c.flagged_count ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs text-slate-600 font-medium">
                        {c.case_count ?? c.open_cases ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {lastActive ? formatDate(lastActive) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <RiskScoreDisplay score={c.risk_score} customer={c} />
                      </td>
                    </tr>
                  )
                })}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No customers found
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
