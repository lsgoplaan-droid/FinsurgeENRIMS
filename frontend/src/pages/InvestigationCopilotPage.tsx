import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Search, AlertTriangle, Users, ArrowRight, Shield,
  ChevronRight, Sparkles, Loader2
} from 'lucide-react'
import api from '../config/api'
import { timeAgo } from '../utils/formatters'

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

export default function InvestigationCopilotPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    api.get('/alerts', { params: { page_size: 50 } })
      .then(res => {
        const all = res.data?.items || res.data?.alerts || []
        const open = all.filter((a: any) => !a.status?.startsWith('closed'))
        setAlerts(open)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const analyzeAlert = (alert: any) => {
    setSelectedAlert(alert)
    setAnalyzing(true)
    setAnalysis(null)

    // Load customer 360 + related data
    const customerId = alert.customer_id
    Promise.all([
      api.get(`/customers/${customerId}`).catch(() => ({ data: null })),
      api.get(`/alerts`, { params: { customer_id: customerId, page_size: 20 } }).catch(() => ({ data: { items: [] } })),
      api.get(`/ai-agent/analyze/${alert.id}`).catch(() => ({ data: null })),
    ])
      .then(([customerRes, alertsRes, aiRes]) => {
        const customer = customerRes.data
        const relatedAlerts = (alertsRes.data?.items || alertsRes.data?.alerts || []).filter((a: any) => a.id !== alert.id)
        const aiAnalysis = aiRes.data

        // Build investigation summary
        const riskFactors = []
        if (customer?.risk_score >= 70) riskFactors.push('Very high risk score')
        if (customer?.pep_status) riskFactors.push('Politically Exposed Person (PEP)')
        if (customer?.risk_category === 'very_high') riskFactors.push('Very high risk category')
        if (relatedAlerts.length > 3) riskFactors.push(`${relatedAlerts.length} other alerts on this customer`)
        if (alert.risk_score >= 80) riskFactors.push('Alert risk score >= 80')

        const recommendations = []
        if (alert.priority === 'critical' || alert.priority === 'high') {
          recommendations.push('Escalate to senior analyst immediately')
        }
        if (customer?.pep_status) {
          recommendations.push('Apply Enhanced Due Diligence (EDD) procedures')
        }
        if (relatedAlerts.length > 5) {
          recommendations.push('Consider opening a case — pattern of suspicious activity')
        }
        if ((alert.risk_score || 0) >= 70) {
          recommendations.push('Review full transaction history for structuring patterns')
        }
        recommendations.push('Document findings in alert notes before disposition')

        setAnalysis({
          customer,
          relatedAlerts,
          aiAnalysis,
          riskFactors,
          recommendations,
          score: Math.min(100, (alert.risk_score || 50) + (riskFactors.length * 5)),
        })
      })
      .finally(() => setAnalyzing(false))
  }

  // Action handlers — turn each "recommended action" into a one-click action
  const doEscalate = () => {
    if (!selectedAlert) return
    setActionLoading('escalate')
    api.post(`/alerts/${selectedAlert.id}/escalate`)
      .then(() => {
        setActionMsg('Alert escalated to senior analyst')
        setTimeout(() => setActionMsg(''), 3000)
      })
      .catch(() => setActionMsg('Failed to escalate'))
      .finally(() => setActionLoading(null))
  }

  const doPromoteToCase = () => {
    if (!selectedAlert) return
    setActionLoading('promote')
    api.post(`/alerts/${selectedAlert.id}/promote-to-case`)
      .then(res => {
        setActionMsg(`Case ${res.data.case_number} created`)
        setTimeout(() => navigate(`/cases/${res.data.case_id}`), 800)
      })
      .catch(() => setActionMsg('Failed to create case'))
      .finally(() => setActionLoading(null))
  }

  const doAddNote = () => {
    if (!selectedAlert) return
    const note = window.prompt('Add an investigation note:')
    if (!note?.trim()) return
    setActionLoading('note')
    api.post(`/alerts/${selectedAlert.id}/add-note`, { note })
      .then(() => {
        setActionMsg('Note added to alert')
        setTimeout(() => setActionMsg(''), 3000)
      })
      .catch(() => setActionMsg('Failed to add note'))
      .finally(() => setActionLoading(null))
  }

  const doCloseAlert = (disposition: 'true_positive' | 'false_positive' | 'inconclusive') => {
    if (!selectedAlert) return
    const reason = window.prompt(`Justification for closing as ${disposition.replace('_', ' ')}:`)
    if (!reason?.trim()) return
    setActionLoading('close')
    api.post(`/alerts/${selectedAlert.id}/close`, { disposition, reason })
      .then(() => {
        setActionMsg('Alert closed')
        // Remove from queue
        setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id))
        setSelectedAlert(null)
        setAnalysis(null)
        setTimeout(() => setActionMsg(''), 3000)
      })
      .catch(() => setActionMsg('Failed to close'))
      .finally(() => setActionLoading(null))
  }

  const filteredAlerts = searchQuery
    ? alerts.filter((a: any) =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.alert_number?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : alerts

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Brain size={20} className="text-purple-600" />
          Investigation Copilot
        </h1>
        <p className="text-xs text-slate-500">AI-powered alert analysis — click any alert to auto-investigate</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: Alert queue */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>

          <div className="text-xs text-slate-500">{filteredAlerts.length} open alerts</div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Loading alerts...</div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No open alerts</div>
            ) : (
              filteredAlerts.map((a: any) => (
                <div
                  key={a.id}
                  className={`bg-white rounded-lg shadow-sm border p-3 cursor-pointer transition-all hover:shadow-md ${
                    selectedAlert?.id === a.id ? 'border-purple-400 ring-1 ring-purple-200' : 'border-slate-200'
                  }`}
                  onClick={() => analyzeAlert(a)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-mono text-slate-400">{a.alert_number}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${priorityColors[a.priority] || 'bg-gray-100'}`}>
                          {a.priority}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 truncate">{a.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.created_at ? timeAgo(a.created_at) : ''}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Analysis panel */}
        <div className="xl:col-span-2">
          {!selectedAlert ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Brain size={32} className="text-purple-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Select an alert to start investigation</p>
              <p className="text-xs text-slate-400 mt-1">The copilot will auto-pull customer 360, transaction patterns, network data, and past cases</p>
            </div>
          ) : analyzing ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="w-10 h-10 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-purple-700 font-medium">Analyzing alert...</p>
              <p className="text-xs text-slate-400 mt-1">Pulling customer data, transaction history, and network connections</p>
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              {/* Alert summary header */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{selectedAlert.alert_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[selectedAlert.priority] || ''}`}>
                        {selectedAlert.priority}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedAlert.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${analysis.score >= 70 ? 'text-red-600' : analysis.score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                      {analysis.score}
                    </div>
                    <div className="text-[9px] text-slate-400">Investigation Score</div>
                  </div>
                </div>
                <Link
                  to={`/alerts/${selectedAlert.id}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Open full alert detail <ArrowRight size={10} />
                </Link>
              </div>

              {/* Customer info */}
              {analysis.customer && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-blue-600" />
                    <h4 className="text-sm font-semibold text-slate-700">Customer Profile</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['Name', analysis.customer.full_name],
                      ['CIF', analysis.customer.customer_number],
                      ['Risk Score', analysis.customer.risk_score],
                      ['Category', (analysis.customer.risk_category || '').replace(/_/g, ' ')],
                      ['PEP', analysis.customer.pep_status ? 'Yes' : 'No'],
                      ['City', analysis.customer.city || '-'],
                      ['State', analysis.customer.state || '-'],
                      ['Occupation', analysis.customer.occupation || '-'],
                    ].map(([label, value]) => (
                      <div key={label as string} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[9px] text-slate-400">{label}</p>
                        <p className="text-xs font-medium text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    to={`/customers/${analysis.customer.id}/360`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    View Customer 360 <ArrowRight size={10} />
                  </Link>
                </div>
              )}

              {/* Risk factors */}
              {analysis.riskFactors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-600" />
                    <h4 className="text-sm font-semibold text-red-800">Risk Factors ({analysis.riskFactors.length})</h4>
                  </div>
                  <div className="space-y-1">
                    {analysis.riskFactors.map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-700">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {analysis.aiAnalysis && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-purple-600" />
                    <h4 className="text-sm font-semibold text-purple-800">AI Analysis</h4>
                  </div>
                  <p className="text-xs text-purple-800 whitespace-pre-line">
                    {analysis.aiAnalysis.narrative || analysis.aiAnalysis.summary || 'Analysis complete. Review risk factors and recommendations below.'}
                  </p>
                </div>
              )}

              {/* Recommendations + Action Buttons */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-green-600" />
                  <h4 className="text-sm font-semibold text-green-800">Recommended Actions</h4>
                </div>
                <div className="space-y-1.5 mb-3">
                  {analysis.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-green-800">
                      <span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {r}
                    </div>
                  ))}
                </div>

                {/* One-click action toolbar */}
                <div className="border-t border-green-200 pt-3 mt-3">
                  <p className="text-[10px] uppercase font-semibold text-green-700 mb-2">Take action now</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={doPromoteToCase}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {actionLoading === 'promote' && <Loader2 size={12} className="animate-spin" />}
                      Create Case
                    </button>
                    <button
                      onClick={doEscalate}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {actionLoading === 'escalate' && <Loader2 size={12} className="animate-spin" />}
                      Escalate
                    </button>
                    <button
                      onClick={doAddNote}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white text-xs font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
                    >
                      {actionLoading === 'note' && <Loader2 size={12} className="animate-spin" />}
                      Add Note
                    </button>
                    <button
                      onClick={() => doCloseAlert('true_positive')}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading === 'close' && <Loader2 size={12} className="animate-spin" />}
                      Confirm Fraud
                    </button>
                    <button
                      onClick={() => doCloseAlert('false_positive')}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Mark False Alarm
                    </button>
                  </div>
                  {actionMsg && (
                    <p className="text-xs text-green-800 mt-2 font-medium">{actionMsg}</p>
                  )}
                </div>
              </div>

              {/* Related alerts */}
              {analysis.relatedAlerts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-amber-600" />
                    <h4 className="text-sm font-semibold text-slate-700">
                      Related Alerts ({analysis.relatedAlerts.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {analysis.relatedAlerts.slice(0, 5).map((a: any) => (
                      <Link
                        key={a.id}
                        to={`/alerts/${a.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${priorityColors[a.priority] || ''}`}>
                            {a.priority}
                          </span>
                          <span className="text-slate-700">{a.title}</span>
                        </div>
                        <span className="text-slate-400">{a.status?.replace(/_/g, ' ')}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
