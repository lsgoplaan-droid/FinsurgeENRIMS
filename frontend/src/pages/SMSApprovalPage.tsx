import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, Eye,
} from 'lucide-react'
import api from '../config/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SMSApproval {
  id: string
  transaction_ref: string
  customer_id: string
  customer_name: string
  phone_number: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  attempts: number
  sms_content: string | null
  otp_expires_at: string | null
  sms_sent_at: string | null
  resolved_at: string | null
  resolved_by: string | null
  rejection_reason: string | null
  created_at: string
  otp_demo?: string
  // FRIMS second-level approval fields
  frims_approval_required: boolean
  frims_approval_status: string | null        // null | 'pending' | 'approved' | 'rejected'
  frims_approved_by: string | null
  frims_approved_at: string | null
  frims_rejection_reason: string | null
  awaiting_frims_approval: boolean            // computed by backend
}

interface Stats {
  counts: { pending: number; approved: number; rejected: number; expired: number }
  amounts: { pending: number; approved: number; rejected: number; expired: number }
  total_held_inr: number
  frims_pending_approval: number
  frims_threshold_inr: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(paise: number) {
  return `INR ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function countdown(expiresAt: string | null): string {
  if (!expiresAt) return '—'
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  if (diff <= 0) return 'Expired'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  expired:  'bg-slate-100 text-slate-600 border-slate-200',
}

const FRIMS_BADGE: Record<string, string> = {
  pending:  'bg-purple-100 text-purple-800 border-purple-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
}

const THRESHOLDS = [
  { segment: 'High / Very-High Risk',             threshold: 'ALL transactions (INR 0+)' },
  { segment: 'Corporate',                          threshold: 'INR 5,00,000' },
  { segment: 'SME / Trust',                        threshold: 'INR 2,00,000' },
  { segment: 'Retail Premium (income ≥ INR 10L)', threshold: 'INR 1,00,000' },
  { segment: 'Retail Standard',                    threshold: 'INR 50,000 (default)' },
]

// ---------------------------------------------------------------------------
// FRIMS Reject Modal (second-level only, for very high value)
// ---------------------------------------------------------------------------
function FRIMSRejectModal({
  approval,
  onClose,
  onSuccess,
}: {
  approval: SMSApproval
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleReject = () => {
    if (!reason.trim()) { setError('A rejection reason is required for FRIMS-level rejections'); return }
    setLoading(true)
    setError('')
    api.post(`/sms-approvals/${approval.id}/frims-reject`, { reason: reason.trim() })
      .then(() => { onSuccess(); onClose() })
      .catch(err => setError(err?.response?.data?.detail || 'Rejection failed'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-3">
          <XCircle size={20} className="text-red-600" />
          <h2 className="text-lg font-semibold text-slate-800">FRIMS Rejection</h2>
        </div>
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <p className="font-medium mb-1">This will reverse the transaction.</p>
          <p>Transaction {approval.transaction_ref} ({fmt(approval.amount)}) will be cancelled.</p>
        </div>
        <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 space-y-1">
          <div><span className="font-medium">Customer:</span> {approval.customer_name}</div>
          <div><span className="font-medium">Amount:</span> {fmt(approval.amount)}</div>
        </div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Rejection reason (required)</label>
        <textarea
          rows={3}
          placeholder="e.g. Beneficiary flagged in watchlist — AML hold"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3 resize-none"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={handleReject} disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
            {loading ? 'Rejecting…' : 'Reject & Reverse'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SMS Content Preview Modal
// ---------------------------------------------------------------------------
function SMSPreviewModal({ approval, onClose }: { approval: SMSApproval; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-600" />
            SMS Sent to Customer
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-xs leading-relaxed mb-3">
          {approval.sms_content || 'SMS content not available'}
        </div>
        <div className="text-xs text-slate-500 space-y-1">
          <div><span className="font-medium">Sent to:</span> {approval.phone_number}</div>
          <div><span className="font-medium">Sent at:</span> {approval.sms_sent_at ? new Date(approval.sms_sent_at).toLocaleString('en-IN') : '—'}</div>
          <div><span className="font-medium">OTP attempts:</span> {approval.attempts}</div>
          {approval.otp_demo && (
            <div className="mt-2 p-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 flex items-center gap-2">
              <AlertTriangle size={12} />
              Demo OTP: <span className="font-mono font-bold tracking-widest">{approval.otp_demo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SMSApprovalPage() {
  const [approvals, setApprovals] = useState<SMSApproval[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [fRIMSRejectTarget, setFRIMSRejectTarget] = useState<SMSApproval | null>(null)
  const [smsPreviewTarget, setSmsPreviewTarget] = useState<SMSApproval | null>(null)
  const [fRIMSApproving, setFRIMSApproving] = useState<string | null>(null)
  const [thresholdOpen, setThresholdOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const loadData = useCallback((p = page) => {
    setLoading(true)
    const params: any = { page: p, page_size: 20 }
    if (statusFilter) params.status = statusFilter
    Promise.all([
      api.get('/sms-approvals', { params }),
      api.get('/sms-approvals/stats'),
    ])
      .then(([listRes, statsRes]) => {
        setApprovals(listRes.data.items || [])
        setTotalPages(listRes.data.total_pages || 1)
        setTotal(listRes.data.total || 0)
        setStats(statsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const interval = setInterval(() => loadData(), 30_000)
    return () => clearInterval(interval)
  }, [loadData])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleFRIMSApprove = (row: SMSApproval) => {
    if (!confirm(`Grant FRIMS second-level approval for ${row.transaction_ref} (${fmt(row.amount)})?`)) return
    setFRIMSApproving(row.id)
    api.post(`/sms-approvals/${row.id}/frims-approve`)
      .then(() => loadData())
      .catch(err => alert(err?.response?.data?.detail || 'FRIMS approval failed'))
      .finally(() => setFRIMSApproving(null))
  }

  const summaryCards = stats
    ? [
        { label: 'Pending Customer OTP', count: stats.counts.pending, amount: stats.amounts.pending,
          color: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700', icon: <Clock size={18} className="text-amber-500" />, filter: 'pending' },
        { label: 'Customer Approved', count: stats.counts.approved, amount: stats.amounts.approved,
          color: 'bg-green-50 border-green-200', textColor: 'text-green-700', icon: <CheckCircle2 size={18} className="text-green-500" />, filter: 'approved' },
        { label: 'Customer Declined', count: stats.counts.rejected, amount: stats.amounts.rejected,
          color: 'bg-red-50 border-red-200', textColor: 'text-red-700', icon: <XCircle size={18} className="text-red-500" />, filter: 'rejected' },
        { label: 'OTP Expired', count: stats.counts.expired, amount: stats.amounts.expired,
          color: 'bg-slate-50 border-slate-200', textColor: 'text-slate-600', icon: <AlertTriangle size={18} className="text-slate-400" />, filter: 'expired' },
      ]
    : []

  // suppress unused warning for tick (it drives the countdown re-render)
  void tick

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck size={22} className="text-blue-600" />
            Transaction Approval — FRIMS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Transactions ≥ INR 10,00,000 require FRIMS officer approval · Auto-refreshes every 30s
          </p>
        </div>
        <button onClick={() => loadData()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* FRIMS action required banner */}
      {stats && stats.frims_pending_approval > 0 && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-300 flex items-center gap-3">
          <ShieldCheck size={20} className="text-purple-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-purple-800">
              {stats.frims_pending_approval} transaction{stats.frims_pending_approval !== 1 ? 's' : ''} awaiting FRIMS approval
            </span>
            <span className="text-purple-700 ml-1 text-sm">
              — high value (≥ INR {(stats.frims_threshold_inr / 100).toLocaleString('en-IN')})
            </span>
          </div>
        </div>
      )}

      {/* Pending amount banner */}
      {stats && stats.total_held_inr > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <Clock size={20} className="text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-amber-800">
              INR {stats.total_held_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-amber-700 ml-1 text-sm">
              currently held across {stats.counts.pending} pending OTP approval{stats.counts.pending !== 1 ? 's' : ''} — waiting for customer response
            </span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <button key={card.label}
            onClick={() => { setStatusFilter(statusFilter === card.filter ? '' : card.filter); setPage(1) }}
            className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${card.color} ${statusFilter === card.filter ? 'ring-2 ring-blue-400' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${card.textColor}`}>{card.label}</span>
              {card.icon}
            </div>
            <div className={`text-2xl font-bold ${card.textColor}`}>{card.count}</div>
            <div className={`text-xs mt-1 ${card.textColor} opacity-75`}>{fmt(card.amount)}</div>
          </button>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 space-y-1">
            <p className="font-semibold text-blue-900">How high-value transaction approval works</p>
            <p>1. Customer initiates a transfer — system sends an OTP SMS to their registered mobile for verification.</p>
            <p>2. For transactions <strong>≥ INR 10,00,000</strong>, a FRIMS officer must independently <strong>Approve or Reject</strong> from this screen — regardless of customer OTP status.</p>
            <p>3. FRIMS rejection overrides the customer OTP and reverses the transaction immediately.</p>
          </div>
        </div>
      </div>

