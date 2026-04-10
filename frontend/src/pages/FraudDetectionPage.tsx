import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle, TrendingUp, Zap, CreditCard, Smartphone, Globe, Building2, Monitor } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../config/api'
import { formatINR, formatNumber, formatDateTime, priorityColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const CHART_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899']

const channelIcons: Record<string, any> = {
  branch: Building2, atm: CreditCard, internet_banking: Monitor,
  mobile_banking: Smartphone, pos: CreditCard, swift: Globe,
}

export default function FraudDetectionPage() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [fraudMetrics, setFraudMetrics] = useState<any>(null)
  const [rules, setRules] = useState<any[]>([])
  const [liveFeed, setLiveFeed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'rules' | 'live'>('overview')
  const [drillDown, setDrillDown] = useState<{ title: string; data: any[] } | null>(null)
  const navigate = useNavigate()

  // Get month-to-date date range for metrics matching
  const getMTDDates = () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      dateFrom: monthStart.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    }
  }

  const fetchData = () => {
    setLoading(true)
    Promise.allSettled([
      api.get('/fraud-detection/dashboard'),
      api.get('/fraud-detection/rules'),
      api.get('/fraud-detection/live-feed?page_size=15'),
      api.get('/fraud-metrics/summary'),
    ]).then(([dashRes, rulesRes, feedRes, metricsRes]) => {
      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data)
      if (rulesRes.status === 'fulfilled') setRules(rulesRes.value.data)
      if (feedRes.status === 'fulfilled') setLiveFeed(feedRes.value.data.items || [])
      if (metricsRes.status === 'fulfilled') setFraudMetrics(metricsRes.value.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (!dashboard) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-red-500">Failed to load fraud detection data</p>
      <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Retry</button>
    </div>
  )

  const channelData = Object.entries(dashboard.fraud_by_channel || {}).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
  const methodData = Object.entries(dashboard.fraud_by_method || {}).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield size={24} className="text-red-600" /> Fraud Detection Center
        </h2>
        <p className="text-sm text-slate-500 mt-1">Real-time fraud monitoring, detection rules, and live threat feed</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'rules', label: `Detection Rules (${rules.length})` },
          { key: 'live', label: 'Live Threat Feed' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Fraud Loss (MTD)', value: formatINR(fraudMetrics?.fraud_loss?.monthly || 0), color: 'text-red-700', icon: TrendingUp, onClick: () => {
                const { dateFrom, dateTo } = getMTDDates()
                navigate(`/transactions?is_flagged=true&date_from=${dateFrom}&date_to=${dateTo}`)
              } },
              // Drill-down URLs match the dashboard counts exactly:
              // - "Fraud Alerts Today" counts ALL fraud alerts created today (any status)
              // - "Open Fraud Alerts" counts ALL fraud alerts not in a closed* status (status=open)
              // - "Active Fraud Cases" counts fraud_investigation cases not in closed* status
              { label: 'Fraud Alerts Today', value: dashboard.fraud_alerts_today, color: 'text-red-600', icon: AlertTriangle, onClick: () => navigate('/alerts?date=today&alert_type=fraud') },
              { label: 'Open Fraud Alerts', value: dashboard.open_fraud_alerts, color: 'text-amber-600', icon: Zap, onClick: () => navigate('/alerts?status=open&alert_type=fraud') },
              { label: 'Active Fraud Cases', value: dashboard.active_fraud_cases, color: 'text-blue-600', icon: Shield, onClick: () => navigate('/cases?status=open&case_type=fraud_investigation') },
              { label: 'Flagged Txns Today', value: dashboard.flagged_transactions_today, color: 'text-purple-600', icon: TrendingUp, onClick: () => setTab('live') },
              { label: 'Amount at Risk (7d)', value: formatINR(dashboard.amount_at_risk || 0), color: 'text-red-700', icon: CreditCard, onClick: () => setTab('live') },
            ].map((kpi, i) => (
              <div key={i} onClick={kpi.onClick} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase">{kpi.label}</span>
                  <kpi.icon size={16} className={kpi.color} />
                </div>
                <div className={`text-2xl font-bold ${kpi.color}`}>{typeof kpi.value === 'number' ? formatNumber(kpi.value) : kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Fraud by Channel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Fraud by Channel (7 days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={channelData} onClick={(data: any) => {
                  if (data?.activePayload?.[0]) {
                    const item = data.activePayload[0].payload
                    setDrillDown({ title: `Fraud Details — ${item.name}`, data: channelData })
                  }
                }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fraud by Method */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Fraud by Method (7 days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={methodData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                    onClick={(_, index) => {
                      setDrillDown({ title: `Fraud Details — ${methodData[index]?.name}`, data: methodData })
                    }}
                    cursor="pointer"
                  >
                    {methodData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Rules + Recent Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Triggered Rules */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Triggered Fraud Rules</h3>
              <div className="space-y-2">
                {(dashboard.top_fraud_rules || []).slice(0, 7).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded" onClick={() => navigate('/rules')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.subcategory?.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                      <span className="text-sm font-mono font-semibold text-slate-700 w-12 text-right">{r.detections}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Fraud Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Fraud Alerts</h3>
              <div className="space-y-2">
                {(dashboard.recent_fraud_alerts || []).slice(0, 7).map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded"
                    onClick={() => navigate(`/alerts/${a.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{a.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{a.alert_number}</span>
                        <span className="text-xs text-slate-500">{a.customer_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge text={a.priority} colors={priorityColors[a.priority] || ''} />
                      <span className="text-xs font-mono text-red-600 font-semibold">{a.risk_score?.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {tab === 'rules' && (() => {
        const categoryOrder = ['fraud', 'cyber_fraud', 'ai_fraud', 'internal_fraud']
        const categoryLabels: Record<string, string> = {
          fraud: 'Transaction & Card Fraud',
          cyber_fraud: 'Cyber Fraud',
          ai_fraud: 'AI & Deepfake Fraud',
          internal_fraud: 'Internal / Insider Fraud',
        }
        const grouped = categoryOrder.map(cat => ({
          key: cat,
          label: categoryLabels[cat] || cat,
          rules: rules.filter(r => (r.category || 'fraud') === cat),
        })).filter(g => g.rules.length > 0)

        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-3 px-5">
              <span className="text-sm font-semibold text-slate-700">{rules.length} Detection Rules</span>
              <div className="flex items-center gap-3 ml-4 text-xs text-slate-500">
                {grouped.map(g => (
                  <span key={g.key}><strong className="text-slate-700">{g.rules.length}</strong> {g.label}</span>
                ))}
              </div>
            </div>

            {grouped.map(group => (
              <div key={group.key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700">{group.label} ({group.rules.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs w-[120px]">Rule ID</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">Rule Name</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">Description</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs w-[80px]">Severity</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs w-[70px]">Action</th>
                        <th className="text-right py-2 px-4 font-medium text-slate-500 text-xs w-[80px]">Detections</th>
                        <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs w-[70px]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rules.map(r => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/30">
                          <td className="py-2.5 px-4 font-mono text-xs font-semibold text-blue-600">{r.rule_id}</td>
                          <td className="py-2.5 px-4">
                            <p className="text-sm font-medium text-slate-700">{r.name}</p>
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="text-xs text-slate-500">{r.description || '-'}</p>
                          </td>
                          <td className="py-2.5 px-4"><Badge text={r.severity} colors={severityColors[r.severity] || ''} /></td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">{r.action_summary}</span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">{formatNumber(r.detection_count)}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                              {r.is_enabled ? 'Active' : 'Off'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Live Feed Tab */}
      {tab === 'live' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-slate-600">Live Flagged Transaction Feed</span>
          </div>

          {liveFeed.map(t => {
            const ChannelIcon = channelIcons[t.channel] || Monitor
            return (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.risk_score > 70 ? 'bg-red-100' : t.risk_score > 40 ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      <ChannelIcon size={20} className={t.risk_score > 70 ? 'text-red-600' : t.risk_score > 40 ? 'text-amber-600' : 'text-blue-600'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{t.customer_name}</span>
                        <span className="text-xs font-mono text-slate-400">{t.transaction_ref}</span>
                      </div>
                      <p className="text-xs text-red-600 font-medium mt-0.5">{t.flag_reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{t.channel?.replace(/_/g, ' ')}</span>
                        <span>{t.method?.replace(/_/g, ' ')}</span>
                        <span>{t.location_city}</span>
                        <span>{formatDateTime(t.transaction_date)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">{formatINR(t.amount)}</div>
                    <div className={`text-sm font-mono font-bold ${t.risk_score > 70 ? 'text-red-600' : t.risk_score > 40 ? 'text-amber-600' : 'text-blue-600'}`}>
                      Score: {t.risk_score?.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {liveFeed.length === 0 && (
            <div className="text-center py-12 text-slate-400">No flagged transactions found</div>
          )}
        </div>
      )}

      {/* Drill-Down Modal */}
      {drillDown && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDrillDown(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-4">{drillDown.title}</h2>
            <div className="space-y-2">
              {drillDown.data.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 capitalize">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, ((item.value as number) / Math.max(...drillDown.data.map((d: any) => d.value as number))) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 w-10 text-right">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setDrillDown(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
