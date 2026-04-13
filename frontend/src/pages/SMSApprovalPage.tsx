import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, CheckCircle2, XCircle, Clock, RefreshCw,
  Send, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck,
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
}

interface Stats {
  counts: { pending: number; approved: number; rejected: number; expired: number }
  amounts: { pending: number; approved: number; rejected: number; expired: number }
  total_held_inr: number
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

const THRESHOLDS = [
  { segment: 'High / Very-High Risk', threshold: 'ALL transactions (INR 0+)' },
  { segment: 'Corporate',             threshold: 'INR 5,00,000' },
  { segment: 'SME / Trust',           threshold: 'INR 2,00,000' },
  { segment: 'Retail Premium (income ≥ INR 10L)', threshold: 'INR 1,00,000' },
  { segment: 'Retail Standard',       threshold: 'INR 50,000 (default)' },
]

// ---------------------------------------------------------------------------
// OTP Verify Modal
// ---------------------------------------------------------------------------
function VerifyModal({
  approval,
  onClose,
  onSuccess,
}: {
  approval: SMSApproval
  onClose: () => void
  onSuccess: () => void
}) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = () => {
    if (otp.trim().length !== 6) { setError('Enter a 6-digit OTP'); return }
    setLoading(true)
    setError('')
    api.post(`/sms-approvals/${approval.id}/verify`, { otp: otp.trim() })
      .then(() => { onSuccess(); onClose() })
      .catch(err => setError(err?.response?.data?.detail || 'Verification failed'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Verify OTP</h2>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 space-y-1">
          <div><span className="font-medium">Ref:</span> {approval.transaction_ref}</div>
          <div><span className="font-medium">Customer:</span> {approval.customer_name}</div>
          <div><span className="font-medium">Amount:</span> {fmt(approval.amount)}</div>
          <div><span className="font-medium">Phone:</span> {approval.phone_number}</div>
          <div><span className="font-medium">Expires in:</span> {countdown(approval.otp_expires_at)}</div>
        </div>

        {approval.otp_demo && (
          <div className="mb-4 p-2 rounded bg-yellow-50 border border-yellow-200 text-xs text-yellow-800 flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>Demo OTP: <span className="font-mono font-bold tracking-widest">{approval.otp_demo}</span></span>
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit OTP"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
          className="w-full border border-slate-300 rounded-lg px-4 py-3 text-center font-mono text-xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? 'Verifying…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reject Modal
// ---------------------------------------------------------------------------
function RejectModal({
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
    setLoading(true)
    setError('')
    api.post(`/sms-approvals/${approval.id}/reject`, { reason: reason || undefined })
      .then(() => { onSuccess(); onClose() })
      .catch(err => setError(err?.response?.data?.detail || 'Rejection failed'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <XCircle size={20} className="text-red-600" />
          <h2 className="text-lg font-semibold text-slate-800">Reject Transaction</h2>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Rejecting <span className="font-medium">{approval.transaction_ref}</span> ({fmt(approval.amount)}) will
          mark it as reversed. This cannot be undone.
        </p>

        <textarea
          rows={3}
          placeholder="Rejection reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3 resize-none"
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
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
  const [verifyTarget, setVerifyTarget] = useState<SMSApproval | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SMSApproval | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [thresholdOpen, setThresholdOpen] = useState(false)
  const [tick, setTick] = useState(0)   // for countdown re-render

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

  // Auto-refresh every 30 s
  useEffect(() => {
    const interval = setInterval(() => loadData(), 30_000)
    return () => clearInterval(interval)
  }, [loadData])

  // Countdown tick every second
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleResend = (id: string) => {
    setResending(id)
    api.post(`/sms-approvals/resend/${id}`)
      .then(() => loadData())
      .catch(() => {})
      .finally(() => setResending(null))
  }

  const onActionSuccess = () => loadData()

  // Summary card data
  const summaryCards = stats
    ? [
        {
          label: 'Pending',
          count: stats.counts.pending,
          amount: stats.amounts.pending,
          color: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-700',
          icon: <Clock size={18} className="text-amber-500" />,
        },
        {
          label: 'Approved',
          count: stats.counts.approved,
          amount: stats.amounts.approved,
          color: 'bg-green-50 border-green-200',
          textColor: 'text-green-700',
          icon: <CheckCircle2 size={18} className="text-green-500" />,
        },
        {
          label: 'Rejected',
          count: stats.counts.rejected,
          amount: stats.amounts.rejected,
          color: 'bg-red-50 border-red-200',
          textColor: 'text-red-700',
          icon: <XCircle size={18} className="text-red-500" />,
        },
        {
          label: 'Expired',
          count: stats.counts.expired,
          amount: stats.amounts.expired,
          color: 'bg-slate-50 border-slate-200',
          textColor: 'text-slate-600',
          icon: <AlertTriangle size={18} className="text-slate-400" />,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare size={22} className="text-blue-600" />
            SMS Transaction Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            High-value transactions held pending OTP approval · Auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Total amount held banner */}
      {stats && stats.total_held_inr > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <Clock size={20} className="text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-amber-800">
              INR {stats.total_held_inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-amber-700 ml-1 text-sm">
              currently held across {stats.counts.pending} pending approval{stats.counts.pending !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <button
            key={card.label}
            onClick={() => { setStatusFilter(statusFilter === card.label.toLowerCase() ? '' : card.label.toLowerCase()); setPage(1) }}
            className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${card.color} ${statusFilter === card.label.toLowerCase() ? 'ring-2 ring-blue-400' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${card.textColor}`}>{card.label}</span>
              {card.icon}
            </div>
            <div className={`text-2xl font-bold ${card.textColor}`}>{card.count}</div>
            <div className={`text-xs mt-1 ${card.textColor} opacity-75`}>{fmt(card.amount)}</div>
          </button>
        ))}
      </div>

      {/* Threshold config (collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setThresholdOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" />
            Approval Threshold Configuration
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
          </div>
        )}
      </div>

      {/* Filter + table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <span className="text-sm text-slate-500">{total} record{total !== 1 ? 's' : ''}</span>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : approvals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No approvals found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">OTP Expires</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Demo OTP</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(row => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.transaction_ref}</td>
                    <td className="px-4 py-3 text-slate-800">{row.customer_name || row.customer_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.phone_number}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(row.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[row.status] || ''}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {row.status === 'pending'
                        ? <span className={countdown(row.otp_expires_at) === 'Expired' ? 'text-red-500' : 'text-amber-600'}>{countdown(row.otp_expires_at)}</span>
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.otp_demo ? (
                        <span className="font-mono bg-yellow-50 border border-yellow-200 text-yellow-800 px-2 py-0.5 rounded text-xs tracking-widest">
                          {row.otp_demo}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setVerifyTarget(row)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 flex items-center gap-1"
                          >
                            <ShieldCheck size={12} /> Verify
                          </button>
                          <button
                            onClick={() => setRejectTarget(row)}
                            className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs hover:bg-red-100 flex items-center gap-1"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                          <button
                            onClick={() => handleResend(row.id)}
                            disabled={resending === row.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Send size={12} /> {resending === row.id ? '…' : 'Resend'}
                          </button>
                        </div>
                      ) : row.status === 'expired' ? (
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleResend(row.id)}
                            disabled={resending === row.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-xs hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Send size={12} /> {resending === row.id ? '…' : 'Resend OTP'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs block text-center">
                          {row.resolved_by ? `by ${row.resolved_by}` : '—'}
                        </span>
                      )}
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
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); loadData(page - 1) }}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); loadData(page + 1) }}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {verifyTarget && (
        <VerifyModal
          approval={verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onSuccess={onActionSuccess}
        />
      )}
      {rejectTarget && (
        <RejectModal
          approval={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSuccess={onActionSuccess}
        />
      )}
    </div>
  )
}
