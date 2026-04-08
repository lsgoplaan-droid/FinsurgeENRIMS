import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts'
import { Bell, Briefcase, Users, AlertTriangle, TrendingUp, Activity } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDate, formatNumber, priorityColors, statusColors, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6b7280']

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard/executive')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const stats = [
    { label: 'Total Alerts Today', value: formatNumber(data.total_alerts_today ?? 0), icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Cases', value: formatNumber(data.open_cases ?? 0), icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'High Risk Customers', value: formatNumber(data.high_risk_customers ?? 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Suspicious Transactions', value: formatNumber(data.suspicious_transactions ?? 0), icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const casesByStatus = data.cases_by_status
    ? Object.entries(data.cases_by_status).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : []

  const riskDistribution = data.risk_distribution
    ? Object.entries(data.risk_distribution).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : []

  const channelAnalytics = data.channel_analytics
    ? Object.entries(data.channel_analytics).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{s.value}</p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert trend + cases pie */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">30-Day Alert Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.alert_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Cases by Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={casesByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(props: any) => `${props.name || ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                {casesByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk distribution + channel analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riskDistribution.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.name === 'low' ? '#10b981' :
                    entry.name === 'medium' ? '#f59e0b' :
                    entry.name === 'high' ? '#f97316' : '#ef4444'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Channel Analytics</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={channelAnalytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent alerts + top risk customers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent Alerts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Alert#</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Priority</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Title</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {(data.recent_alerts || []).slice(0, 10).map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <Link to={`/alerts/${a.id}`} className="text-blue-600 hover:underline font-mono text-xs">{a.alert_number || a.id}</Link>
                    </td>
                    <td className="py-2 px-3"><Badge text={a.priority || '-'} colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'} /></td>
                    <td className="py-2 px-3 text-slate-700 truncate max-w-[200px]">{a.title}</td>
                    <td className="py-2 px-3"><Badge text={a.status || '-'} colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'} /></td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{formatDate(a.created_at)}</td>
                  </tr>
                ))}
                {(!data.recent_alerts || data.recent_alerts.length === 0) && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">No recent alerts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Risk Customers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Risk Score</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {(data.top_risk_customers || []).map((c: any) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <Link to={`/customers/${c.id}/360`} className="text-blue-600 hover:underline">{c.full_name || c.customer_number}</Link>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.risk_score}%`, backgroundColor: c.risk_score >= 75 ? '#ef4444' : c.risk_score >= 50 ? '#f97316' : c.risk_score >= 25 ? '#f59e0b' : '#10b981' }} />
                        </div>
                        <span className="text-xs font-mono">{c.risk_score}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3"><Badge text={c.risk_category || '-'} colors={riskColors[c.risk_category] || 'bg-gray-100 text-gray-800'} /></td>
                    <td className="py-2 px-3 text-slate-600">{c.alert_count ?? '-'}</td>
                  </tr>
                ))}
                {(!data.top_risk_customers || data.top_risk_customers.length === 0) && (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
