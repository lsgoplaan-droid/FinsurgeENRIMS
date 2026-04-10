import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, ComposedChart, Line
} from 'recharts'
import {
  Bell, Briefcase, ShieldAlert, TrendingUp, Activity, Clock,
  ArrowUpRight, CheckCircle2, Target, AlertTriangle, Zap, Timer,
  MapPin, Gauge, ChevronRight, FileDown
} from 'lucide-react'
import api from '../config/api'
import {
  formatINR, formatDate, formatDateTime, formatNumber, timeAgo,
  priorityColors, statusColors, riskColors
} from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
    {text.replace(/_/g, ' ')}
  </span>
)

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6b7280']

interface StatCardProps {
  label: string
  value: string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  pulse?: boolean
  href?: string
}

function StatCard({ label, value, subtitle, icon: Icon, iconColor, iconBg, pulse, href }: StatCardProps) {
  const navigate = useNavigate()
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all ${href ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}`}
      onClick={() => href && navigate(href)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-slate-800 mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0 relative`}>
          <Icon className={iconColor} size={18} />
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          )}
        </div>
      </div>
      {href && <p className="text-[10px] text-blue-500 mt-1.5 font-medium">Click to view details &rarr;</p>}
    </div>
  )
}

function SmallStatCard({ label, value, icon: Icon, iconColor, href }: {
  label: string; value: string; icon: React.ElementType; iconColor: string; href?: string
}) {
  const navigate = useNavigate()
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3 transition-all ${href ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}`}
      onClick={() => href && navigate(href)}
    >
      <Icon className={iconColor} size={16} />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [executive, setExecutive] = useState<any>(null)
  const [fraudMetrics, setFraudMetrics] = useState<any>(null)
  const [geoRisk, setGeoRisk] = useState<any>(null)
  const [riskAppetite, setRiskAppetite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedState, setSelectedState] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/executive'),
      api.get('/fraud-metrics/summary').catch(() => ({ data: null })),
      api.get('/dashboard/geo-risk').catch(() => ({ data: null })),
      api.get('/dashboard/risk-appetite').catch(() => ({ data: null })),
    ])
      .then(([execRes, fraudRes, geoRes, appetiteRes]) => {
        setExecutive(execRes.data)
        setFraudMetrics(fraudRes.data)
        setGeoRisk(geoRes.data)
        setRiskAppetite(appetiteRes.data)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md">
          <AlertTriangle className="text-red-500 mx-auto mb-2" size={24} />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const fm = fraudMetrics || {}
  const fraudLoss = fm.fraud_loss || {}
  const recovery = fm.recovery || {}
  const alertPerf = fm.alert_performance || {}
  const operational = fm.operational || {}
  const liveStats = fm.live_stats || {}
  const dailyTrend = fm.daily_trend || []

  const slaComplianceRate = alertPerf.sla_compliance_rate ?? 0
  const slaColor = slaComplianceRate >= 90

  const riskDistribution = executive?.risk_distribution
    ? Object.entries(executive.risk_distribution).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value: value as number,
      }))
    : []

  const trendData = dailyTrend.map((d: any) => ({
    date: d.date,
    alerts: d.alerts ?? d.count ?? 0,
    flagged_amount: (d.flagged_amount ?? 0) / 100,
  }))

  return (
    <div className="space-y-5">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">CRO Dashboard</h1>
          <p className="text-xs text-slate-500">Enterprise Risk Management Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const token = localStorage.getItem('token')
              fetch(`${api.defaults.baseURL}/reports/board-report`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then(res => res.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `Board_Report_${new Date().toISOString().slice(0, 10)}.pdf`
                  a.click()
                  URL.revokeObjectURL(url)
                })
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
          >
            <FileDown size={14} />
            Board Report
          </button>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-slate-600">
              System Active
            </span>
            <span className="text-xs text-slate-400">
              {formatNumber(liveStats.transactions_per_hour ?? 0)} txns/hr
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: 6 primary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Fraud Loss (MTD)"
          value={formatINR(fraudLoss.monthly ?? 0)}
          icon={ShieldAlert}
          iconColor="text-red-600"
          iconBg="bg-red-50"
          href="/fraud-detection"
        />
        <StatCard
          label="Recovered Amount"
          value={formatINR(recovery.amount ?? 0)}
          subtitle="Via FIR / Insurance / Court orders"
          icon={ArrowUpRight}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          href="/mis-reports"
        />
        <StatCard
          label="Recovery Rate"
          value={`${recovery.rate ?? 0}%`}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          href="/mis-reports"
        />
        <StatCard
          label="Alert Accuracy"
          value={`${alertPerf.true_positive_rate ?? 0}%`}
          icon={Target}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          href="/alerts?status=closed"
        />
        <StatCard
          label="SLA Compliance"
          value={`${slaComplianceRate}%`}
          icon={Timer}
          iconColor={slaColor ? 'text-green-600' : 'text-red-600'}
          iconBg={slaColor ? 'bg-green-50' : 'bg-red-50'}
          href="/sla-burndown"
        />
        <StatCard
          label="Live Txn Rate"
          value={`${formatNumber(liveStats.transactions_per_hour ?? 0)}/hr`}
          icon={Zap}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          pulse
          href="/transactions"
        />
      </div>

      {/* Row 2: 5 smaller operational cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <SmallStatCard
          label="Avg Resolution"
          value={`${operational.avg_resolution_days ?? '-'} days`}
          icon={Clock}
          iconColor="text-slate-500"
          href="/mis-reports"
        />
        <SmallStatCard
          label="Open Cases"
          value={formatNumber(executive?.open_cases ?? 0)}
          icon={Briefcase}
          iconColor="text-amber-500"
          href="/cases?status=assigned,under_investigation,escalated"
        />
        <SmallStatCard
          label="Alerts Today"
          value={formatNumber(executive?.total_alerts_today ?? 0)}
          icon={Bell}
          iconColor="text-blue-500"
          href="/alerts?date=today"
        />
        <SmallStatCard
          label="Escalation Rate"
          value={`${operational.escalation_rate ?? 0}%`}
          icon={TrendingUp}
          iconColor="text-orange-500"
          href="/cases?status=escalated"
        />
        <SmallStatCard
          label="SLA Breach Rate"
          value={`${operational.sla_breach_rate ?? 0}%`}
          icon={AlertTriangle}
          iconColor="text-red-500"
          href="/sla-burndown"
        />
      </div>

      {/* Row 3: Geographic Risk Heatmap + Risk Appetite */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT (2/3): India State Risk Heatmap */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-700">Geographic Risk Heatmap</h3>
            </div>
            {geoRisk?.summary?.hotspot && (
              <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                Hotspot: {geoRisk.summary.hotspot}
              </span>
            )}
          </div>

          {geoRisk?.states?.length > 0 ? (
            <div className="space-y-3">
              {/* State bars — visual risk representation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(geoRisk.states || []).map((s: any) => {
                  const riskPct = Math.min(s.avg_risk, 100)
                  const barColor = riskPct >= 70 ? '#ef4444' : riskPct >= 50 ? '#f97316' : riskPct >= 30 ? '#f59e0b' : '#10b981'
                  const isSelected = selectedState?.state === s.state
                  return (
                    <div
                      key={s.state}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                      onClick={() => setSelectedState(isSelected ? null : s)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-700">{s.state}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{s.customers} customers</span>
                          <span className="text-xs font-bold" style={{ color: barColor }}>{s.avg_risk}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${riskPct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span>{s.high_risk_count} very high risk</span>
                        <span>{s.open_alerts} open alerts</span>
                        {s.flagged_amount > 0 && <span>{formatINR(s.flagged_amount)} flagged</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected state detail panel */}
              {selectedState && (
                <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-blue-900">{selectedState.state} — Detail</h4>
                    <button onClick={() => setSelectedState(null)} className="text-xs text-blue-600 hover:underline">Close</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['Customers', selectedState.customers],
                      ['Avg Risk Score', selectedState.avg_risk],
                      ['Very High Risk', selectedState.high_risk_count],
                      ['Open Alerts', selectedState.open_alerts],
                      ['Transaction Vol', formatINR(selectedState.transaction_volume)],
                      ['Flagged Amount', formatINR(selectedState.flagged_amount)],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-[10px] text-blue-600 font-medium">{label}</p>
                        <p className="text-sm font-bold text-blue-900">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    to={`/customers?state=${selectedState.state}&risk_category=very_high`}
                    className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 font-medium hover:underline"
                  >
                    View very-high-risk customers in {selectedState.state} <ChevronRight size={12} />
                  </Link>
                </div>
              )}

              {/* Summary bar */}
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span><strong>{geoRisk.summary.total_states}</strong> states</span>
                <span><strong>{geoRisk.summary.total_customers}</strong> customers</span>
                <span className="text-red-600"><strong>{geoRisk.summary.total_high_risk}</strong> very very high risk</span>
                <span><strong>{geoRisk.summary.total_open_alerts}</strong> open alerts</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              No geographic data available
            </div>
          )}
        </div>

        {/* RIGHT (1/3): Risk Appetite Meter */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-purple-600" />
              <h3 className="text-sm font-semibold text-slate-700">Risk Appetite</h3>
            </div>
            <Link to="/risk-appetite" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
              Breach Detail <ChevronRight size={12} />
            </Link>
          </div>

          {riskAppetite?.metrics ? (
            <div className="space-y-4">
              {/* Overall status badge */}
              <div className={`text-center py-3 rounded-lg ${
                riskAppetite.summary.overall_status === 'breach' ? 'bg-red-50 border border-red-200' :
                riskAppetite.summary.overall_status === 'warning' ? 'bg-amber-50 border border-amber-200' :
                'bg-green-50 border border-green-200'
              }`}>
                <p className={`text-lg font-bold ${
                  riskAppetite.summary.overall_status === 'breach' ? 'text-red-700' :
                  riskAppetite.summary.overall_status === 'warning' ? 'text-amber-700' : 'text-green-700'
                }`}>
                  {riskAppetite.summary.overall_status === 'breach' ? 'APPETITE BREACHED' :
                   riskAppetite.summary.overall_status === 'warning' ? 'APPROACHING LIMIT' : 'WITHIN APPETITE'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {riskAppetite.summary.breaches} breach{riskAppetite.summary.breaches !== 1 ? 'es' : ''}, {riskAppetite.summary.warnings} warning{riskAppetite.summary.warnings !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Metric gauges */}
              {(riskAppetite.metrics || []).map((m: any) => {
                const pct = m.threshold.limit > 0 ? Math.min((m.value / m.threshold.limit) * 100, 120) : 0
                const barColor = m.status === 'breach' ? '#ef4444' : m.status === 'warning' ? '#f59e0b' : '#10b981'
                return (
                  <Link
                    to={`/risk-appetite#${m.id}`}
                    key={m.id}
                    className="block hover:bg-slate-50 rounded p-1 -m-1 transition-colors"
                    title={`Click for breach detail. Status: ${m.status.toUpperCase()}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">{m.label}</span>
                      <span className="text-xs font-bold" style={{ color: barColor }}>
                        {m.value}{m.unit}
                      </span>
                    </div>
                    <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-visible">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                      />
                      {/* Warning threshold marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-amber-400"
                        style={{ left: `${(m.threshold.warning / m.threshold.limit) * 100}%` }}
                        title={`Warning: ${m.threshold.warning}`}
                      />
                      {/* Limit marker */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-red-500"
                        style={{ left: '100%' }}
                        title={`Limit: ${m.threshold.limit}`}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-slate-400">0</span>
                      <span className="text-[9px] text-red-400">Limit: {m.threshold.limit}{m.unit}</span>
                    </div>
                  </Link>
                )
              })}

              {/* Quick stats */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="text-center">
                  <p className="font-bold text-slate-800">{riskAppetite.summary.open_alerts}</p>
                  <p className="text-slate-400">Open Alerts</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-red-600">{riskAppetite.summary.overdue_alerts}</p>
                  <p className="text-slate-400">Overdue</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800">{riskAppetite.summary.open_cases}</p>
                  <p className="text-slate-400">Open Cases</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-purple-600">{riskAppetite.summary.pep_count}</p>
                  <p className="text-slate-400">PEP Customers</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              No risk appetite data
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Two charts side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* LEFT: 14-Day Alert & Loss Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">14-Day Alert &amp; Loss Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Alerts', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${(v / 100000).toFixed(0)}L`}
                  label={{ value: 'Flagged Amt', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#94a3b8' } }}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === 'flagged_amount') return [`Rs ${Number(value).toLocaleString('en-IN')}`, 'Flagged Amount']
                    return [value, 'Alerts']
                  }}
                  labelFormatter={(label: any) => `Date: ${label}`}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="alerts" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Alerts" opacity={0.8} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="flagged_amount"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444' }}
                  name="Flagged Amount"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              No trend data available
            </div>
          )}
        </div>

        {/* RIGHT: Risk Distribution Pie (clickable drill-down) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Risk Distribution</h3>
          <p className="text-[10px] text-blue-500 mb-3 font-medium">Click any segment to view customers</p>
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
                  innerRadius={50}
                  label={(props: any) =>
                    `${props.name || ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={{ strokeWidth: 1 }}
                  cursor="pointer"
                  onClick={(data: any) => {
                    if (data && data.name) {
                      const riskKey = data.name.replace(/ /g, '_')
                      window.location.href = `/customers?risk_category=${riskKey}`
                    }
                  }}
                >
                  {riskDistribution.map((entry, i) => {
                    const color =
                      entry.name === 'low' ? '#10b981' :
                      entry.name === 'medium' ? '#f59e0b' :
                      entry.name === 'high' ? '#f97316' :
                      entry.name === 'very high' ? '#ef4444' :
                      PIE_COLORS[i % PIE_COLORS.length]
                    return <Cell key={i} fill={color} />
                  })}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
              No risk distribution data
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Alerts + Top Risk Customers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* LEFT: Recent Alerts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Recent Alerts</h3>
            <Link to="/alerts" className="text-xs text-blue-600 hover:underline font-medium">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Alert#</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Priority</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Title</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Time</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {(executive?.recent_alerts || []).slice(0, 10).map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3">
                      <Link
                        to={`/alerts/${a.id}`}
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        {a.alert_number || a.id}
                      </Link>
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        text={a.priority || '-'}
                        colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                    <td className="py-2 px-3 text-slate-700 truncate max-w-[180px] text-xs">
                      {a.title}
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        text={a.status || '-'}
                        colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-xs whitespace-nowrap">
                      {a.created_at ? timeAgo(a.created_at) : '-'}
                    </td>
                    <td className="py-2 px-3">
                      <Link
                        to={`/alerts/${a.id}`}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!executive?.recent_alerts || executive.recent_alerts.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No recent alerts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Top Risk Customers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Top Risk Customers</h3>
            <Link to="/customers" className="text-xs text-blue-600 hover:underline font-medium">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Customer</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Risk Score</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Category</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600 text-xs">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {(executive?.top_risk_customers || []).map((c: any) => {
                  const score = c.risk_score ?? 0
                  const scoreColor = score >= 70 ? 'text-red-600' : score >= 40 ? 'text-amber-600' : 'text-green-600'
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <Link
                          to={`/customers/${c.id}/360`}
                          className="text-blue-600 hover:underline font-medium text-xs"
                        >
                          {c.full_name || c.customer_number}
                        </Link>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-lg font-bold ${scoreColor}`}>
                          {score}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          text={c.risk_category || '-'}
                          colors={riskColors[c.risk_category] || 'bg-gray-100 text-gray-800'}
                        />
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{c.alert_count ?? '-'}</td>
                    </tr>
                  )
                })}
                {(!executive?.top_risk_customers || executive.top_risk_customers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
