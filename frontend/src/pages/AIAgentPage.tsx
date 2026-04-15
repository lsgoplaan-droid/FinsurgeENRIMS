import { useState, useEffect, useRef } from 'react'
import {
  Search, Brain, AlertTriangle, TrendingUp, Lightbulb, FileText,
  Copy, Check, Activity, Loader2, ShieldAlert, Users
} from 'lucide-react'
import api from '../config/api'
import { formatNumber, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
    {text.replace(/_/g, ' ')}
  </span>
)

const riskAssessmentColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  very_high: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}

const insightColors: Record<string, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
  trend: { bg: 'bg-blue-50', border: 'border-blue-200', icon: TrendingUp, iconColor: 'text-blue-500' },
  pattern: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500' },
  recommendation: { bg: 'bg-green-50', border: 'border-green-200', icon: Lightbulb, iconColor: 'text-green-500' },
}

function PriorityRiskTags({ customer }: { customer: any }) {
  const tags: Array<{ label: string; color: string }> = []

  if (customer.risk_category === 'very_high' || customer.risk_category === 'high') {
    tags.push({ label: 'Watchlisted', color: 'bg-red-100 text-red-700' })
  }
  if (customer.pep_status === true || customer.pep_status === 'true') {
    tags.push({ label: 'PEP', color: 'bg-purple-100 text-purple-700' })
  }
  if ((customer.risk_score ?? 0) > 80) {
    tags.push({ label: 'Mule Suspect', color: 'bg-orange-100 text-orange-700' })
  }
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map((tag, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${tag.color}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  )
}

export default function AIAgentPage() {
  // Priority investigation queue
  const [priorityCustomers, setPriorityCustomers] = useState<any[]>([])
  const [priorityLoading, setPriorityLoading] = useState(true)

  // Customer analysis state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Anomaly summary state
  const [anomalySummary, setAnomalySummary] = useState<any>(null)
  const [anomalyLoading, setAnomalyLoading] = useState(true)

  // STR narrative state
  const [sarCustomer, setSarCustomer] = useState<any>(null)
  const [sarSearchQuery, setSarSearchQuery] = useState('')
  const [sarSearchResults, setSarSearchResults] = useState<any[]>([])
  const [showSarDropdown, setShowSarDropdown] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [narrativeError, setNarrativeError] = useState('')
  const [copied, setCopied] = useState(false)
  const sarDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch priority investigation queue on mount
  useEffect(() => {
    api.get('/customers', { params: { risk_category: 'very_high', page_size: 5 } })
      .then(res => {
        const items = res.data?.items || res.data?.customers || res.data?.data || []
        setPriorityCustomers(items.slice(0, 5))
      })
      .catch(() => setPriorityCustomers([]))
      .finally(() => setPriorityLoading(false))
  }, [])

  // Fetch anomaly summary on mount
  useEffect(() => {
    api.get('/ai-agent/anomaly-summary')
      .then(res => setAnomalySummary(res.data))
      .catch(() => {})
      .finally(() => setAnomalyLoading(false))
  }, [])

  // Customer search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(() => {
      api.get('/customers', { params: { search: searchQuery, page_size: 10 } })
        .then(res => {
          const items = res.data?.items || res.data?.customers || res.data || []
          setSearchResults(items)
          setShowDropdown(items.length > 0)
        })
        .catch(() => setSearchResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // STR customer search
  useEffect(() => {
    if (!sarSearchQuery || sarSearchQuery.length < 2) {
      setSarSearchResults([])
      setShowSarDropdown(false)
      return
    }
    const timer = setTimeout(() => {
      api.get('/customers', { params: { search: sarSearchQuery, page_size: 10 } })
        .then(res => {
          const items = res.data?.items || res.data?.customers || res.data || []
          setSarSearchResults(items)
          setShowSarDropdown(items.length > 0)
        })
        .catch(() => setSarSearchResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [sarSearchQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
      if (sarDropdownRef.current && !sarDropdownRef.current.contains(e.target as Node)) setShowSarDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectCustomerForAnalysis = (c: any) => {
    setSelectedCustomer(c)
    setSearchQuery(c.full_name || c.name || c.customer_number)
    setShowDropdown(false)
    setAnalysis(null)
  }

  const handleAnalyze = () => {
    if (!selectedCustomer) return
    setAnalyzing(true)
    setAnalysis(null)
    setAnalysisError('')

    api.post(`/ai-agent/analyze-customer?customer_id=${selectedCustomer.id}`, {}, { timeout: 45000 })
      .then(res => setAnalysis(res.data))
      .catch(err => setAnalysisError(err.response?.data?.detail || 'Analysis timed out — server may be warming up. Please retry.'))
      .finally(() => setAnalyzing(false))
  }

  const handleGenerateNarrative = () => {
    if (!sarCustomer) return
    setGenerating(true)
    setNarrative('')
    setNarrativeError('')

    api.post(`/ai-agent/generate-sar-narrative?customer_id=${sarCustomer.id}`)
      .then(res => setNarrative(res.data?.narrative || res.data?.text || JSON.stringify(res.data, null, 2)))
      .catch(err => setNarrativeError(err.response?.data?.detail || 'Generation failed'))
      .finally(() => setGenerating(false))
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Priority Investigation Queue */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={16} className="text-red-600" />
          <h3 className="text-sm font-semibold text-slate-700">Priority Investigation Queue</h3>
          <span className="text-xs text-slate-400 ml-1">Top 5 very high risk customers</span>
        </div>

        {priorityLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : priorityCustomers.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            No very high risk customers found
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {priorityCustomers.map(c => {
              const score = c.risk_score ?? 0
              return (
                <button
                  key={c.id}
                  onClick={() => selectCustomerForAnalysis(c)}
                  className={`flex-shrink-0 w-52 rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                    selectedCustomer?.id === c.id
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {c.full_name || c.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {c.customer_number || c.id}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg px-2 py-1 ml-2 flex-shrink-0">
                      <span className="text-lg font-bold text-red-600">{score}</span>
                    </div>
                  </div>
                  <PriorityRiskTags customer={c} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Top section: side by side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* LEFT: Customer Risk Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <Brain size={16} className="text-blue-600" />
            Customer Risk Analysis
          </h3>

          {/* Search input */}
          <div className="relative" ref={dropdownRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setSelectedCustomer(null)
                setAnalysis(null)
              }}
              placeholder="Search customer name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700"
            />
            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomerForAnalysis(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="text-slate-700">{c.full_name || c.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{c.customer_number || c.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected customer + Analyze button */}
          {selectedCustomer && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-slate-600">
                Selected: <span className="font-medium text-slate-800">{selectedCustomer.full_name || selectedCustomer.name}</span>
              </span>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {analyzing && <Loader2 size={14} className="animate-spin" />}
                Analyze
              </button>
            </div>
          )}

          {/* Analysis error */}
          {analysisError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{analysisError}</div>
          )}

          {/* Analysis results */}
          {analysis && (
            <div className="mt-4 space-y-3">
              {/* Overall assessment */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Overall Assessment:</span>
                <Badge
                  text={analysis.overall_assessment || analysis.risk_level || '-'}
                  colors={riskAssessmentColors[analysis.overall_assessment?.toLowerCase() || analysis.risk_level?.toLowerCase()] || 'bg-gray-100 text-gray-800'}
                />
                {analysis.risk_score != null && (
                  <span className="text-sm font-mono text-slate-700">Score: {analysis.risk_score}</span>
                )}
              </div>

              {/* Risk factors — backend returns dicts {factor, severity, detail}, fall back to plain strings */}
              {(analysis.risk_factors || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Risk Factors:</p>
                  <ul className="space-y-1">
                    {analysis.risk_factors.map((f: any, i: number) => {
                      const isObj = f && typeof f === 'object'
                      const title = isObj ? (f.factor || f.name || '') : String(f)
                      const detail = isObj ? f.detail || f.description || '' : ''
                      const severity = isObj ? f.severity : null
                      return (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <AlertTriangle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong className="text-slate-800">{title}</strong>
                            {severity && <span className="ml-1 text-[9px] uppercase font-bold text-amber-700">[{severity}]</span>}
                            {detail && <span className="block text-slate-500">{detail}</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Behavioral patterns — backend returns dicts {type, detail} */}
              {(analysis.behavioral_patterns || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Behavioral Patterns:</p>
                  <ul className="space-y-1">
                    {analysis.behavioral_patterns.map((p: any, i: number) => {
                      const isObj = p && typeof p === 'object'
                      const title = isObj ? (p.type || p.pattern || '') : String(p)
                      const detail = isObj ? p.detail || p.description || '' : ''
                      return (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <Activity size={10} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong className="text-slate-800">{title}</strong>
                            {detail && <span className="block text-slate-500">{detail}</span>}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Recommendations — strings or {action, ...} dicts */}
              {(analysis.recommendations || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Recommendations:</p>
                  <ul className="space-y-1">
                    {analysis.recommendations.map((r: any, i: number) => {
                      const text = r && typeof r === 'object' ? (r.action || r.text || r.description || JSON.stringify(r)) : String(r)
                      return (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <Lightbulb size={10} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Anomaly Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-600" />
            Anomaly Summary
          </h3>

          {anomalyLoading ? (
            <div className="text-center text-slate-500 py-8">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading...</p>
            </div>
          ) : !anomalySummary ? (
            <div className="text-center text-slate-400 py-8">No anomaly data available</div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Period</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{anomalySummary.period || '30 days'}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">High Risk Customers</p>
                  <p className="text-sm font-bold text-red-700 mt-0.5">{formatNumber(anomalySummary.high_risk_customers ?? 0)}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">New Alerts</p>
                  <p className="text-sm font-bold text-amber-700 mt-0.5">{formatNumber(anomalySummary.new_alerts ?? 0)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Flagged Transactions</p>
                  <p className="text-sm font-bold text-blue-700 mt-0.5">{formatNumber(anomalySummary.flagged_transactions ?? 0)}</p>
                </div>
              </div>

              {/* Top triggered rules */}
              {(anomalySummary.top_triggered_rules || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Top Triggered Rules:</p>
                  <div className="space-y-1.5">
                    {anomalySummary.top_triggered_rules.map((rule: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate">{rule.name || rule.rule_name || `Rule ${i + 1}`}</span>
                        <span className="font-mono text-slate-700 ml-2">{rule.count || rule.triggers || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {(anomalySummary.insights || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Insights:</p>
                  <div className="space-y-2">
                    {anomalySummary.insights.map((insight: any, i: number) => {
                      const type = insight.type || 'trend'
                      const style = insightColors[type] || insightColors.trend
                      const IconComp = style.icon
                      return (
                        <div key={i} className={`${style.bg} border ${style.border} rounded-lg p-3 flex items-start gap-2`}>
                          <IconComp size={14} className={`${style.iconColor} mt-0.5 flex-shrink-0`} />
                          <div>
                            {insight.title && <p className="text-xs font-medium text-slate-700">{insight.title}</p>}
                            <p className="text-xs text-slate-600">{insight.description || insight.text || insight.message}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: STR Narrative Generator */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <FileText size={16} className="text-purple-600" />
          STR Narrative Generator
        </h3>

        <div className="flex items-end gap-3">
          {/* Customer select */}
          <div className="flex-1 max-w-md relative" ref={sarDropdownRef}>
            <label className="text-xs text-slate-500 mb-1 block">Select Customer</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={sarSearchQuery}
                onChange={e => {
                  setSarSearchQuery(e.target.value)
                  setSarCustomer(null)
                  setNarrative('')
                }}
                placeholder="Search customer..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
            {showSarDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {sarSearchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSarCustomer(c)
                      setSarSearchQuery(c.full_name || c.name || c.customer_number)
                      setShowSarDropdown(false)
                      setNarrative('')
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span className="text-slate-700">{c.full_name || c.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{c.customer_number || c.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateNarrative}
            disabled={!sarCustomer || generating}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating && <Loader2 size={14} className="animate-spin" />}
            Generate Narrative
          </button>
        </div>

        {narrativeError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{narrativeError}</div>
        )}

        {narrative && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Generated STR Narrative</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">
              {narrative}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
