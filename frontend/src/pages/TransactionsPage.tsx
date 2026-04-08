import { useState, useEffect, useCallback } from 'react'
import { X, Search, Filter, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDateTime, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const CHANNELS = ['', 'internet_banking', 'mobile_banking', 'branch', 'atm', 'pos', 'upi', 'neft', 'rtgs', 'imps']
const METHODS = ['', 'debit', 'credit', 'transfer', 'cash_deposit', 'cash_withdrawal']

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [channel, setChannel] = useState('')
  const [method, setMethod] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<any>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }
    if (channel) params.channel = channel
    if (method) params.method = method
    if (flaggedOnly) params.flagged = true
    if (search) params.search = search

    api.get('/transactions', { params })
      .then(res => {
        const d = res.data
        setTransactions(d.items || d.data || d.transactions || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load transactions'))
      .finally(() => setLoading(false))
  }, [page, channel, method, flaggedOnly, search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchData()
  }

  const riskColor = (score: number) => {
    if (score >= 75) return '#ef4444'
    if (score >= 50) return '#f97316'
    if (score >= 25) return '#f59e0b'
    return '#10b981'
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filters:</span>
          </div>

          <select
            value={channel}
            onChange={e => { setChannel(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All Channels</option>
            {CHANNELS.filter(Boolean).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>

          <select
            value={method}
            onChange={e => { setMethod(e.target.value); setPage(1) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
          >
            <option value="">All Methods</option>
            {METHODS.filter(Boolean).map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={e => { setFlaggedOnly(e.target.checked); setPage(1) }}
              className="rounded border-slate-300"
            />
            Flagged only
          </label>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by reference or customer..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </div>

          <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* Results info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total.toLocaleString()} transactions found</p>
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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Ref</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Channel</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Method</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk Score</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Flagged</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{t.reference_number || t.id}</td>
                    <td className="py-2.5 px-3 text-slate-700">{t.customer_name || t.customer_id || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(t.channel || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(t.transaction_type || t.method || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatINR(t.amount)}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${t.risk_score || 0}%`, backgroundColor: riskColor(t.risk_score || 0) }} />
                        </div>
                        <span className="text-xs font-mono w-6 text-right">{t.risk_score ?? '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.is_flagged || t.flagged ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Flagged</span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(t.transaction_date || t.created_at)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400">No transactions found</td></tr>
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

      {/* Slide-over panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Transaction Details</h2>
              <button onClick={() => setSelected(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Reference', selected.reference_number || selected.id],
                  ['Customer', selected.customer_name || selected.customer_id],
                  ['Channel', (selected.channel || '-').replace(/_/g, ' ')],
                  ['Method', (selected.transaction_type || selected.method || '-').replace(/_/g, ' ')],
                  ['Amount', formatINR(selected.amount)],
                  ['Currency', selected.currency || 'INR'],
                  ['Risk Score', selected.risk_score ?? '-'],
                  ['Flagged', selected.is_flagged || selected.flagged ? 'Yes' : 'No'],
                  ['Status', selected.status || '-'],
                  ['Date', formatDateTime(selected.transaction_date || selected.created_at)],
                  ['Counterparty', selected.counterparty_name || selected.counterparty_account || '-'],
                  ['Location', selected.location || selected.ip_address || '-'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {selected.risk_score != null && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Risk Score</p>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${selected.risk_score}%`, backgroundColor: riskColor(selected.risk_score) }} />
                  </div>
                </div>
              )}

              {selected.risk_factors && selected.risk_factors.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Risk Factors</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.risk_factors.map((f: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.description && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">{selected.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
