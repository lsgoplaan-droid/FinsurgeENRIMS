import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, User, CreditCard, Bell, Shield, MapPin, Phone, Mail, Building, AlertCircle, History } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDate, formatDateTime, timeAgo, priorityColors, statusColors, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

// Helper to get high-risk related entities
function getHighRiskRelations(networkData: any, centerId: string) {
  if (!networkData || !networkData.edges || !networkData.nodes) return []

  const relationshipTypes = ['director', 'ubo', 'promoter', 'shareholder', 'beneficiary']

  return networkData.edges
    .filter((edge: any) =>
      relationshipTypes.some(t => edge.relationship?.toLowerCase().includes(t))
    )
    .map((edge: any) => {
      const relatedId = edge.source === centerId ? edge.target : edge.source
      const relatedNode = networkData.nodes.find((n: any) => n.id === relatedId)
      return { ...relatedNode, relationship: edge.relationship, relatedId }
    })
    .filter((entity: any) => entity && (entity.risk_category === 'high' || entity.risk_category === 'very_high'))
}

type Tab = 'overview' | 'transactions' | 'alerts' | 'audit'

// Enhanced Circular gauge SVG with tooltip
function RiskGauge({ score, customer }: { score: number; customer?: any }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#f59e0b' : '#10b981'

  const categoryEmoji = score > 70 ? '🔴' : score > 40 ? '🟠' : score > 20 ? '🟡' : '🟢'
  const categoryLabel = score > 70 ? 'VERY HIGH' : score > 40 ? 'HIGH' : score > 20 ? 'MEDIUM' : 'LOW'
  const categoryColor = score > 70 ? 'bg-red-100 text-red-800' : score > 40 ? 'bg-orange-100 text-orange-800' : score > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'

  const baseScore = 10
  const alertRiskContribution = Math.min(40, Math.max(0, (customer?.alert_count ?? 0) * 5))
  const behavioralRiskContribution = Math.max(0, score - baseScore - alertRiskContribution)
  const displayScore = Math.min(100, baseScore + alertRiskContribution + behavioralRiskContribution)

  return (
    <div className="relative inline-block">
      <div
        className="w-32 h-32 cursor-help relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-400">Risk Score</span>
        </div>
      </div>

      {showTooltip && (
        <div className="absolute -bottom-2 -left-32 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 transform translate-y-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-800">Risk Score Breakdown</h4>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${categoryColor}`}>
              {categoryEmoji} {categoryLabel}
            </span>
          </div>

          {/* Component boxes */}
          <div className="space-y-2 mb-3">
            {/* Base Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-700">{baseScore}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Base Risk</div>
                <div className="text-[10px] text-slate-500">Baseline for all customers</div>
              </div>
            </div>

            {/* Alert Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-orange-50 border border-orange-200 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-700">+{alertRiskContribution.toFixed(0)}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Alert Risk</div>
                <div className="text-[10px] text-slate-500">{customer?.alert_count ?? 0} open alerts</div>
              </div>
            </div>

            {/* Behavioral Risk */}
            <div className="flex items-center gap-2">
              <div className="w-12 h-10 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                <span className="text-xs font-bold text-purple-700">+{behavioralRiskContribution.toFixed(0)}</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-700">Behavioral Risk</div>
                <div className="text-[10px] text-slate-500">Transaction patterns & network</div>
              </div>
            </div>
          </div>

          {/* Total equation */}
          <div className="mb-3 p-2 bg-slate-50 rounded border border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-semibold">{baseScore}</span>
              {' + '}
              <span className="font-semibold">{alertRiskContribution.toFixed(0)}</span>
              {' + '}
              <span className="font-semibold">{behavioralRiskContribution.toFixed(0)}</span>
              {' = '}
              <span className="font-bold text-slate-900">{displayScore.toFixed(0)}</span>
            </div>
          </div>

          {/* Risk appetite info */}
          <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-2">
            <div className="font-medium text-slate-700 mb-1">Risk Actions Triggered:</div>
            {score > 70 && <div>🔴 Enhanced monitoring & mandatory review</div>}
            {score > 40 && score <= 70 && <div>🟠 Regular monitoring & periodic review</div>}
            {score <= 40 && <div>🟡 Standard compliance procedures</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Customer360Page() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [networkData, setNetworkData] = useState<any>(null)
  const [networkLoading, setNetworkLoading] = useState(false)
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/customers/${id}/360`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load customer'))
      .finally(() => setLoading(false))
  }, [id])

  // Fetch network data to check for high-risk related entities
  useEffect(() => {
    if (!id) return
    setNetworkLoading(true)
    api.get(`/network/${id}/graph?depth=1`)
      .then(res => setNetworkData(res.data))
      .catch(err => console.error('Failed to load network data:', err))
      .finally(() => setNetworkLoading(false))
  }, [id])

  // Fetch audit trail when audit tab is selected
  const fetchAuditTrail = () => {
    setAuditLoading(true)
    api.get('/audit-trail/entries', { params: { resource_type: 'customer', resource_id: id, per_page: 100 } })
      .then(res => {
        setAuditEntries(res.data.entries || [])
      })
      .catch(() => setAuditEntries([]))
      .finally(() => setAuditLoading(false))
  }

  useEffect(() => {
    if (tab === 'audit' && id) fetchAuditTrail()
  }, [tab, id])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>
  if (!data) return <div className="flex items-center justify-center h-full text-slate-400">Customer not found</div>

  const customer = data.customer || data
  const accounts = data.accounts || customer.accounts || []
  const transactions = data.transactions || data.recent_transactions || []
  const alerts = data.alerts || data.recent_alerts || []
  const cases = data.cases || customer.cases || []
  const kycInfo = data.kyc || customer.kyc || null

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'transactions', label: 'Transactions', icon: CreditCard },
    { key: 'alerts', label: 'Alerts & Cases', icon: Bell },
    { key: 'audit', label: 'Audit Trail', icon: History },
  ]

  return (
    <div className="space-y-6">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} /> Back to Customers
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {(customer.full_name || customer.name || 'C').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">{customer.full_name || customer.name}</h1>
              <Badge text={customer.risk_category || '-'} colors={riskColors[customer.risk_category] || 'bg-gray-100 text-gray-800'} />
              <Badge text={customer.kyc_status || '-'} colors={statusColors[customer.kyc_status] || 'bg-gray-100 text-gray-800'} />
              <Badge text={customer.customer_type || customer.type || '-'} colors="bg-slate-100 text-slate-700" />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="font-mono">{customer.customer_number || customer.id}</span>
              {customer.city && <span className="flex items-center gap-1"><MapPin size={12} /> {customer.city}{customer.state ? `, ${customer.state}` : ''}</span>}
              {customer.phone && <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>}
              {customer.email && <span className="flex items-center gap-1"><Mail size={12} /> {customer.email}</span>}
            </div>
          </div>

          <RiskGauge score={customer.risk_score || 0} customer={customer} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Personal Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Personal Details</h3>
            <div className="space-y-3">
              {[
                ['Full Name', customer.full_name || customer.name],
                ['Date of Birth', formatDate(customer.date_of_birth)],
                ['Gender', customer.gender],
                ['Nationality', customer.nationality],
                ['PAN', customer.pan_number || customer.pan],
                ['Aadhaar', customer.aadhaar_number ? `XXXX-XXXX-${customer.aadhaar_number.slice(-4)}` : null],
                ['Phone', customer.phone],
                ['Email', customer.email],
                ['Address', customer.address],
                ['City', customer.city],
                ['Occupation', customer.occupation],
                ['Employer', customer.employer],
                ['Annual Income', customer.annual_income ? formatINR(customer.annual_income) : null],
                ['Customer Since', formatDate(customer.onboarding_date || customer.created_at)],
              ].filter(([_, v]) => v && v !== '-').map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-medium text-slate-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Accounts */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Accounts ({accounts.length})</h3>
              {accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((acc: any) => (
                    <div key={acc.id || acc.account_number} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-slate-700">{acc.account_number || acc.id}</span>
                          <span className="ml-2 text-xs text-slate-400 capitalize">{(acc.account_type || acc.type || '').replace(/_/g, ' ')}</span>
                        </div>
                        <Badge text={acc.status || 'active'} colors={statusColors[acc.status] || 'bg-green-100 text-green-800'} />
                      </div>
                      {acc.balance != null && (
                        <p className="text-lg font-bold text-slate-800 mt-1">{formatINR(acc.balance)}</p>
                      )}
                      {acc.branch && <p className="text-xs text-slate-400 mt-1">{acc.branch}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No accounts</p>
              )}
            </div>

            {/* Risk Score Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Risk Profile</h3>
              <div className="space-y-3">
                {[
                  ['Overall Risk Score', customer.risk_score],
                  ['Risk Category', customer.risk_category],
                  ['PEP Status', customer.is_pep ? 'Yes' : 'No'],
                  ['Sanctions Match', customer.sanctions_match ? 'Yes' : 'No'],
                  ['Total Alerts', data.alert_count ?? customer.alert_count ?? '-'],
                  ['Open Cases', data.open_case_count ?? '-'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-700 capitalize">{(value ?? '-').toString().replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Network Risk Section - shown in overview tab */}
          {networkData && (() => {
            const highRiskRelations = getHighRiskRelations(networkData, id || '')
            if (highRiskRelations.length > 0) {
              return (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 mb-3">⚠️ Network Risk Alert</h3>
                      <p className="text-sm text-red-800 mb-4">This customer is connected to entities with high risk:</p>
                      <div className="space-y-2">
                        {highRiskRelations.map((entity: any) => (
                          <div key={entity.id} className="flex items-start justify-between p-3 bg-white rounded-lg border border-red-100">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800">{entity.name || entity.label}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {entity.relationship} of <strong>{entity.customer_type || 'entity'}</strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                              <Badge text={entity.risk_category || '-'} colors={riskColors[entity.risk_category] || 'bg-gray-100 text-gray-800'} />
                              <span className="text-sm font-bold text-slate-700">{entity.risk_score || 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Reference</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Channel</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Risk</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{t.reference_number || t.id}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(t.channel || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(t.transaction_type || t.method || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatINR(t.amount)}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs font-mono">{t.risk_score ?? '-'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDateTime(t.transaction_date || t.created_at)}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No transactions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts & Cases */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Alerts ({alerts.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Alert#</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Title</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a: any) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <Link to={`/alerts/${a.id}`} className="text-blue-600 hover:underline font-mono text-xs">{a.alert_number || a.id}</Link>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge text={a.priority || '-'} colors={priorityColors[a.priority] || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{a.title || '-'}</td>
                      <td className="py-2.5 px-3">
                        <Badge text={a.status || '-'} colors={statusColors[a.status] || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDateTime(a.created_at)}</td>
                    </tr>
                  ))}
                  {alerts.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">No alerts</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cases */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Cases ({cases.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Case#</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Title</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: any) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <Link to={`/cases/${c.id}`} className="text-blue-600 hover:underline font-mono text-xs">{c.case_number || c.id}</Link>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge text={c.priority || '-'} colors={priorityColors[c.priority] || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{c.title || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{(c.case_type || '-').replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-3">
                        <Badge text={c.status || '-'} colors={statusColors[c.status] || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDateTime(c.created_at)}</td>
                    </tr>
                  ))}
                  {cases.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">No cases</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      {tab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Audit Trail</h3>
          </div>
          {auditLoading ? (
            <div className="py-8 text-center text-slate-400">Loading audit trail...</div>
          ) : auditEntries.length === 0 ? (
            <div className="py-8 text-center text-slate-400">No audit entries</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Timestamp</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Action</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">User</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry: any) => {
                    const actionEmojis: Record<string, string> = {
                      'create': '✨',
                      'update': '✏️',
                      'delete': '🗑️',
                      'assign': '👤',
                      'escalate': '⬆️',
                      'close': '✅',
                      'reopen': '🔄',
                      'disposition': '📋',
                      'status_change': '📊',
                    }
                    const actionEmoji = Object.entries(actionEmojis).find(([key]) =>
                      entry.action?.toLowerCase().includes(key)
                    )?.[1] || '📝'

                    return (
                      <tr key={entry.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(entry.timestamp || entry.created_at)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span>{actionEmoji}</span>
                            <span className="font-medium text-slate-700 capitalize">{(entry.action || '-').replace(/_/g, ' ')}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">{entry.user_name || entry.user_id || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">{entry.description || entry.details || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