      {/* Threshold config (collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => setThresholdOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" />
            SMS OTP Trigger Thresholds (by customer segment)
          </span>
          {thresholdOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {thresholdOpen && (
          <div className="px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 text-left font-medium text-slate-500">Customer Segment</th>
                  <th className="py-2 text-right font-medium text-slate-500">SMS OTP Triggered Above</th>
                </tr>
              </thead>
              <tbody>
                {THRESHOLDS.map(row => (
                  <tr key={row.segment} className="border-b border-slate-50">
                    <td className="py-2 text-slate-700">{row.segment}</td>
                    <td className="py-2 text-right font-mono text-slate-800">{row.threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-purple-700 mt-3 font-medium">
              * Transactions ≥ INR 10,00,000 additionally require FRIMS second-level approval after customer OTP.
            </p>
          </div>
        )}
      </div>

      {/* Filter + table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <span className="text-sm text-slate-500">{total} record{total !== 1 ? 's' : ''}</span>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All statuses</option>
            <option value="pending">Pending customer OTP</option>
            <option value="approved">Customer approved</option>
            <option value="rejected">Customer declined</option>
            <option value="expired">OTP expired</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Customer OTP</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">OTP Timer</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">FRIMS Status</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(row => (
                  <tr key={row.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${row.awaiting_frims_approval ? 'bg-purple-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.transaction_ref}</td>
                    <td className="px-4 py-3 text-slate-800">{row.customer_name || row.customer_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.phone_number}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-slate-800">{fmt(row.amount)}</span>
                      {row.frims_approval_required && (
                        <span className="ml-1 text-[10px] text-purple-600 font-semibold">★HIGH</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[row.status] || ''}`}>
                        {row.status === 'pending' ? 'Awaiting customer'
                          : row.status === 'approved' ? 'Customer approved'
                          : row.status === 'rejected' ? 'Customer declined'
                          : 'OTP expired'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {row.status === 'pending'
                        ? <span className={countdown(row.otp_expires_at) === 'Expired' ? 'text-red-500' : 'text-amber-600'}>{countdown(row.otp_expires_at)}</span>
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.frims_approval_required ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                          row.frims_approval_status === 'approved'
                            ? FRIMS_BADGE['approved']
                            : row.frims_approval_status === 'rejected'
                            ? FRIMS_BADGE['rejected']
                            : 'bg-purple-100 text-purple-800 border-purple-200'
                        }`}>
                          {row.frims_approval_status === 'approved'
                            ? `Approved — ${row.frims_approved_by}`
                            : row.frims_approval_status === 'rejected'
                            ? 'Rejected'
                            : 'Awaiting FRIMS'}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {/* View SMS content sent to customer */}
                        <button onClick={() => setSmsPreviewTarget(row)}
                          className="px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-xs hover:bg-slate-100 flex items-center gap-1">
                          <Eye size={11} /> SMS
                        </button>

