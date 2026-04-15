import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts'
import { Activity, Shield, FileText, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import api from '../config/api'
import { formatNumber, formatINR } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6b7280', '#ec4899', '#14b8a6']

type TabKey = 'operational' | 'risk' | 'regulatory' | 'productivity'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'operational', label: 'Operational', icon: Activity },
  { key: 'risk', label: 'Risk', icon: Shield },
  { key: 'regulatory', label: 'Regulatory', icon: FileText },
  { key: 'productivity', label: 'Productivity', icon: Users },
]

export default function MISReportsPage() {
  const [tab, setTab] = useState<TabKey>('operational')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get(`/mis-reports/${tab}`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load report data'))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-red-500">{error}</div>
      ) : (
        <>
          {tab === 'operational' && <OperationalTab data={data} />}
          {tab === 'risk' && <RiskTab data={data} />}
          {tab === 'regulatory' && <RegulatoryTab data={data} />}
          {tab === 'productivity' && <ProductivityTab data={data} />}
        </>
      )}
    </div>
  )
}

/* ======================= OPERATIONAL TAB ======================= */
function OperationalTab({ data }: { data: any }) {
  const txnMetrics = data?.transaction_metrics || data?.transactions || {}
  const alertMetrics = data?.alert_metrics || data?.alerts || {}
  const caseMetrics = data?.case_metrics || data?.cases || {}
  const channelBreakdown = data?.channel_breakdown
    ? Object.entries(data.channel_breakdown).map(([name, value]) => ({ name, value }))
    : data?.channels || []

  return (
    <div className="space-y-4">
      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Transaction metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Transaction Metrics</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Count</span>
              <span className="text-sm font-semibold text-slate-800">{formatNumber(txnMetrics.count ?? txnMetrics.total_count ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Volume</span>
              <span className="text-sm font-semibold text-slate-800">{formatINR(txnMetrics.volume ?? txnMetrics.total_volume ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Flagged Rate</span>
              <span className="text-sm font-semibold text-red-600">{(txnMetrics.flagged_rate ?? txnMetrics.flagged_percentage ?? 0).toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Alert metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Alert Metrics</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Alerts</span>
              <span className="text-sm font-semibold text-slate-800">{formatNumber(alertMetrics.total ?? alertMetrics.total_alerts ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Open</span>
              <span className="text-sm font-semibold text-amber-600">{formatNumber(alertMetrics.open ?? alertMetrics.open_alerts ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Closed</span>
              <span className="text-sm font-semibold text-green-600">{formatNumber(alertMetrics.closed ?? alertMetrics.closed_alerts ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Case metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Case Metrics</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Cases</span>
              <span className="text-sm font-semibold text-slate-800">{formatNumber(caseMetrics.total ?? caseMetrics.total_cases ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Open</span>
              <span className="text-sm font-semibold text-amber-600">{formatNumber(caseMetrics.open ?? caseMetrics.open_cases ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Resolved</span>
              <span className="text-sm font-semibold text-green-600">{formatNumber(caseMetrics.resolved ?? caseMetrics.resolved_cases ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Channel breakdown chart */}
      {channelBreakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Channel Breakdown</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={channelBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ======================= RISK TAB ======================= */
function RiskTab({ data }: { data: any }) {
  const riskDistribution = data?.customer_risk_distribution
    ? Object.entries(data.customer_risk_distribution).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : data?.risk_distribution || []

  const topRules = data?.top_triggered_rules || []

  const alertByType = data?.alert_distribution_by_type
    ? Object.entries(data.alert_distribution_by_type).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : data?.alert_by_type || []

  const alertByPriority = data?.alert_distribution_by_priority
    ? Object.entries(data.alert_distribution_by_priority).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : data?.alert_by_priority || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Risk distribution pie */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Customer Risk Distribution</h4>
          {riskDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props: any) => `${props.name || ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {riskDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-slate-400">No data available</div>
          )}
        </div>

        {/* Top triggered rules table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Top Triggered Rules</h4>
          {topRules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Rule</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Triggers</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {topRules.map((rule: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2 px-3 text-slate-700">{rule.name || rule.rule_name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800">{formatNumber(rule.count || rule.triggers || 0)}</td>
                      <td className="py-2 px-3">
                        <Badge text={rule.category || '-'} colors="bg-slate-100 text-slate-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">No data available</div>
          )}
        </div>
      </div>

      {/* Alert distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {alertByType.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Alert Distribution by Type</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={alertByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {alertByPriority.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">Alert Distribution by Priority</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={alertByPriority}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {alertByPriority.map((entry: any, i: number) => (
                    <Cell key={i} fill={
                      entry.name === 'critical' ? '#ef4444' :
                      entry.name === 'high' ? '#f97316' :
                      entry.name === 'medium' ? '#f59e0b' : '#10b981'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

/* ======================= REGULATORY TAB ======================= */
function RegulatoryTab({ data }: { data: any }) {
  const ctr = data?.ctr || data?.ctr_status || {}
  const sar = data?.sar || data?.sar_status || {}
  const filingCards = [
    { label: 'CTR Filed', value: ctr.filed ?? 0, total: (ctr.filed ?? 0) + (ctr.pending ?? 0), color: 'text-green-600', barColor: 'bg-green-500' },
    { label: 'CTR Pending', value: ctr.pending ?? 0, total: (ctr.filed ?? 0) + (ctr.pending ?? 0), color: 'text-amber-600', barColor: 'bg-amber-500' },
    { label: 'STR filed', value: sar.filed ?? 0, total: (sar.filed ?? 0) + (sar.pending ?? 0), color: 'text-green-600', barColor: 'bg-green-500' },
    { label: 'STR Pending', value: sar.pending ?? 0, total: (sar.filed ?? 0) + (sar.pending ?? 0), color: 'text-amber-600', barColor: 'bg-amber-500' },
  ]

  return (
    <div className="space-y-4">
      {/* Filing status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {filingCards.map(card => {
          const pct = card.total > 0 ? (card.value / card.total) * 100 : 0
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{formatNumber(card.value)}</p>
              <div className="mt-3">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${card.barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">{pct.toFixed(0)}% of total</p>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

/* ======================= PRODUCTIVITY TAB ======================= */
function ProductivityTab({ data }: { data: any }) {
  const analysts = data?.analysts || data?.analyst_productivity || []

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-slate-700">Analyst Productivity</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Department</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Alerts Assigned</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Alerts Closed (30d)</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Open Alerts</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Cases</th>
              </tr>
            </thead>
            <tbody>
              {analysts.map((a: any, i: number) => (
                <tr key={a.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-medium text-slate-700">{a.name || a.full_name || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-600">{a.department || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatNumber(a.alerts_assigned ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-green-600">{formatNumber(a.alerts_closed_30d ?? a.alerts_closed ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-600">{formatNumber(a.open_alerts ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatNumber(a.cases ?? a.total_cases ?? 0)}</td>
                </tr>
              ))}
              {analysts.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">No analyst data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
