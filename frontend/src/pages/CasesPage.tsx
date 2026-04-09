import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Search, Plus, Briefcase,
  AlertTriangle, FileText, Clock
} from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDate, priorityColors, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
    {text.replace(/_/g, ' ')}
  </span>
)

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_investigation', label: 'Under Investigation' },
  { key: 'pending_regulatory', label: 'Pending Regulatory' },
  { key: 'closed_true_positive', label: 'Closed (TP)' },
  { key: 'closed_false_positive', label: 'Closed (FP)' },
]

function CaseCard({ caseItem }: { caseItem: any }) {
  const c = caseItem
  const description = c.description || c.summary || ''
  const alertCount = c.alert_count ?? c.alerts_count ?? 0
  const txnCount = c.transaction_count ?? c.txn_count ?? 0
  const amount = c.total_suspicious_amount ?? c.amount_at_risk ?? 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col hover:shadow-md transition-shadow">
      {/* Top badges */}
      <div className="flex items-center gap-2 mb-3">
        <Badge
          text={c.status || '-'}
          colors={statusColors[c.status] || 'bg-gray-100 text-gray-800'}
        />
        <Badge
          text={c.priority || '-'}
          colors={priorityColors[c.priority] || 'bg-gray-100 text-gray-800'}
        />
      </div>

      {/* Title */}
      <Link
        to={`/cases/${c.id}`}
        className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors mb-1 line-clamp-1"
      >
        {c.title || c.case_type?.replace(/_/g, ' ') || 'Untitled Case'}
      </Link>

      {/* Case number + customer */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
        <span className="font-mono">{c.case_number || c.id}</span>
        {(c.customer_name || c.customer_id) && (
          <>
            <span className="text-slate-300">|</span>
            <span>{c.customer_name || c.customer_id}</span>
          </>
        )}
      </div>

      {/* Description truncated */}
      {description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2 flex-1">
          {description}
        </p>
      )}
      {!description && <div className="flex-1" />}

      {/* Bottom row: Amount + Related counts */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-500" />
          <span className="text-xs font-medium text-slate-700">
            {amount > 0 ? formatINR(amount) : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {alertCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText size={10} />
              {alertCount} alert{alertCount !== 1 ? 's' : ''}
            </span>
          )}
          {txnCount > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {txnCount} txn{txnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Created / Investigator */}
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span>{c.investigator_name || c.assigned_to_name || 'Unassigned'}</span>
        <span>{formatDate(c.created_at)}</span>
      </div>
    </div>
  )
}

export default function CasesPage() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [newCase, setNewCase] = useState({ title: '', description: '', case_type: 'fraud_investigation', priority: 'high', customer_id: '' })
  const [customers, setCustomers] = useState<any[]>([])
  const [custSearch, setCustSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 18 }
    if (tab) params.status = tab
    if (search) params.search = search

    api.get('/cases', { params })
      .then(res => {
        const d = res.data
        setCases(d.items || d.data || d.cases || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 18))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load cases'))
      .finally(() => setLoading(false))
  }, [page, tab, search])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Cases</h1>
          <p className="text-xs text-slate-500">{total} cases in system</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); api.get('/customers?page_size=10&risk_category=high').then(r => setCustomers(r.data.items || [])).catch(() => {}) }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Create Case
        </button>
      </div>

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
            placeholder="Search cases by number, customer, or type..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
          />
        </div>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Loading cases...</p>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertTriangle className="text-red-400 mx-auto mb-2" size={24} />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="text-slate-300 mx-auto mb-2" size={32} />
          <p className="text-sm text-slate-400">No cases found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cases.map(c => (
            <CaseCard key={c.id} caseItem={c} />
          ))}
        </div>
      )}

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

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Create New Case</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input value={newCase.title} onChange={e => setNewCase({ ...newCase, title: e.target.value })} placeholder="e.g., AML Investigation - Rajesh Mehta" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={newCase.description} onChange={e => setNewCase({ ...newCase, description: e.target.value })} rows={3} placeholder="Describe the investigation..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Case Type</label>
                  <select value={newCase.case_type} onChange={e => setNewCase({ ...newCase, case_type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="fraud_investigation">Fraud Investigation</option>
                    <option value="aml_investigation">AML Investigation</option>
                    <option value="kyc_review">KYC Review</option>
                    <option value="compliance_review">Compliance Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={newCase.priority} onChange={e => setNewCase({ ...newCase, priority: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if (e.target.value.length > 1) api.get(`/customers?search=${e.target.value}&page_size=5`).then(r => setCustomers(r.data.items || [])).catch(() => {}) }} placeholder="Search customer..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                {customers.length > 0 && !newCase.customer_id && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-32 overflow-auto">
                    {customers.map((c: any) => (
                      <button key={c.id} onClick={() => { setNewCase({ ...newCase, customer_id: c.id }); setCustSearch(c.display_name || `${c.first_name} ${c.last_name}`); setCustomers([]) }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <span className="font-medium">{c.display_name || `${c.first_name} ${c.last_name}`}</span>
                        <span className="text-slate-400 ml-2">{c.customer_number}</span>
                      </button>
                    ))}
                  </div>
                )}
                {newCase.customer_id && <p className="text-xs text-green-600 mt-1">Customer selected: {custSearch}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                disabled={creating || !newCase.title || !newCase.customer_id}
                onClick={() => {
                  setCreating(true)
                  api.post('/cases', newCase)
                    .then(res => { setShowCreate(false); setNewCase({ title: '', description: '', case_type: 'fraud_investigation', priority: 'high', customer_id: '' }); setCustSearch(''); fetchData(); navigate(`/cases/${res.data.id}`) })
                    .catch(() => setError('Failed to create case'))
                    .finally(() => setCreating(false))
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
