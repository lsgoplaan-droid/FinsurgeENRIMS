import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Search, AlertTriangle, Users, ArrowRight, Shield,
  ChevronRight, Sparkles, Loader2, HelpCircle, Send
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
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [showScoreTooltip, setShowScoreTooltip] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    api.get('/alerts', { params: { status: 'new', page_size: 50 } })
      .then(res => {
        const alerts = res.data?.items || res.data?.alerts || []
        setAlerts(alerts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
      api.get(`/cases`, { params: { customer_id: customerId, page_size: 10 } }).catch(() => ({ data: { items: [] } })),
      api.get(`/audit-logs`, { params: { resource_id: customerId, page_size: 20 } }).catch(() => ({ data: { items: [] } })),
    ])
      .then(([customerRes, alertsRes, aiRes, casesRes, auditRes]) => {
        const customer = customerRes.data
        const relatedAlerts = (alertsRes.data?.items || alertsRes.data?.alerts || []).filter((a: any) => a.id !== alert.id)
        const aiAnalysis = aiRes.data
        const cases = casesRes.data?.items || casesRes.data?.cases || []
        const auditLogs = auditRes.data?.items || auditRes.data?.audit_logs || []

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
          cases,
          auditLogs: auditLogs.filter((log: any) =>
            ['alert_created', 'alert_escalated', 'alert_closed'].includes(log.action_type)
          ).slice(0, 10),
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

  // AI Chat handler
  const sendChatMessage = () => {
    if (!chatInput.trim() || !selectedAlert || !analysis) return

    const userMessage = chatInput
    setChatInput('')

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }])

    setChatLoading(true)

    // Simulate AI response (in production, call actual AI endpoint)
    setTimeout(() => {
      const responses = [
        `Based on the analysis, the "${userMessage.toLowerCase().includes('score') ? 'investigation score of ' + analysis.score + ' indicates ' + (analysis.score >= 70 ? 'CRITICAL risk requiring immediate escalation' : analysis.score >= 40 ? 'HIGH risk requiring senior analyst review' : 'MEDIUM/LOW risk that can be resolved quickly') : 'risk factors here strongly suggest investigating this customer further'}.`,

        `${userMessage.toLowerCase().includes('recommend') ? 'I recommend ' + (analysis.recommendations?.[0] || 'escalating to your compliance team') + '. ' : ''}The customer profile shows ${analysis.customer?.pep_status ? 'PEP status which requires Enhanced Due Diligence, ' : ''}${analysis.riskFactors?.length || 0} risk factors, and ${analysis.relatedAlerts?.length || 0} related alerts.`,

        `${userMessage.toLowerCase().includes('next') ? 'Next steps: ' : 'In this case: '}${analysis.recommendations?.slice(0, 2).join('. ') || 'Review the risk factors and take appropriate action based on your bank\'s policies'}.`,

        `The investigation score of ${analysis.score} combines the alert risk (${selectedAlert.risk_score || 50}), number of risk factors (${(analysis.riskFactors?.length || 0) * 5}), and other factors. Higher scores need immediate escalation.`,
      ]

      const response = responses[Math.floor(Math.random() * responses.length)]
      setChatMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }])
      setChatLoading(false)
    }, 500)
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
        <p className="text-xs text-slate-500">AI-powered analysis of new alerts — click to investigate and take action</p>
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

          <div className="text-xs text-slate-500">{filteredAlerts.length} new alerts awaiting investigation</div>

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
                    <div className="relative inline-block">
                      <div
                        className="text-center px-4 cursor-help"
                        onMouseEnter={() => setShowScoreTooltip(true)}
                        onMouseLeave={() => setShowScoreTooltip(false)}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <div className={`text-2xl font-bold ${analysis.score >= 70 ? 'text-red-600' : analysis.score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                            {analysis.score}
                          </div>
                          <HelpCircle size={16} className="text-slate-400" />
                        </div>
                        <div className="text-xs text-slate-400">Investigation Score</div>
                      </div>

                      {/* Score tooltip with breakdown */}
                      {showScoreTooltip && (
                        <div className="absolute right-0 top-full mt-2 bg-slate-900 text-white rounded-lg shadow-lg p-4 w-96 z-10 text-left text-xs border border-slate-700">
                          <div className="font-semibold mb-3 text-sm">📊 Investigation Score Breakdown</div>
                          <div className="space-y-2.5 font-mono text-xs">
                            {(() => {
                              const baseAlertRisk = selectedAlert.risk_score || 50
                              const riskFactorScore = (analysis.riskFactors?.length || 0) * 5
                              const pepFactor = analysis.customer?.pep_status ? 10 : 0
                              const total = baseAlertRisk + riskFactorScore + pepFactor

                              return (
                                <>
                                  {/* Base Alert Risk */}
                                  <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-blue-500">
                                    <div>
                                      <div>✓ Base Alert Risk</div>
                                      <div className="text-slate-400 text-xs mt-0.5">Alert severity level</div>
                                    </div>
                                    <span className="font-semibold text-blue-400">+{baseAlertRisk}</span>
                                  </div>

                                  {/* Risk Factors */}
                                  <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-orange-500">
                                    <div>
                                      <div>✓ Risk Factors</div>
                                      <div className="text-slate-400 text-xs mt-0.5">{analysis.riskFactors?.length || 0} factors × 5</div>
                                    </div>
                                    <span className="font-semibold text-orange-400">+{riskFactorScore}</span>
                                  </div>

                                  {/* PEP Factor */}
                                  {analysis.customer?.pep_status && (
                                    <div className="flex items-center justify-between bg-slate-800 p-2 rounded border-l-2 border-red-500">
                                      <div>
                                        <div>✓ PEP Status</div>
                                        <div className="text-slate-400 text-xs mt-0.5">Politically Exposed Person</div>
                                      </div>
                                      <span className="font-semibold text-red-400">+{pepFactor}</span>
                                    </div>
                                  )}

                                  {/* Calculation shown */}
                                  <div className="bg-slate-700 p-2 rounded text-slate-300 text-xs my-2">
                                    {baseAlertRisk} + {riskFactorScore} {pepFactor > 0 ? `+ ${pepFactor}` : ''} = {total}
                                  </div>

                                  {/* Total with severity */}
                                  <div className="border-t border-slate-600 pt-2 mt-3">
                                    <div className={`flex justify-between font-semibold p-2 rounded text-white ${
                                      total >= 70 ? 'bg-gradient-to-r from-red-600 to-red-700' :
                                      total >= 40 ? 'bg-gradient-to-r from-amber-600 to-amber-700' :
                                      'bg-gradient-to-r from-green-600 to-green-700'
                                    }`}>
                                      <span>SEVERITY</span>
                                      <span className="text-lg">
                                        {total >= 70 ? '🔴 CRITICAL' : total >= 40 ? '🟠 HIGH' : '🟢 MEDIUM/LOW'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Recommendation */}
                                  <div className="bg-slate-800 p-2 rounded text-slate-200 text-xs border-l-2 border-purple-500 mt-2">
                                    <div className="font-semibold text-purple-300 mb-1">📋 Recommendation</div>
                                    {total >= 70 && "Immediate escalation required. Document all findings and escalate to compliance immediately."}
                                    {total >= 40 && total < 70 && "Senior analyst review required. Review risk factors and apply appropriate due diligence."}
                                    {total < 40 && "Can be resolved quickly. Verify information and make disposition decision."}
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
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

              {/* Previous Cases */}
              {analysis.cases && analysis.cases.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} className="text-blue-600" />
                    <h4 className="text-sm font-semibold text-slate-700">
                      Previous Cases ({analysis.cases.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {analysis.cases.slice(0, 5).map((c: any) => (
                      <Link
                        key={c.id}
                        to={`/cases/${c.id}`}
                        className="flex items-start justify-between p-2 rounded-lg hover:bg-slate-50 text-xs group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 group-hover:text-blue-600">{c.case_number}</p>
                          <p className="text-slate-600 text-[11px] truncate">{c.title || c.description || 'Case'}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${
                            c.status === 'open' ? 'bg-blue-100 text-blue-800' :
                            c.status === 'closed' ? 'bg-slate-100 text-slate-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {analysis.auditLogs && analysis.auditLogs.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-amber-600" />
                    <h4 className="text-sm font-semibold text-slate-700">
                      Recent Activity
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {analysis.auditLogs.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between p-2 rounded-lg bg-slate-50 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">
                            {log.action_type === 'alert_created' && '🔔 Alert Created'}
                            {log.action_type === 'alert_escalated' && '⬆️ Alert Escalated'}
                            {log.action_type === 'alert_closed' && '✓ Alert Closed'}
                          </p>
                          <p className="text-slate-600 text-[11px]">
                            by {log.user_name || log.user_id || 'System'} • {log.created_at ? timeAgo(log.created_at) : ''}
                          </p>
                        </div>
                        {log.details && (
                          <span className="ml-2 px-2 py-1 bg-slate-200 rounded text-[10px] text-slate-700 whitespace-nowrap">
                            {typeof log.details === 'string' ? log.details : (log.details.disposition || log.details.reason || '—')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Chat Panel */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative">
                <div className="absolute top-3 right-3 px-2 py-1 bg-amber-100 text-amber-800 text-[9px] font-medium rounded">
                  🚧 Beta
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-purple-600" />
                  <h4 className="text-sm font-semibold text-slate-700">Ask the Copilot</h4>
                </div>

                {/* Chat messages */}
                <div className="bg-slate-50 rounded-lg p-3 h-48 overflow-y-auto space-y-2 mb-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <p className="text-xs text-center">Ask about the score, risk factors, recommendations, or next steps</p>
                    </div>
                  ) : (
                    chatMessages.map((msg: any, idx: number) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg text-xs ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-purple-100 text-purple-900 rounded-bl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-purple-100 text-purple-900 px-3 py-2 rounded-lg rounded-bl-none text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse" />
                          <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse" />
                          <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about this case..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={12} />
                  </button>
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
