import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock, AlertTriangle, CheckCircle, XCircle, Shield,
  Timer, TrendingDown, ChevronRight
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../config/api'
import { formatNumber, formatDateTime } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

function HoursLabel({ hours }: { hours: number | null }) {
  if (hours === null || hours === undefined) return <span className="text-xs text-slate-400">No SLA</span>
  if (hours < 0) {
    return <span className="text-xs font-semibold text-red-600">{Math.abs(hours).toFixed(1)}h overdue</span>
  }
  if (hours < 4) {
    return <span className="text-xs font-semibold text-amber-600">{hours.toFixed(1)}h left</span>
  }
  return <span className="text-xs text-green-600">{hours.toFixed(1)}h left</span>
}

export default function SLABurndownPage() {
  const navigate = useNavigate()
  const [alertData, setAlertData] = useState<any>(null)
  const [caseData, setCaseData] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'alerts' | 'cases'>('alerts')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/sla-burndown/alerts'),
      api.get('/sla-burndown/cases'),
      api.get('/sla-burndown/stats'),
    ])
      .then(([alertsRes, casesRes, statsRes]) => {
        setAlertData(alertsRes.data)
        setCaseData(casesRes.data)
        setStats(statsRes.data)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load SLA data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const alertSummary = alertData?.summary || {}
  const caseSummary = caseData?.summary || {}

  const statCards = [
    { label: 'SLA Breached', value: alertSummary.breached + caseSummary.breached, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'At Risk (EOD)', value: alertSummary.at_risk_eod + caseSummary.at_risk_eod, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approaching (24h)', value: alertSummary.approaching_24h + caseSummary.approaching_24h, icon: Timer, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Overall Compliance', value: `${stats?.overall_compliance || 0}%`, icon: Shield, color: stats?.overall_compliance >= 90 ? 'text-green-600' : stats?.overall_compliance >= 70 ? 'text-amber-600' : 'text-red-600', bg: stats?.overall_compliance >= 90 ? 'bg-green-50' : stats?.overall_compliance >= 70 ? 'bg-amber-50' : 'bg-red-50' },
  ]

  // Chart: burndown bar visualization
  const burndownData = [
    { name: 'Breached', alerts: alertSummary.breached, cases: caseSummary.breached },
    { name: 'At Risk EOD', alerts: alertSummary.at_risk_eod, cases: caseSummary.at_risk_eod },
    { name: 'Next 24h', alerts: alertSummary.approaching_24h, cases: caseSummary.approaching_24h },
    { name: 'On Track', alerts: alertSummary.on_track, cases: caseSummary.on_track },
  ]

  const currentData = activeTab === 'alerts' ? alertData : caseData
  const breached = currentData?.breached || []
  const atRisk = currentData?.at_risk_eod || []
  const approaching = currentData?.approaching || []
  const onTrack = currentData?.on_track || []

  const handleClick = (item: any) => {
    if (activeTab === 'alerts') {
      navigate(`/alerts/${item.id}`)
    } else {
      navigate(`/cases/${item.id}`)
    }
  }

  const ItemRow = ({ item, urgency }: { item: any; urgency: 'breached' | 'at_risk' | 'approaching' | 'on_track' }) => {
    const urgencyColors = {
      breached: 'border-l-red-500 bg-red-50/50',
      at_risk: 'border-l-amber-500 bg-amber-50/50',
      approaching: 'border-l-blue-500',
      on_track: 'border-l-green-500',
    }

    return (
      <div
        onClick={() => handleClick(item)}
        className={`flex items-center justify-between p-3 border-l-4 rounded-r-lg hover:bg-slate-50 cursor-pointer transition-colors ${urgencyColors[urgency]}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-blue-600 font-semibold">{item.alert_number || item.case_number}</span>
            <Badge text={item.priority || '-'} colors={priorityColors[item.priority] || 'bg-gray-100 text-gray-800'} />
            <span className="text-xs text-slate-400">{item.status?.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-sm text-slate-700 mt-0.5 truncate">{item.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {item.assignee_name && <span>Assigned: {item.assignee_name}</span>}
            {item.sla_due_at && <span>Due: {formatDateTime(item.sla_due_at)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <HoursLabel hours={item.hours_remaining} />
          <ChevronRight size={14} className="text-slate-400" />
        </div>
      </div>
    )
  }

  const Section = ({ title, items, urgency, icon: Icon, iconColor, emptyText }: {
    title: string; items: any[]; urgency: 'breached' | 'at_risk' | 'approaching' | 'on_track';
    icon: any; iconColor: string; emptyText: string;
  }) => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={iconColor} />
        <h3 className="text-sm font-semibold text-slate-700">{title} ({items.length})</h3>
      </div>
      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map(item => <ItemRow key={item.id} item={item} urgency={urgency} />)}
        </div>
      ) : (
        <div className="text-xs text-slate-400 py-3 px-4 bg-slate-50 rounded-lg">{emptyText}</div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
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
          </div>
        ))}
      </div>

      {/* Compliance gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Alert SLA Compliance</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(stats?.alert_sla?.compliance_rate || 0) >= 90 ? 'bg-green-500' : (stats?.alert_sla?.compliance_rate || 0) >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${stats?.alert_sla?.compliance_rate || 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>{stats?.alert_sla?.compliant || 0} compliant</span>
                <span>{stats?.alert_sla?.breached || 0} breached</span>
              </div>
            </div>
            <span className={`text-2xl font-bold ${(stats?.alert_sla?.compliance_rate || 0) >= 90 ? 'text-green-600' : (stats?.alert_sla?.compliance_rate || 0) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {stats?.alert_sla?.compliance_rate || 0}%
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Case SLA Compliance</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(stats?.case_sla?.compliance_rate || 0) >= 90 ? 'bg-green-500' : (stats?.case_sla?.compliance_rate || 0) >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${stats?.case_sla?.compliance_rate || 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>{stats?.case_sla?.compliant || 0} compliant</span>
                <span>{stats?.case_sla?.breached || 0} breached</span>
              </div>
            </div>
            <span className={`text-2xl font-bold ${(stats?.case_sla?.compliance_rate || 0) >= 90 ? 'text-green-600' : (stats?.case_sla?.compliance_rate || 0) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {stats?.case_sla?.compliance_rate || 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Burndown chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">SLA Status Distribution</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={burndownData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="alerts" name="Alerts" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {burndownData.map((entry, i) => (
                <Cell key={i} fill={['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'][i]} />
              ))}
            </Bar>
            <Bar dataKey="cases" name="Cases" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
              {burndownData.map((entry, i) => (
                <Cell key={i} fill={['#fca5a5', '#fcd34d', '#93c5fd', '#86efac'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'alerts', label: `Alerts (${alertSummary.total_open || 0})` },
          { key: 'cases', label: `Cases (${caseSummary.total_open || 0})` },
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

      {/* Item lists by urgency */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6">
        <Section title="SLA Breached" items={breached} urgency="breached" icon={XCircle} iconColor="text-red-500" emptyText="No SLA breaches" />
        <Section title="At Risk — Due Before EOD" items={atRisk} urgency="at_risk" icon={AlertTriangle} iconColor="text-amber-500" emptyText="No items at risk for EOD" />
        <Section title="Approaching — Due Within 24h" items={approaching} urgency="approaching" icon={Clock} iconColor="text-blue-500" emptyText="No items approaching deadline" />
        <Section title="On Track" items={onTrack.slice(0, 10)} urgency="on_track" icon={CheckCircle} iconColor="text-green-500" emptyText="No open items" />
        {onTrack.length > 10 && (
          <p className="text-xs text-slate-400 text-center">+ {onTrack.length - 10} more on track</p>
        )}
      </div>
    </div>
  )
}
