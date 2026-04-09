import { useState, useEffect } from 'react'
import {
  Activity, Users, AlertTriangle, Clock, TrendingUp, BarChart3,
  CheckCircle, XCircle, Timer, Shield, Database, ArrowUpRight
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const priorityColors: Record<string, string> = {
  critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e',
}

const BUCKET_COLORS: Record<string, string> = {
  '0-4h': '#22c55e', '4-24h': '#84cc16', '1-3d': '#eab308', '3-7d': '#f59e0b',
  '7-14d': '#f97316', '14-30d': '#ef4444', '30d+': '#dc2626',
  '0-1d': '#22c55e', '30-60d': '#ef4444', '60d+': '#dc2626',
}

export default function SystemMonitoringPage() {
  const [usage, setUsage] = useState<any>(null)
  const [ageing, setAgeing] = useState<any>(null)
  const [analysts, setAnalysts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'ageing' | 'analysts'>('overview')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/system-monitoring/usage-dashboard'),
      api.get('/system-monitoring/ageing-report'),
      api.get('/system-monitoring/analyst-performance'),
    ])
      .then(([usageRes, ageingRes, analystRes]) => {
        setUsage(usageRes.data)
        setAgeing(ageingRes.data)
        setAnalysts(analystRes.data?.analysts || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load monitoring data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const entities = usage?.entities || {}
  const recent = usage?.recent_activity || {}

  const entityCards = [
    { label: 'Customers', value: entities.customers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Transactions', value: entities.transactions, icon: ArrowUpRight, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Alerts', value: entities.alerts, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Cases', value: entities.cases, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Rules', value: entities.rules, icon: Database, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Users', value: entities.users, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50' },
  ]

  // Ageing chart data
  const alertAgeingData = Object.entries(ageing?.alert_ageing?.buckets || {}).map(([bucket, count]) => ({
    name: bucket, value: count as number,
  }))
  const caseAgeingData = Object.entries(ageing?.case_ageing?.buckets || {}).map(([bucket, count]) => ({
    name: bucket, value: count as number,
  }))

  return (
    <div className="space-y-4">
      {/* Entity stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {entityCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={s.color} size={16} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{formatNumber(s.value || 0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 7-day activity summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Transactions (7d)', value: recent.transactions_7d, color: 'text-indigo-600' },
          { label: 'Alerts (7d)', value: recent.alerts_7d, color: 'text-amber-600' },
          { label: 'Cases (7d)', value: recent.cases_7d, color: 'text-purple-600' },
          { label: 'Audit Actions (7d)', value: recent.audit_actions_7d, color: 'text-slate-600' },
          { label: 'User Logins (7d)', value: recent.logins_7d, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{formatNumber(s.value || 0)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'overview', label: 'Usage Overview' },
          { key: 'ageing', label: 'Ageing Reports' },
          { key: 'analysts', label: 'Analyst Performance' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Daily volumes chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Volume (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usage?.daily_volumes || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="transactions" name="Transactions" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* User activity table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">User Activity (30 Days)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">User</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Department</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Roles</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Actions (30d)</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Alerts Closed</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Login</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage?.user_activity || []).map((u: any) => (
                    <tr key={u.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-700">{u.full_name}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{u.department}</td>
                      <td className="py-2.5 px-3">
                        {u.roles?.map((r: string) => <Badge key={r} text={r} colors="bg-slate-100 text-slate-600" />)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatNumber(u.actions_30d)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{u.alerts_closed_30d}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{u.last_login?.split('T')[0] || '-'}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{u.last_action?.split('T')[0] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ageing tab */}
      {activeTab === 'ageing' && (
        <div className="space-y-4">
          {/* Alert ageing */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Alert Ageing ({ageing?.alert_ageing?.total_open || 0} open)</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-semibold">{ageing?.alert_ageing?.overdue || 0} overdue</span>
                  <span className="text-xs text-slate-400">Avg: {ageing?.alert_ageing?.avg_resolution_hours || 0}h</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={alertAgeingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Alerts" radius={[4, 4, 0, 0]}>
                    {alertAgeingData.map((entry, i) => (
                      <Cell key={i} fill={BUCKET_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Case Ageing ({ageing?.case_ageing?.total_open || 0} open)</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-semibold">{ageing?.case_ageing?.overdue || 0} overdue</span>
                  <span className="text-xs text-slate-400">Avg: {ageing?.case_ageing?.avg_resolution_days || 0}d</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={caseAgeingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]}>
                    {caseAgeingData.map((entry, i) => (
                      <Cell key={i} fill={BUCKET_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert ageing by priority */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Alert Ageing by Priority</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Priority</th>
                    {Object.keys(ageing?.alert_ageing?.buckets || {}).map(b => (
                      <th key={b} className="text-right py-2 px-3 font-medium text-slate-600">{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['critical', 'high', 'medium', 'low'].map(p => (
                    <tr key={p} className="border-t border-slate-100">
                      <td className="py-2 px-3">
                        <Badge text={p} colors={p === 'critical' ? 'bg-red-100 text-red-800' : p === 'high' ? 'bg-amber-100 text-amber-800' : p === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'} />
                      </td>
                      {Object.keys(ageing?.alert_ageing?.buckets || {}).map(b => {
                        const val = ageing?.alert_ageing?.by_priority?.[p]?.[b] || 0
                        return (
                          <td key={b} className={`py-2 px-3 text-right font-mono ${val > 0 ? 'text-slate-700' : 'text-slate-300'}`}>{val}</td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Analysts tab */}
      {activeTab === 'analysts' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Analyst</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Department</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Open Alerts</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Open Cases</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Closed (30d)</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Confirmed</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">False Alarm</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Hit Rate</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Avg Resolution</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">SLA Compliance</th>
                </tr>
              </thead>
              <tbody>
                {analysts.map(a => (
                  <tr key={a.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-700">{a.full_name}</p>
                      <p className="text-xs text-slate-400">{a.roles?.join(', ')}</p>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{a.department}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600">{a.open_alerts}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-600">{a.open_cases}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-semibold">{a.alerts_closed_30d}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-green-600">{a.true_positive_30d}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-red-600">{a.false_positive_30d}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-mono text-xs font-semibold ${a.tp_rate >= 60 ? 'text-green-600' : a.tp_rate >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                        {a.tp_rate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 text-xs">{a.avg_resolution_hours}h</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-mono text-xs font-semibold ${a.sla_compliance >= 90 ? 'text-green-600' : a.sla_compliance >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {a.sla_compliance}%
                      </span>
                    </td>
                  </tr>
                ))}
                {analysts.length === 0 && (
                  <tr><td colSpan={10} className="py-12 text-center text-slate-400">No analyst data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