                        {/* FRIMS Approve / Reject — for all high-value rows without a final FRIMS decision */}
                        {row.awaiting_frims_approval && (
                          <>
                            <button onClick={() => handleFRIMSApprove(row)} disabled={fRIMSApproving === row.id}
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 font-medium">
                              <ShieldCheck size={11} /> {fRIMSApproving === row.id ? '…' : 'Approve'}
                            </button>
                            <button onClick={() => setFRIMSRejectTarget(row)}
                              className="px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs hover:bg-red-100 flex items-center gap-1">
                              <XCircle size={11} /> Reject
                            </button>
                          </>
                        )}

                        {/* Resolved info */}
                        {!row.awaiting_frims_approval && row.status !== 'pending' && (
                          <span className="text-slate-400 text-xs">
                            {row.resolved_by ? `by ${row.resolved_by}` : '—'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {fRIMSRejectTarget && (
        <FRIMSRejectModal
          approval={fRIMSRejectTarget}
          onClose={() => setFRIMSRejectTarget(null)}
          onSuccess={() => loadData()}
        />
      )}
      {smsPreviewTarget && (
        <SMSPreviewModal
          approval={smsPreviewTarget}
          onClose={() => setSmsPreviewTarget(null)}
        />
      )}
    </div>
  )
}
