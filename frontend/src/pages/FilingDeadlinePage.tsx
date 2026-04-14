import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock, AlertTriangle, CheckCircle2, FileText, Timer, Filter, TrendingUp, X, ExternalLink, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import api from '../config/api'
import { formatINR } from '../utils/formatters'

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
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedFiling, setSelectedFiling] = useState<any>(null)

  // SLA breach state
  const [breaches, setBreaches] = useState<any[]>([])
  const [breachSummary, setBreachSummary] = useState<any>(null)
  const [breachExpanded, setBreachExpanded] = useState(true)
  const [escalateModal, setEscalateModal] = useState<{ breach: any } | null>(null)
  const [escalateForm, setEscalateForm] = useState({ escalated_to: 'CMLCO', notes: '' })
  const [escalating, setEscalating] = useState(false)
  const [escalatedIds, setEscalatedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Get filters from URL parameters
    const typeParam = searchParams.get('type')
    const statusParam = searchParams.get('status')
    if (typeParam) {
      setFilter(typeParam.toUpperCase())
    }
    if (statusParam) {
      setStatusFilter(statusParam.toLowerCase())
    }
  }, [searchParams])

  useEffect(() => {
    api.get('/filing-deadlines/summary')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))

    api.get('/filing-deadlines/breaches')
      .then(res => setBreaches(res.data))
      .catch(() => {})

    api.get('/filing-deadlines/breach-summary')
      .then(res => setBreachSummary(res.data))
      .catch(() => {})
  }, [])

  function handleEscalate() {
    if (!escalateModal) return
    const { breach } = escalateModal
    setEscalating(true)
    api.post(`/filing-deadlines/breaches/${breach.type}/${breach.id}/escalate`, escalateForm)
      .then(() => {
        setEscalatedIds(prev => new Set(prev).add(breach.id))
        setEscalateModal(null)
        setEscalateForm({ escalated_to: 'CMLCO', notes: '' })
      })
      .catch(() => {})
      .finally(() => setEscalating(false))
  }

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
  let filtered = pending_filings

  // Filter by type (CTR or STR)
  if (filter) {
    filtered = filtered.filter((f: any) => f.type === filter)
  }

  // Note: pending_filings only contains unfiled items (filing_status != "filed")
  // statusFilter comes from URL (?status=pending or status=filed)
  // "pending" means show unfiled items (which is what we already have)
  // "filed" means... but filed items aren't in this list anyway
  // So we only need to handle the case where statusFilter is not set

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">Filing Deadline Tracker</h1>
        <p className="text-xs text-slate-500">CTR (15 days) and STR (7 days) filing deadlines with auto-escalation</p>
      </div>

      {/* SLA Breach Panel */}
      {breachSummary && breachSummary.total_breaches > 0 && (
        <div className="rounded-xl border-2 border-red-400 overflow-hidden shadow-md">
          {/* Panel header — always visible, clickable to expand/collapse */}
          <button
            onClick={() => setBreachExpanded(v => !v)}
            className="w-full bg-red-600 hover:bg-red-700 transition-colors px-4 py-3 flex items-center gap-3 text-left"
          >
            <ShieldAlert className="text-white flex-shrink-0" size={18} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-white">
                SLA BREACH ALERT — {breachSummary.total_breaches} filing{breachSummary.total_breaches !== 1 ? 's' : ''} are overdue
              </span>
              <span className="text-xs text-red-200 ml-3">
                Regulatory risk: <strong className="text-white">{breachSummary.regulatory_risk}</strong>
                {' '}| Oldest breach: <strong className="text-white">{breachSummary.oldest_breach_days}d</strong>
              </span>
            </div>
            <span className="text-xs text-red-200 hidden sm:block mr-2">
              CMLCO escalation required within 24 hours per RBI mandate
            </span>
            {breachExpanded ? <ChevronUp className="text-white flex-shrink-0" size={16} /> : <ChevronDown className="text-white flex-shrink-0" size={16} />}
          </button>

          {/* Breach severity strip */}
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-4 text-xs">
            {breachSummary.critical_breaches > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-700 inline-block" />
                <strong className="text-red-800">{breachSummary.critical_breaches} CRITICAL</strong>
                <span className="text-red-600">(&gt;14 days)</span>
              </span>
            )}
            {breachSummary.high_breaches > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                <strong className="text-orange-700">{breachSummary.high_breaches} HIGH</strong>
                <span className="text-orange-600">(&gt;7 days)</span>
              </span>
            )}
            {breachSummary.medium_breaches > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <strong className="text-amber-700">{breachSummary.medium_breaches} MEDIUM</strong>
                <span className="text-amber-600">(1–7 days)</span>
              </span>
            )}
            <span className="ml-auto text-slate-500">
              Total overdue exposure: <strong className="text-slate-700">{formatINR(breachSummary.total_overdue_amount)}</strong>
            </span>
          </div>

          {/* Expanded breach table */}
          {breachExpanded && (
            <div className="bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-50 border-b border-red-100 text-left">
                    <th className="px-3 py-2 font-semibold text-slate-600">Report #</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Type</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Customer</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Days Overdue</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Severity</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Regulatory Consequence</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {breaches.map((b: any) => (
                    <tr key={`${b.type}-${b.id}`} className="hover:bg-red-50/50 transition-colors">
                      <td className="px-3 py-2 font-mono font-medium text-slate-800">{b.report_number}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          b.type === 'CTR' ? 'bg-blue-100 text-blue-700' :
                          b.type === 'LVTR' ? 'bg-teal-100 text-teal-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{b.type}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{b.customer_name}</td>
                      <td className="px-3 py-2 font-bold text-red-700">{b.days_overdue}d</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          b.breach_severity === 'CRITICAL' ? 'bg-red-700 text-white' :
                          b.breach_severity === 'HIGH' ? 'bg-orange-500 text-white' :
                          'bg-amber-400 text-amber-900'
                        }`}>{b.breach_severity}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={b.regulatory_consequence}>
                        {b.regulatory_consequence}
                      </td>
                      <td className="px-3 py-2">
                        {escalatedIds.has(b.id) ? (
                          <span className="text-green-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Escalated
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setEscalateModal({ breach: b })
                              setEscalateForm({ escalated_to: 'CMLCO', notes: '' })
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
                          >
                            Escalate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Pending', value: summary.total_pending, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          {
            label: 'Overdue',
            value: summary.overdue,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50',
            badge: breachSummary && breachSummary.total_breaches > 0 ? breachSummary.regulatory_risk : null,
          },
          { label: 'Critical (< 2d)', value: summary.critical, icon: Timer, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Warning (< 5d)', value: summary.warning, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'On Track', value: summary.on_track, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Filed', value: summary.total_filed, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s: any) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={s.color} size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  {s.badge && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-600 text-white leading-none">
                      {s.badge}
                    </span>
                  )}
                </div>
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
              onClick={() => setSelectedFiling(f)}
              className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all ${
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

      {/* Escalation Modal */}
      {escalateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEscalateModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">Escalate SLA Breach</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {escalateModal.breach.report_number} — {escalateModal.breach.days_overdue}d overdue
                </p>
              </div>
              <button onClick={() => setEscalateModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
              <p className="font-semibold mb-1">Regulatory consequence</p>
              <p>{escalateModal.breach.regulatory_consequence}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Escalate to</label>
                <select
                  value={escalateForm.escalated_to}
                  onChange={e => setEscalateForm(f => ({ ...f, escalated_to: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <option value="CMLCO">CMLCO — Chief Money Laundering Compliance Officer</option>
                  <option value="Board Risk Committee">Board Risk Committee</option>
                  <option value="RBI Nodal Officer">RBI Nodal Officer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={escalateForm.notes}
                  onChange={e => setEscalateForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Add context or instructions for the escalation recipient..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setEscalateModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={escalating}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {escalating ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    Escalating…
                  </>
                ) : (
                  'Confirm Escalation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filing Detail Modal */}
      {selectedFiling && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedFiling(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedFiling.type === 'CTR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {selectedFiling.type}
                  </span>
                  <h2 className="text-lg font-bold text-slate-800">{selectedFiling.report_number}</h2>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedFiling.type === 'CTR'
                    ? 'Currency Transaction Report — RBI Master Direction (15 day filing window)'
                    : 'Suspicious Transaction Report — PMLA Rule 7 (7 day filing window)'}
                </p>
              </div>
              <button onClick={() => setSelectedFiling(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                ['Customer', selectedFiling.customer_name],
                ['Amount', formatINR(selectedFiling.amount)],
                ['Status', (selectedFiling.status || '').replace(/_/g, ' ')],
                ['Urgency', selectedFiling.urgency?.toUpperCase()],
                ['Created', selectedFiling.created_at ? new Date(selectedFiling.created_at).toLocaleString('en-IN') : '-'],
                ['Filing Deadline', selectedFiling.deadline ? new Date(selectedFiling.deadline).toLocaleString('en-IN') : '-'],
                ['Days Remaining', selectedFiling.days_remaining?.toFixed(1)],
                ['Linked Case', selectedFiling.case_number || '-'],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">{label}</p>
                  <p className="text-sm text-slate-800 font-medium mt-0.5">{value || '-'}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2">
              {selectedFiling.case_number && (
                <Link
                  to={`/cases?search=${selectedFiling.case_number}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <ExternalLink size={12} /> Open Case
                </Link>
              )}
              <Link
                to={selectedFiling.type === 'STR' || selectedFiling.type === 'SAR' ? '/compliance/sar' : '/reports'}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <ExternalLink size={12} /> View in {selectedFiling.type === 'CTR' ? 'CTR Workbench' : 'STR Workflow'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
