import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, CircleAlert, Skull, Shield, Clock,
  Monitor, Wifi, User, Search, Filter, ChevronDown, BookOpen
} from 'lucide-react'
import api from '../config/api'
import { formatDateTime, formatNumber } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const riskBadgeColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

const statusBadgeColors: Record<string, string> = {
  normal: 'bg-green-100 text-green-800',
  suspicious: 'bg-amber-100 text-amber-800',
  under_review: 'bg-red-100 text-red-800',
  cleared: 'bg-blue-100 text-blue-800',
  confirmed_fraud: 'bg-red-100 text-red-800',
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'normal':
      return <CheckCircle size={16} className="text-green-500" />
    case 'suspicious':
      return <AlertTriangle size={16} className="text-amber-500" />
    case 'under_review':
      return <CircleAlert size={16} className="text-red-500" />
    case 'confirmed_fraud':
      return <Skull size={16} className="text-red-600" />
    default:
      return <CheckCircle size={16} className="text-green-500" />
  }
}

const RISK_OPTIONS = [
  { value: '', label: 'All Risk Levels' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'normal', label: 'Normal' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'confirmed_fraud', label: 'Confirmed Fraud' },
]

export default function InternalFraudPage() {
  const [stats, setStats] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'activities' | 'rules'>('activities')
  const [selectedActivity, setSelectedActivity] = useState<any>(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError('')
    const params: any = {}
    if (riskFilter) params.risk_level = riskFilter
    if (statusFilter) params.status = statusFilter

    Promise.all([
      api.get('/internal-fraud/stats'),
      api.get('/internal-fraud/activities', { params }),
      api.get('/internal-fraud/rules'),
    ])
      .then(([statsRes, activitiesRes, rulesRes]) => {
        setStats(statsRes.data)
        setActivities(activitiesRes.data?.items || activitiesRes.data?.activities || activitiesRes.data || [])
        setRules(rulesRes.data || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load internal fraud data'))
      .finally(() => setLoading(false))
  }, [riskFilter, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !stats) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && !stats) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const statCards = [
    {
      label: 'Critical Risk',
      value: stats?.critical_risk ?? 0,
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: CircleAlert,
      iconColor: 'text-red-500',
    },
    {
      label: 'Under Investigation',
      value: stats?.under_investigation ?? 0,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: Search,
      iconColor: 'text-amber-500',
    },
    {
      label: 'After Hours',
      value: stats?.after_hours ?? 0,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      label: 'Unauthorized Access',
      value: stats?.unauthorized ?? 0,
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: Shield,
      iconColor: 'text-red-500',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{formatNumber(s.value)}</p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.iconColor} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'activities', label: `Activities (${activities.length})` },
          { key: 'rules', label: `Detection Rules (${rules.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'activities' && <>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filters:</span>
          </div>
          <div className="relative">
            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer"
            >
              {RISK_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">No activities found</div>
        ) : (
          activities.map((item, idx) => (
            <div key={item.id || idx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedActivity(selectedActivity === (item.id || idx) ? null : (item.id || idx))}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusIcon status={item.status || item.risk_level} />
                    <span className="font-semibold text-slate-800">{item.employee_name || 'Unknown Employee'}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-mono">{item.employee_id || '-'}</span>
                    <Badge
                      text={item.risk_level || 'low'}
                      colors={riskBadgeColors[item.risk_level] || 'bg-gray-100 text-gray-800'}
                    />
                    <Badge
                      text={item.status || 'normal'}
                      colors={statusBadgeColors[item.status] || 'bg-gray-100 text-gray-800'}
                    />
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mt-2">{item.description || 'No description available'}</p>

                  {/* Details row */}
                  <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {item.department || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield size={12} />
                      {(item.activity_type || '-').replace(/_/g, ' ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Monitor size={12} />
                      {item.workstation_id || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wifi size={12} />
                      {item.ip_address || '-'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(item.timestamp || item.created_at)}
                    </span>
                  </div>

                  {/* Flags */}
                  {(item.flags || []).length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {item.flags.map((flag: string, fi: number) => (
                        <span
                          key={fi}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            flag.toLowerCase().includes('unauthorized')
                              ? 'bg-red-100 text-red-700'
                              : flag.toLowerCase().includes('after')
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Also show individual flag fields if no flags array */}
                  {!(item.flags || []).length && (item.after_hours || item.unauthorized_access) && (
                    <div className="flex items-center gap-2 mt-2">
                      {item.after_hours && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">After Hours</span>
                      )}
                      {item.unauthorized_access && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Unauthorized</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side status label */}
                <div className="flex-shrink-0">
                  <Badge
                    text={item.status || 'normal'}
                    colors={statusBadgeColors[item.status] || 'bg-gray-100 text-gray-800'}
                  />
                </div>
              </div>
              {/* Expanded detail panel */}
              {selectedActivity === (item.id || idx) && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Employee ID</span><p className="font-bold text-slate-700">{item.employee_id || '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Department</span><p className="font-bold text-slate-700">{item.department || '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Activity Type</span><p className="font-bold text-slate-700">{(item.activity_type || '-').replace(/_/g, ' ')}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Workstation</span><p className="font-bold text-slate-700">{item.workstation_id || '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">IP Address</span><p className="font-bold text-slate-700 font-mono">{item.ip_address || '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Risk Level</span><p className="font-bold text-slate-700">{item.risk_level || '-'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">After Hours</span><p className="font-bold text-slate-700">{item.after_hours ? 'Yes' : 'No'}</p></div>
                    <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Unauthorized</span><p className="font-bold text-slate-700">{item.unauthorized_access ? 'Yes' : 'No'}</p></div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">Escalate to HR</button>
                    <button className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg border border-amber-200 hover:bg-amber-100">Flag for Investigation</button>
                    <button className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200">Mark Cleared</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </>}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Rule ID</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Severity</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Triggers</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-blue-600">{r.id}</td>
                    <td className="py-2.5 px-4">
                      <p className="text-sm font-medium text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 capitalize">{(r.category || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-4">
                      <Badge
                        text={r.severity || '-'}
                        colors={riskBadgeColors[r.severity] || 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">{r.triggers ?? 0}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {r.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No rules defined</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
