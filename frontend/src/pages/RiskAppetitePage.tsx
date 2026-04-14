import { useState, useEffect } from 'react'
import { Gauge, AlertTriangle, Shield, TrendingUp, Users, Timer, CheckCircle2, Edit3, Save, RotateCcw, X, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

function GaugeMeter({ value, limit, warning, unit, status, label }: {
  value: number; limit: number; warning: number; unit: string; status: string; label: string
}) {
  const pct = limit > 0 ? Math.min((value / limit) * 100, 120) : 0
  const warningPct = limit > 0 ? (warning / limit) * 100 : 0
  const angle = (pct / 100) * 180
  const warningAngle = (warningPct / 100) * 180

  const statusColor = status === 'breach' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#22c55e'
  const statusBg = status === 'breach' ? 'bg-red-50 border-red-200' : status === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
  const statusText = status === 'breach' ? 'BREACH' : status === 'warning' ? 'WARNING' : 'OK'

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 ${status === 'breach' ? 'border-red-200' : status === 'warning' ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg}`} style={{ color: statusColor }}>
          {statusText}
        </span>
      </div>

      {/* SVG Gauge */}
      <div className="flex justify-center">
        <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round"
          />
          {/* Warning zone */}
          <path
            d={`M 20 100 A 80 80 0 0 1 ${100 + 80 * Math.cos(Math.PI - (warningAngle * Math.PI / 180))} ${100 - 80 * Math.sin(Math.PI - (warningAngle * Math.PI / 180))}`}
            fill="none" stroke="#fde68a" strokeWidth="14" strokeLinecap="round" opacity="0.4"
          />
          {/* Value arc */}
          <path
            d={`M 20 100 A 80 80 0 ${angle > 180 ? 1 : 0} 1 ${100 + 80 * Math.cos(Math.PI - (Math.min(angle, 180) * Math.PI / 180))} ${100 - 80 * Math.sin(Math.PI - (Math.min(angle, 180) * Math.PI / 180))}`}
            fill="none" stroke={statusColor} strokeWidth="14" strokeLinecap="round"
          />
          {/* Needle */}
          {(() => {
            const needleAngle = Math.PI - (Math.min(angle, 180) * Math.PI / 180)
            const nx = 100 + 60 * Math.cos(needleAngle)
            const ny = 100 - 60 * Math.sin(needleAngle)
            return <line x1="100" y1="100" x2={nx} y2={ny} stroke={statusColor} strokeWidth="2.5" strokeLinecap="round" />
          })()}
          <circle cx="100" cy="100" r="5" fill={statusColor} />
          {/* Value text — cap display at limit so gauge never shows "6 out of 5" */}
          <text x="100" y="82" textAnchor="middle" fill={statusColor} fontSize="22" fontWeight="bold">
            {value > limit ? limit : value}
          </text>
          <text x="100" y="96" textAnchor="middle" fill="#94a3b8" fontSize="10">
            {unit}
          </text>
          {/* Labels */}
          <text x="20" y="115" textAnchor="middle" fill="#94a3b8" fontSize="9">0</text>
          <text x="180" y="115" textAnchor="middle" fill="#ef4444" fontSize="9">{limit}</text>
        </svg>
      </div>

      {/* Threshold info */}
      <div className="flex items-center justify-between mt-2 text-[10px]">
        <span className="text-amber-500">Warning: {warning}{unit}</span>
        <span className="text-red-500">Limit: {limit}{unit}</span>
      </div>
    </div>
  )
}

export default function RiskAppetitePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingMetric, setEditingMetric] = useState<string | null>(null)
  const [editWarning, setEditWarning] = useState('')
  const [editLimit, setEditLimit] = useState('')
  const [editEvidenceUrl, setEditEvidenceUrl] = useState('')
  const [editJustification, setEditJustification] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = () => {
    api.get('/dashboard/risk-appetite')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const startEdit = (m: any) => {
    setEditingMetric(m.id)
    setEditWarning(String(m.threshold.warning))
    setEditLimit(String(m.threshold.limit))
    setEditEvidenceUrl('')
    setEditJustification('')
  }

  const cancelEdit = () => {
    setEditingMetric(null)
    setEditWarning('')
    setEditLimit('')
    setEditEvidenceUrl('')
    setEditJustification('')
  }

  const saveThreshold = (metricId: string) => {
    setSaving(true)
    api.put('/dashboard/risk-appetite/thresholds', {
      metric_id: metricId,
      warning: parseFloat(editWarning),
      limit: parseFloat(editLimit),
      evidence_url: editEvidenceUrl || null,
      justification: editJustification || null,
    })
      .then(() => {
        setEditingMetric(null)
        setEditEvidenceUrl('')
        setEditJustification('')
        setMsg('Threshold updated')
        setTimeout(() => setMsg(''), 3000)
        loadData()
      })
      .catch(() => setMsg('Failed to update'))
      .finally(() => setSaving(false))
  }

  const resetAll = () => {
    setSaving(true)
    api.post('/dashboard/risk-appetite/thresholds/reset')
      .then(() => {
        setMsg('Thresholds reset to defaults')
        setTimeout(() => setMsg(''), 3000)
        loadData()
      })
      .catch(() => setMsg('Failed to reset'))
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.metrics) {
    return <div className="text-center text-slate-400 py-20">No risk appetite data available</div>
  }

  const { metrics, summary } = data
  const statusColor = summary.overall_status === 'breach' ? 'text-red-700' : summary.overall_status === 'warning' ? 'text-amber-700' : 'text-green-700'
  const statusBg = summary.overall_status === 'breach' ? 'bg-red-50 border-red-200' : summary.overall_status === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'

  const pieData = [
    { name: 'Breaches', value: summary.breaches, color: '#ef4444' },
    { name: 'Warnings', value: summary.warnings, color: '#f59e0b' },
    { name: 'OK', value: metrics.length - summary.breaches - summary.warnings, color: '#22c55e' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">Risk Appetite Dashboard</h1>
        <p className="text-xs text-slate-500">CRO-defined thresholds vs current portfolio risk — real-time monitoring</p>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-xl border p-5 flex items-center justify-between ${statusBg}`}>
        <div className="flex items-center gap-4">
          {summary.overall_status === 'breach' ? (
            <AlertTriangle className="text-red-600" size={28} />
          ) : summary.overall_status === 'warning' ? (
            <AlertTriangle className="text-amber-600" size={28} />
          ) : (
            <CheckCircle2 className="text-green-600" size={28} />
          )}
          <div>
            <p className={`text-xl font-bold ${statusColor}`}>
              {summary.overall_status === 'breach' ? 'RISK APPETITE BREACHED' :
               summary.overall_status === 'warning' ? 'APPROACHING LIMITS' : 'WITHIN APPETITE'}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {summary.breaches} breach{summary.breaches !== 1 ? 'es' : ''}, {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''}
              {' '}&mdash; {metrics.length} metrics monitored
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          <ResponsiveContainer width={120} height={80}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={35} innerRadius={20}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Customers', value: formatNumber(summary.total_customers), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', href: '/customers' },
          { label: 'High Risk', value: formatNumber(summary.high_risk_customers), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', href: '/customers?risk_category=high,very_high' },
          { label: 'PEP Customers', value: formatNumber(summary.pep_count), icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50', href: '/customers?pep=true' },
          { label: 'Open Alerts', value: formatNumber(summary.open_alerts), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', href: '/alerts?status=new,assigned,under_review,escalated' },
          { label: 'Overdue Alerts', value: formatNumber(summary.overdue_alerts), icon: Timer, color: 'text-red-600', bg: 'bg-red-50', href: '/sla-burndown' },
          { label: 'Open Cases', value: formatNumber(summary.open_cases), icon: Gauge, color: 'text-blue-600', bg: 'bg-blue-50', href: '/cases?status=open,assigned,under_investigation,escalated' },
        ].map(s => (
          <Link key={s.label} to={s.href} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 hover:shadow-md hover:border-blue-300 transition-all">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={s.color} size={14} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Gauge meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((m: any) => (
          <GaugeMeter
            key={m.id}
            label={m.label}
            value={m.value}
            limit={m.threshold.limit}
            warning={m.threshold.warning}
            unit={m.unit}
            status={m.status}
          />
        ))}
      </div>

      {/* Threshold Configuration — CRO Editable */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Appetite Thresholds (CRO Configuration)</h3>
          <button onClick={resetAll} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            <RotateCcw size={12} />
            Reset Defaults
          </button>
        </div>
        {msg && (
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')}><X size={12} /></button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="py-2.5 px-3 font-medium text-slate-600">Metric</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Current Value</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Warning Threshold</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Breach Limit</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-center">Status</th>
                <th className="py-2.5 px-3 font-medium text-slate-600">Utilization</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {metrics.flatMap((m: any) => {
                const utilization = m.threshold.limit > 0 ? Math.min((m.value / m.threshold.limit) * 100, 120) : 0
                const barColor = m.status === 'breach' ? '#ef4444' : m.status === 'warning' ? '#f59e0b' : '#22c55e'
                const isEditing = editingMetric === m.id
                const rowEls: any[] = [
                  <tr key={m.id} className={`border-t border-slate-100 ${isEditing ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{m.label}</td>
                    <td className="py-2.5 px-3 text-right font-bold" style={{ color: barColor }}>{m.value}{m.unit}</td>
                    <td className="py-2.5 px-3 text-right">
                      {isEditing ? (
                        <input type="number" step="0.1" value={editWarning} onChange={e => setEditWarning(e.target.value)}
                          className="w-20 px-2 py-1 text-xs text-right border border-amber-300 rounded bg-white focus:ring-1 focus:ring-amber-400 outline-none" />
                      ) : (
                        <span className="text-amber-600">{m.threshold.warning}{m.unit}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isEditing ? (
                        <input type="number" step="0.1" value={editLimit} onChange={e => setEditLimit(e.target.value)}
                          className="w-20 px-2 py-1 text-xs text-right border border-red-300 rounded bg-white focus:ring-1 focus:ring-red-400 outline-none" />
                      ) : (
                        <span className="text-red-600">{m.threshold.limit}{m.unit}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.status === 'breach' ? 'bg-red-100 text-red-800' :
                        m.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {m.status === 'breach' ? 'BREACH' : m.status === 'warning' ? 'WARNING' : 'OK'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(utilization, 100)}%`, backgroundColor: barColor }} />
                        </div>
                        <span className="text-xs text-slate-500">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveThreshold(m.id)} disabled={saving}
                            className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                            <Save size={12} />
                          </button>
                          <button onClick={cancelEdit} className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(m)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit3 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ]
                if (isEditing) {
                  rowEls.push(
                    <tr key={`${m.id}-evidence`} className="bg-blue-50/30 border-t border-blue-100">
                      <td colSpan={7} className="py-3 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-700 mb-1">Evidence URL (CRO memo, board minutes, etc.)</label>
                            <input
                              type="url"
                              value={editEvidenceUrl}
                              onChange={e => setEditEvidenceUrl(e.target.value)}
                              placeholder="https://docs.bank.intra/risk-committee/2026-q2-appetite-revision.pdf"
                              className="w-full px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Required by RBI Risk Management Framework — link to the document authorising this change.</p>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-blue-700 mb-1">Justification (why is this change needed?)</label>
                            <textarea
                              value={editJustification}
                              onChange={e => setEditJustification(e.target.value)}
                              rows={2}
                              placeholder="e.g. Q2 stress test results show portfolio can absorb 3% additional high-risk exposure..."
                              className="w-full px-3 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }
                return rowEls
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
