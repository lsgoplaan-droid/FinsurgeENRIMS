import { useState, useEffect } from 'react'
import {
  Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  XCircle, HelpCircle, BarChart3, Lightbulb, Filter, ChevronDown,
  ToggleLeft, ToggleRight, Edit3, Save, X, Sliders
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const SEVERITIES = ['critical', 'high', 'medium', 'low']

function PrecisionGauge({ value }: { value: number }) {
  const color = value >= 70 ? 'text-green-600' : value >= 40 ? 'text-amber-600' : 'text-red-600'
  const bg = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold ${color}`}>{value}%</span>
    </div>
  )
}

const PIE_COLORS = ['#22c55e', '#ef4444', '#94a3b8', '#3b82f6']

export default function AlertTuningPage() {
  const [summary, setSummary] = useState<any>(null)
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tuningRule, setTuningRule] = useState<string | null>(null)
  const [tuneForm, setTuneForm] = useState({ threshold_amount: '', threshold_count: '', time_window: '', severity: '' })
  const [saving, setSaving] = useState(false)

  const loadData = () => {
    Promise.all([
      api.get('/alert-tuning/summary'),
      api.get('/alert-tuning/rule-performance'),
    ])
      .then(([summaryRes, rulesRes]) => {
        setSummary(summaryRes.data)
        setRules(rulesRes.data?.rules || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { setLoading(true); loadData() }, [])

  const handleToggle = async (ruleId: string) => {
    try {
      const res = await api.post(`/alert-tuning/rules/${ruleId}/toggle`)
      setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, is_enabled: res.data.is_enabled } : r))
      setMsg(`Rule ${res.data.is_enabled ? 'enabled' : 'disabled'}`)
      setTimeout(() => setMsg(''), 3000)
    } catch { setMsg('Failed to toggle rule') }
  }

  const openTune = (r: any) => {
    setTuningRule(r.rule_id)
    setTuneForm({
      threshold_amount: '', threshold_count: '',
      time_window: '', severity: r.severity || 'medium',
    })
  }

  const saveTune = async () => {
    if (!tuningRule) return
    setSaving(true)
    try {
      const payload: any = { severity: tuneForm.severity }
      if (tuneForm.threshold_amount) payload.threshold_amount = parseInt(tuneForm.threshold_amount)
      if (tuneForm.threshold_count) payload.threshold_count = parseInt(tuneForm.threshold_count)
      if (tuneForm.time_window) payload.time_window = tuneForm.time_window
      const res = await api.put(`/alert-tuning/rules/${tuningRule}/tune`, payload)
      setTuningRule(null)
      setMsg(`Rule tuned: ${(res.data.changes || []).join(', ') || 'no changes'}`)
      loadData()
      setTimeout(() => setMsg(''), 4000)
    } catch { setMsg('Failed to tune rule') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const categories = [...new Set(rules.map(r => r.category).filter(Boolean))]
  const filteredRules = categoryFilter ? rules.filter(r => r.category === categoryFilter) : rules
  const rulesWithSuggestions = rules.filter(r => r.suggestion)

  const chartRules = [...rules].filter(r => r.total_alerts > 0).slice(0, 10)
  const barData = chartRules.map(r => ({
    name: r.rule_name.length > 25 ? r.rule_name.slice(0, 25) + '...' : r.rule_name,
    'Confirmed': r.true_positive, 'False Alarm': r.false_positive,
    'Inconclusive': r.inconclusive, 'Open': r.open,
  }))

  const pieData = [
    { name: 'Confirmed', value: summary?.true_positive || 0 },
    { name: 'False Alarm', value: summary?.false_positive || 0 },
    { name: 'Inconclusive', value: summary?.inconclusive || 0 },
    { name: 'Open', value: summary?.open || 0 },
  ].filter(d => d.value > 0)

  const statCards = [
    { label: 'Total Alerts', value: summary?.total_alerts || 0, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', href: '/alerts' },
    { label: 'Confirmed Fraud Rate', value: `${summary?.overall_tp_rate || 0}%`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', href: '/alerts?status=closed_true_positive' },
    { label: 'False Alarm Rate', value: `${summary?.overall_fp_rate || 0}%`, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', href: '/alerts?status=closed_false_positive' },
    { label: 'Detection Accuracy', value: `${summary?.overall_precision || 0}%`, icon: Target, color: 'text-purple-600', bg: 'bg-purple-50', href: '/fraud-detection' },
  ]

  return (
    <div className="space-y-4">
      {/* Message */}
      {msg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')}><X size={14} /></button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Link key={s.label} to={s.href} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>
                  {typeof s.value === 'number' ? formatNumber(s.value) : s.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
            <p className="text-[10px] text-blue-500 mt-1 font-medium">View details &rarr;</p>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Alert Disposition by Rule (Top 10)</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Confirmed" stackId="a" fill="#22c55e" />
                <Bar dataKey="False Alarm" stackId="a" fill="#ef4444" />
                <Bar dataKey="Inconclusive" stackId="a" fill="#94a3b8" />
                <Bar dataKey="Open" stackId="a" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No alert data yet</div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Overall Disposition</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">No disposition data</div>
          )}
        </div>
      </div>

      {/* Suggestions panel */}
      {rulesWithSuggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Tuning Suggestions ({rulesWithSuggestions.length})</h3>
          </div>
          <div className="space-y-2">
            {rulesWithSuggestions.map(r => (
              <div key={r.rule_id} className="flex items-start justify-between gap-3 bg-white rounded-lg p-3 border border-amber-100">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{r.rule_name}</span>
                    <span className="text-xs text-slate-400 ml-2">Confirmed: {r.tp_rate}% | False Alarm: {r.fp_rate}%</span>
                    <p className="text-xs text-amber-700 mt-0.5">{r.suggestion}</p>
                  </div>
                </div>
                <button onClick={() => openTune(r)} className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200 flex-shrink-0">
                  <Sliders size={11} /> Tune
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filter:</span>
          </div>
          <div className="relative">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            {summary?.enabled_rules || 0} of {summary?.total_rules || 0} rules enabled |
            {summary?.rules_with_alerts || 0} rules triggered
          </span>
        </div>
      </div>

      {/* Rules table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Rule</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Category</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Severity</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Total</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Confirmed</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">False Alarm</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Open</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Hit Rate</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Accuracy</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map(r => (
                <tr key={r.rule_id} className={`border-t border-slate-100 hover:bg-slate-50 ${r.suggestion ? 'bg-amber-50/30' : ''}`}>
                  <td className="py-2.5 px-3">
                    <p className="text-sm font-medium text-slate-800">{r.rule_name}</p>
                    {r.suggestion && (
                      <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                        <Lightbulb size={10} />
                        {r.suggestion}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 capitalize">{(r.category || '-').replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-3">
                    <Badge text={r.severity || '-'} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">{r.total_alerts}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-green-600">{r.true_positive}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600">{r.false_positive}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-600">{r.open}</td>
                  <td className="py-2.5 px-3">
                    {r.total_alerts > 0 ? <PrecisionGauge value={r.tp_rate} /> : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.total_alerts > 0 ? <PrecisionGauge value={r.precision} /> : <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggle(r.rule_id)} title={r.is_enabled ? 'Disable' : 'Enable'} className="transition-colors">
                        {r.is_enabled ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} className="text-slate-300" />}
                      </button>
                      <button onClick={() => openTune(r)} title="Tune thresholds" className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Sliders size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">No rules found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tune Modal */}
      {tuningRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setTuningRule(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-800">Tune Rule</h3>
                </div>
                <button onClick={() => setTuningRule(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {rules.find(r => r.rule_id === tuningRule)?.rule_name}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                <select value={tuneForm.severity} onChange={e => setTuneForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Threshold (paise)</label>
                <input type="number" value={tuneForm.threshold_amount} onChange={e => setTuneForm(f => ({ ...f, threshold_amount: e.target.value }))}
                  placeholder="e.g. 10000000 (= ₹1,00,000)" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Count Threshold</label>
                <input type="number" value={tuneForm.threshold_count} onChange={e => setTuneForm(f => ({ ...f, threshold_count: e.target.value }))}
                  placeholder="e.g. 5" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Window</label>
                <input value={tuneForm.time_window} onChange={e => setTuneForm(f => ({ ...f, time_window: e.target.value }))}
                  placeholder="e.g. 24h, 7d, 1h" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setTuningRule(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={saveTune} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save size={14} />
                {saving ? 'Saving...' : 'Apply Tuning'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
