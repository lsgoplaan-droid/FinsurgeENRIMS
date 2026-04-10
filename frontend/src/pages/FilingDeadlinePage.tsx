import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, CheckCircle2, FileText, Timer, Filter, TrendingUp } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatNumber } from '../utils/formatters'

function CountdownBadge({ daysRemaining, urgency }: { daysRemaining: number; urgency: string }) {
  const color = urgency === 'overdue' ? 'bg-red-100 text-red-800 border-red-200' :
    urgency === 'critical' ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
    urgency === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-green-50 text-green-700 border-green-200'

  const label = urgency === 'overdue'
    ? `${Math.abs(daysRemaining).toFixed(0)}d OVERDUE`
    : `${daysRemaining.toFixed(0)}d remaining`

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <Timer size={10} />
      {label}
    </span>
  )
}

function ProgressRing({ days, total, urgency }: { days: number; total: number; urgency: string }) {
  const pct = Math.max(0, Math.min(1, days / total))
  const dasharray = 2 * Math.PI * 18
  const color = urgency === 'overdue' ? '#ef4444' : urgency === 'critical' ? '#ef4444' : urgency === 'warning' ? '#f59e0b' : '#22c55e'

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="20" cy="20" r="18" fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${pct * dasharray} ${dasharray}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold" style={{ color }}>
          {urgency === 'overdue' ? '!' : `${Math.max(0, days).toFixed(0)}d`}
        </span>
      </div>
    </div>
  )
}

export default function FilingDeadlinePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    api.get('/filing-deadlines/summary')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-center text-slate-400 py-20">No filing deadline data available</div>
  }

  const { pending_filings, summary } = data
  const filtered = filter ? pending_filings.filter((f: any) => f.type === filter) : pending_filings

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">Filing Deadline Tracker</h1>
        <p className="text-xs text-slate-500">CTR (15 days) and STR (7 days) filing deadlines with auto-escalation</p>
      </div>

      {/* Alert banner if overdue */}
      {summary.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-bold text-red-800">{summary.overdue} filing{summary.overdue !== 1 ? 's' : ''} OVERDUE</p>
            <p className="text-xs text-red-600">Immediate action required — non-compliance with RBI filing deadlines</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Pending', value: summary.total_pending, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Overdue', value: summary.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Critical (< 2d)', value: summary.critical, icon: Timer, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Warning (< 5d)', value: summary.warning, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'On Track', value: summary.on_track, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Filed', value: summary.total_filed, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={s.color} size={14} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTR vs STR summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-sm font-semibold text-slate-700">CTR — Currency Transaction Reports</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Deadline: <strong>15 days</strong> from transaction date</span>
            <span>Pending: <strong className="text-blue-600">{summary.ctrs_pending}</strong></span>
            <span>Filed: <strong className="text-green-600">{summary.ctrs_filed}</strong></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">RBI Master Direction on KYC — Cash transactions exceeding INR 10 lakh must be reported to FIU-IND within 15 days of the month following the transaction</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-purple-500 rounded" />
            <span className="text-sm font-semibold text-slate-700">STR — Suspicious Transaction Reports</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Deadline: <strong>7 days</strong> from suspicion formed</span>
            <span>Pending: <strong className="text-purple-600">{summary.sars_pending}</strong></span>
            <span>Filed: <strong className="text-green-600">{summary.sars_filed}</strong></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">PMLA Rules 2005 Rule 7 — STR must be filed with FIU-IND within 7 days of the date on which suspicion is formed by the Principal Officer</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-slate-400" />
        <span className="text-xs text-slate-500">Filter:</span>
        {['', 'CTR', 'STR'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} filings</span>
      </div>

      {/* Filings list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <CheckCircle2 className="text-green-500 mx-auto mb-2" size={24} />
            <p className="text-sm text-slate-600">All filings are up to date!</p>
          </div>
        ) : (
          filtered.map((f: any) => (
            <div
              key={f.id}
              className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4 ${
                f.urgency === 'overdue' ? 'border-red-200 bg-red-50/30' :
                f.urgency === 'critical' ? 'border-red-100' :
                f.urgency === 'warning' ? 'border-amber-100' :
                'border-slate-200'
              }`}
            >
              <ProgressRing days={f.days_remaining} total={f.deadline_days} urgency={f.urgency} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${f.type === 'CTR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {f.type}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{f.report_number}</span>
                  <CountdownBadge daysRemaining={f.days_remaining} urgency={f.urgency} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Customer: <strong className="text-slate-700">{f.customer_name}</strong></span>
                  <span>Amount: <strong className="text-slate-700">{formatINR(f.amount)}</strong></span>
                  {f.case_number && <span>Case: <strong>{f.case_number}</strong></span>}
                  <span>Status: <strong className="capitalize">{(f.status || '').replace(/_/g, ' ')}</strong></span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                  <span>Created: {f.created_at ? new Date(f.created_at).toLocaleDateString('en-IN') : '-'}</span>
                  <span>Deadline: {f.deadline ? new Date(f.deadline).toLocaleDateString('en-IN') : '-'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
