import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, CreditCard, Bell, Shield, MapPin, Phone, Mail, Building, AlertCircle, History, Users } from 'lucide-react'
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

type Tab = 'overview' | 'transactions' | 'alerts' | 'network' | 'audit' | 'ubo'

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
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [networkData, setNetworkData] = useState<any>(null)
  const [networkLoading, setNetworkLoading] = useState(false)
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [uboRecords, setUboRecords] = useState<any[]>([])
  const [uboLoading, setUboLoading] = useState(false)
  const [uboModalOpen, setUboModalOpen] = useState(false)
  const [uboEditRecord, setUboEditRecord] = useState<any>(null)
  const [uboForm, setUboForm] = useState({ ubo_name: '', ownership_percentage: '', nationality: 'IN', date_of_birth: '', id_type: 'pan', id_number: '', relationship_type: 'director' })
  const [uboSaving, setUboSaving] = useState(false)

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

  const fetchUboRecords = () => {
    if (!id) return
    setUboLoading(true)
    api.get(`/ubo/${id}`)
      .then(res => setUboRecords(res.data))
      .catch(() => setUboRecords([]))
      .finally(() => setUboLoading(false))
  }

  useEffect(() => {
    if (tab === 'ubo' && id) fetchUboRecords()
  }, [tab, id])

  const openUboAdd = () => {
    setUboEditRecord(null)
    setUboForm({ ubo_name: '', ownership_percentage: '', nationality: 'IN', date_of_birth: '', id_type: 'pan', id_number: '', relationship_type: 'director' })
    setUboModalOpen(true)
  }

  const openUboEdit = (record: any) => {
    setUboEditRecord(record)
    setUboForm({
      ubo_name: record.ubo_name,
      ownership_percentage: String(record.ownership_percentage),
      nationality: record.nationality || 'IN',
      date_of_birth: record.date_of_birth || '',
      id_type: record.id_type || 'pan',
      id_number: record.id_number || '',
      relationship_type: record.relationship_type || 'director',
    })
    setUboModalOpen(true)
  }

  const saveUbo = async () => {
    if (!id) return
    setUboSaving(true)
    const payload = {
      ubo_name: uboForm.ubo_name,
      ownership_percentage: parseFloat(uboForm.ownership_percentage),
      nationality: uboForm.nationality,
      date_of_birth: uboForm.date_of_birth || undefined,
      id_type: uboForm.id_type,
      id_number: uboForm.id_number || undefined,
      relationship_type: uboForm.relationship_type,
    }
    try {
      if (uboEditRecord) {
        await api.put(`/ubo/${id}/${uboEditRecord.id}`, payload)
      } else {
        await api.post(`/ubo/${id}`, payload)
      }
      setUboModalOpen(false)
      fetchUboRecords()
    } catch {
      // keep modal open on error
    } finally {
      setUboSaving(false)
    }
  }

  const deleteUbo = async (uboId: string) => {
    if (!id || !confirm('Delete this UBO record?')) return
    await api.delete(`/ubo/${id}/${uboId}`)
    fetchUboRecords()
  }

  const verifyUbo = async (uboId: string) => {
    if (!id) return
    await api.post(`/ubo/${id}/${uboId}/verify`)
    fetchUboRecords()
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>
  if (!data) return <div className="flex items-center justify-center h-full text-slate-400">Customer not found</div>

  const customer = data.customer || data
  const accounts = data.accounts || customer.accounts || []
  const transactions = data.transactions || data.recent_transactions || []
  const alerts = data.alerts || data.recent_alerts || []
  const cases = data.cases || customer.cases || []
  const kycInfo = data.kyc || customer.kyc || null
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const canManageUbo = ['admin', 'compliance_officer'].some(r => currentUser.roles?.includes(r))
  const isCorporate = customer?.customer_type === 'corporate'

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'transactions', label: 'Transactions', icon: CreditCard },
    { key: 'network', label: 'Network Analysis', icon: Building },
    { key: 'alerts', label: 'Alerts & Cases', icon: Bell },
    { key: 'audit', label: 'Audit Trail', icon: History },
    ...(isCorporate ? [{ key: 'ubo' as Tab, label: 'UBO / Beneficial Owners', icon: Users }] : []),
  ]

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

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

      {/* Network Analysis */}
      {tab === 'network' && (
        <div className="space-y-4">
          {networkLoading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-8 text-center text-slate-400">
              Loading network data...
            </div>
          ) : networkData ? (
            <>
              {/* Network Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <div className="text-sm text-slate-500 mb-1">Total Entities</div>
                  <div className="text-2xl font-bold text-slate-800">{networkData.nodes?.length || 0}</div>
                  <div className="text-xs text-slate-400 mt-1">in network</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <div className="text-sm text-slate-500 mb-1">Direct Connections</div>
                  <div className="text-2xl font-bold text-slate-800">{networkData.edges?.length || 0}</div>
                  <div className="text-xs text-slate-400 mt-1">relationships</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <div className="text-sm text-slate-500 mb-1">High Risk</div>
                  <div className="text-2xl font-bold text-red-600">{
                    networkData.nodes?.filter((n: any) =>
                      n.risk_category === 'high' || n.risk_category === 'very_high'
                    ).length || 0
                  }</div>
                  <div className="text-xs text-slate-400 mt-1">entities</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                  <div className="text-sm text-slate-500 mb-1">Avg Risk Score</div>
                  <div className="text-2xl font-bold text-slate-800">{
                    networkData.nodes?.length > 0
                      ? (networkData.nodes.reduce((sum: number, n: any) => sum + (n.risk_score || 0), 0) / networkData.nodes.length).toFixed(0)
                      : 0
                  }</div>
                  <div className="text-xs text-slate-400 mt-1">in network</div>
                </div>
              </div>

              {/* Relationship Types */}
              {(() => {
                const relationshipTypes: Record<string, any[]> = {}
                networkData.edges?.forEach((edge: any) => {
                  const type = edge.relationship || 'other'
                  if (!relationshipTypes[type]) relationshipTypes[type] = []
                  const relatedId = edge.source === id ? edge.target : edge.source
                  const relatedNode = networkData.nodes.find((n: any) => n.id === relatedId)
                  if (relatedNode) {
                    relationshipTypes[type].push({ ...relatedNode, relationship: type })
                  }
                })

                return Object.entries(relationshipTypes).map(([relType, entities]) => (
                  <div key={relType} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 capitalize">
                      {relType.replace(/_/g, ' ')} ({entities.length})
                    </h3>
                    <div className="space-y-2">
                      {entities.map((entity: any) => (
                        <div
                          key={entity.id}
                          className="flex items-start justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800">{entity.name || entity.full_name || entity.label}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {entity.customer_type && <span className="capitalize">{entity.customer_type.replace(/_/g, ' ')}</span>}
                              {entity.occupation && <span className="ml-2">• {entity.occupation}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                            <div className="text-right">
                              {entity.risk_score != null && (
                                <div className="text-sm font-bold" style={{
                                  color: entity.risk_score >= 75 ? '#ef4444' :
                                         entity.risk_score >= 50 ? '#f97316' :
                                         entity.risk_score >= 25 ? '#f59e0b' : '#10b981'
                                }}>
                                  {entity.risk_score}
                                </div>
                              )}
                              <div className="text-xs text-slate-400">Risk</div>
                            </div>
                            <Badge
                              text={entity.risk_category || '-'}
                              colors={riskColors[entity.risk_category] || 'bg-gray-100 text-gray-800'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}

              {/* Network Risk Summary */}
              {(() => {
                const allEntities = networkData.nodes || []
                const highRiskEntities = allEntities.filter((n: any) =>
                  n.risk_category === 'high' || n.risk_category === 'very_high'
                )
                const pepEntities = allEntities.filter((n: any) => n.pep_status || n.is_pep)
                const sanctionsMatches = allEntities.filter((n: any) => n.sanctions_match)

                if (highRiskEntities.length > 0 || pepEntities.length > 0 || sanctionsMatches.length > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-amber-900 mb-3">⚠️ Network Risk Summary</h3>
                      <div className="space-y-2 text-sm">
                        {highRiskEntities.length > 0 && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span className="text-lg">🔴</span>
                            <span><strong>{highRiskEntities.length}</strong> high/very-high risk entit{highRiskEntities.length === 1 ? 'y' : 'ies'} in network</span>
                          </div>
                        )}
                        {pepEntities.length > 0 && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span className="text-lg">👤</span>
                            <span><strong>{pepEntities.length}</strong> Politically Exposed Person (PEP) in network</span>
                          </div>
                        )}
                        {sanctionsMatches.length > 0 && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span className="text-lg">⛔</span>
                            <span><strong>{sanctionsMatches.length}</strong> sanctions matches in network</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-8 text-center text-slate-400">
              No network data available
            </div>
          )}
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

      {/* UBO / Beneficial Owners Tab */}
      {tab === 'ubo' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Beneficial Owners ({uboRecords.length})</h3>
              {canManageUbo && (
                <button
                  onClick={openUboAdd}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add UBO
                </button>
              )}
            </div>

            {uboLoading ? (
              <div className="py-8 text-center text-slate-400">Loading UBO records...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">UBO Name</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Relationship</th>
                      <th className="text-right py-2.5 px-3 font-medium text-slate-600">Ownership %</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Nationality</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">ID Type</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">ID Number</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Verified</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Verified At</th>
                      {canManageUbo && <th className="text-left py-2.5 px-3 font-medium text-slate-600">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {uboRecords.map((r: any) => {
                      const pct = r.ownership_percentage ?? 0
                      const pctColors = pct >= 25
                        ? 'bg-red-100 text-red-800'
                        : pct >= 10
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                      const idMasked = r.id_number
                        ? r.id_number.length > 4
                          ? `${'*'.repeat(r.id_number.length - 4)}${r.id_number.slice(-4)}`
                          : '****'
                        : '-'
                      return (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-800">{r.ubo_name}</td>
                          <td className="py-2.5 px-3 text-slate-600 capitalize">{(r.relationship_type || '-').replace(/_/g, ' ')}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctColors}`}>
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{r.nationality || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 uppercase">{r.id_type || '-'}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{idMasked}</td>
                          <td className="py-2.5 px-3">
                            {r.verified ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pending</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-slate-500">{r.verified_at ? formatDateTime(r.verified_at) : '-'}</td>
                          {canManageUbo && (
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => openUboEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                                {!r.verified && (
                                  <button onClick={() => verifyUbo(r.id)} className="text-xs text-green-600 hover:underline">Verify</button>
                                )}
                                <button onClick={() => deleteUbo(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    {uboRecords.length === 0 && (
                      <tr><td colSpan={canManageUbo ? 9 : 8} className="py-10 text-center text-slate-400">No UBO records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Regulatory note */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <Shield size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
            <span>
              <strong>FATF R.24 / RBI KYC Master Direction 2023</strong> — UBOs with &ge;25% ownership require enhanced due diligence (EDD).
              Red badge = controlling interest (&ge;25%). Amber = significant holding (10–24%). Slate = minority (&lt;10%).
            </span>
          </div>
        </div>
      )}

      {/* UBO Add / Edit Modal */}
      {uboModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">
              {uboEditRecord ? 'Edit UBO Record' : 'Add Beneficial Owner'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uboForm.ubo_name}
                  onChange={e => setUboForm(f => ({ ...f, ubo_name: e.target.value }))}
                  placeholder="e.g. Rajesh Kumar Mehta"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ownership % *</label>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.ownership_percentage}
                    onChange={e => setUboForm(f => ({ ...f, ownership_percentage: e.target.value }))}
                    placeholder="e.g. 51.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.nationality}
                    onChange={e => setUboForm(f => ({ ...f, nationality: e.target.value }))}
                    placeholder="IN"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ID Type</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.id_type}
                    onChange={e => setUboForm(f => ({ ...f, id_type: e.target.value }))}
                  >
                    <option value="pan">PAN</option>
                    <option value="passport">Passport</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="cin">CIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ID Number</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.id_number}
                    onChange={e => setUboForm(f => ({ ...f, id_number: e.target.value }))}
                    placeholder="e.g. ABCDE1234F"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Relationship</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.relationship_type}
                    onChange={e => setUboForm(f => ({ ...f, relationship_type: e.target.value }))}
                  >
                    <option value="director">Director</option>
                    <option value="shareholder">Shareholder</option>
                    <option value="promoter">Promoter</option>
                    <option value="trustee">Trustee</option>
                    <option value="ubo">UBO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uboForm.date_of_birth}
                    onChange={e => setUboForm(f => ({ ...f, date_of_birth: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                onClick={() => setUboModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveUbo}
                disabled={uboSaving || !uboForm.ubo_name || !uboForm.ownership_percentage}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uboSaving ? 'Saving...' : uboEditRecord ? 'Update' : 'Add UBO'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
