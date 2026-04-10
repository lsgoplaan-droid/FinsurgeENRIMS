import { useState, useEffect } from 'react'
import {
  BookOpen, Shield, AlertTriangle, CheckCircle, XCircle, Plus, Pencil,
  Copy, Trash2, ToggleLeft, ToggleRight, Filter, ChevronDown, Search,
  Lightbulb, Zap, TrendingUp, Code, Eye, ChevronRight
} from 'lucide-react'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const effectivenessColors: Record<string, string> = {
  excellent: 'text-green-600',
  good: 'text-blue-600',
  moderate: 'text-amber-600',
  poor: 'text-orange-600',
  critical: 'text-red-600',
  no_data: 'text-slate-400',
  insufficient_data: 'text-slate-400',
}

const categoryColors: Record<string, string> = {
  fraud: 'bg-amber-50 text-amber-700 border-amber-200',
  cyber_fraud: 'bg-orange-50 text-orange-700 border-orange-200',
  ai_fraud: 'bg-violet-50 text-violet-700 border-violet-200',
  internal_fraud: 'bg-red-50 text-red-700 border-red-200',
  compliance: 'bg-green-50 text-green-700 border-green-200',
  operational: 'bg-purple-50 text-purple-700 border-purple-200',
}

function PrecisionBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = value >= 70 ? 'text-green-600' : value >= 40 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>{value}%</span>
    </div>
  )
}

export default function RulesManagementPage() {
  const [rules, setRules] = useState<any[]>([])
  const [rulesSummary, setRulesSummary] = useState<any>({})
  const [effectiveness, setEffectiveness] = useState<any[]>([])
  const [bestPractices, setBestPractices] = useState<any>(null)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'rules' | 'effectiveness' | 'scenarios' | 'best_practices'>('rules')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRule, setSelectedRule] = useState<any>(null)
  const [msg, setMsg] = useState('')

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get('/rules-management/list'),
      api.get('/system-monitoring/rule-effectiveness'),
      api.get('/rules-management/industry-best-practices'),
      api.get('/rules-management/scenarios'),
    ])
      .then(([rulesRes, effRes, bpRes, scenRes]) => {
        setRules(rulesRes.data?.rules || [])
        setRulesSummary(rulesRes.data?.summary || {})
        setEffectiveness(effRes.data?.rules || [])
        setBestPractices(bpRes.data)
        setScenarios(scenRes.data?.scenarios || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load rules data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const toggleRule = (ruleId: string) => {
    api.post(`/rules-management/${ruleId}/toggle`)
      .then(() => fetchData())
      .catch(() => {})
  }

  const duplicateRule = (ruleId: string) => {
    api.post(`/rules-management/${ruleId}/duplicate`)
      .then(() => fetchData())
      .catch(() => {})
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const HIDDEN_CATEGORIES = ['aml', 'kyc', 'compliance']
  let filteredRules = rules.filter(r => !HIDDEN_CATEGORIES.includes(r.category))
  if (categoryFilter) filteredRules = filteredRules.filter(r => r.category === categoryFilter)
  if (severityFilter) filteredRules = filteredRules.filter(r => r.severity === severityFilter)
  if (searchQuery) filteredRules = filteredRules.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const statCards = [
    { label: 'Total Rules', value: rulesSummary.total || 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Enabled', value: rulesSummary.enabled || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Disabled', value: rulesSummary.disabled || 0, icon: XCircle, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Detection Scenarios', value: scenarios.length, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-4">
      {/* Message */}
      {msg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-blue-600 hover:text-blue-800"><XCircle size={14} /></button>
        </div>
      )}

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
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(rulesSummary.by_category || {}).filter(([cat]) => !HIDDEN_CATEGORIES.includes(cat)).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              categoryFilter === cat
                ? categoryColors[cat] || 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.toUpperCase()} ({count as number})
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'rules', label: 'Rules Library' },
          { key: 'effectiveness', label: 'Effectiveness Analysis' },
          { key: 'scenarios', label: 'Detection Scenarios' },
          { key: 'best_practices', label: 'Industry Best Practices' },
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

      {/* Rules tab */}
      {activeTab === 'rules' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-slate-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search rules..." className="flex-1 text-sm border-0 outline-none text-slate-700 bg-transparent" />
            </div>
            <div className="relative">
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Rule</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Category</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Severity</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Alerts</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Confirmed</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">False Alarm</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Accuracy</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Window</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map(r => (
                    <tr key={r.id} className={`border-t border-slate-100 hover:bg-slate-50 ${!r.is_enabled ? 'opacity-50' : ''}`}>
                      <td className="py-2.5 px-3">
                        <button onClick={() => setSelectedRule(selectedRule?.id === r.id ? null : r)} className="text-left">
                          <p className="text-sm font-medium text-slate-800">{r.name}</p>
                          {r.subcategory && <p className="text-xs text-slate-400 capitalize">{r.subcategory.replace(/_/g, ' ')}</p>}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge text={r.category} colors={categoryColors[r.category]?.replace('border-', 'bg-').split(' ').slice(0, 2).join(' ') || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{r.total_alerts}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-600">{r.tp_count}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600">{r.fp_count}</td>
                      <td className="py-2.5 px-3">
                        {r.total_alerts > 0 ? <PrecisionBar value={r.precision} /> : <span className="text-xs text-slate-400">-</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500">{r.time_window || '-'}</td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => toggleRule(r.id)}>
                          {r.is_enabled ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => duplicateRule(r.id)} className="p-1 rounded hover:bg-slate-100" title="Duplicate"><Copy size={13} className="text-slate-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRules.length === 0 && (
                    <tr><td colSpan={10} className="py-12 text-center text-slate-400">No rules found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rule detail panel */}
          {selectedRule && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">{selectedRule.name}</h3>
                <button onClick={() => setSelectedRule(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Conditions</p>
                  <pre className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 overflow-auto max-h-48">
                    {JSON.stringify(selectedRule.conditions, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Actions</p>
                  <pre className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 overflow-auto max-h-48">
                    {JSON.stringify(selectedRule.actions, null, 2)}
                  </pre>
                </div>
              </div>
              {selectedRule.description && (
                <p className="text-xs text-slate-500 mt-3">{selectedRule.description}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Effectiveness tab */}
      {activeTab === 'effectiveness' && (
        <div className="space-y-3">
          {effectiveness.map(r => (
            <div key={r.rule_id} className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${!r.is_enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{r.rule_name}</span>
                    <Badge text={r.category} colors={categoryColors[r.category]?.replace('border-', 'bg-').split(' ').slice(0, 2).join(' ') || 'bg-gray-100 text-gray-800'} />
                    <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                    <span className={`text-xs font-semibold capitalize ${effectivenessColors[r.effectiveness] || 'text-slate-400'}`}>
                      {r.effectiveness?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 mt-2">
                    <span className="text-xs text-slate-500">Total: <span className="font-semibold text-slate-700">{r.total_alerts}</span></span>
                    <span className="text-xs text-green-600">Confirmed: {r.tp} ({r.tp_rate}%)</span>
                    <span className="text-xs text-red-600">False Alarm: {r.fp} ({r.fp_rate}%)</span>
                    <span className="text-xs text-slate-500">Accuracy: <span className="font-semibold">{r.precision}%</span></span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Lightbulb size={12} className="text-amber-500" />
                    <span className="text-xs text-amber-700">{r.recommendation}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenarios tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          {scenarios.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-purple-600" />
                  <h3 className="text-sm font-semibold text-slate-800">{s.name}</h3>
                  {s.is_enabled ? (
                    <span className="text-xs text-green-600 font-medium">Active</span>
                  ) : (
                    <span className="text-xs text-slate-400">Disabled</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{s.detection_count || 0} detections</span>
              </div>
              {s.description && <p className="text-xs text-slate-500 mb-3">{s.description}</p>}
              <div className="flex flex-wrap gap-2">
                {s.rules?.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                    <span className="text-xs text-slate-700">{r.name}</span>
                    {r.is_enabled ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-slate-300" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Best practices tab */}
      {activeTab === 'best_practices' && bestPractices && (
        <div className="space-y-4">
          {/* Frameworks */}
          {bestPractices.frameworks?.map((f: any, i: number) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">{f.name}</h3>
              </div>
              <ul className="space-y-1.5">
                {f.rules?.map((r: string, j: number) => (
                  <li key={j} className="flex items-start gap-2">
                    <ChevronRight size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-slate-600">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Recommended rules */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={18} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800">Recommended Additional Rules</h3>
            </div>
            <div className="space-y-3">
              {bestPractices.recommended_rules?.map((r: any, i: number) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-slate-800">{r.name}</span>
                        <Badge text={r.category} colors={categoryColors[r.category]?.replace('border-', 'bg-').split(' ').slice(0, 2).join(' ') || 'bg-gray-100 text-gray-800'} />
                        <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                      </div>
                      <p className="text-xs text-slate-600">{r.description}</p>
                    </div>
                    <button
                      onClick={() => {
                        api.post('/rules/create', {
                          name: r.name, description: r.description,
                          category: r.category || 'fraud', subcategory: r.subcategory || 'recommended',
                          severity: r.severity || 'medium', priority: 5, is_enabled: false,
                          conditions: { type: 'AND', conditions: [] }, actions: [{ action: 'create_alert', params: { priority: r.severity || 'medium' } }],
                        }).then(() => { setMsg(`Rule "${r.name}" added (disabled, pending approval)`); fetchData(); setTimeout(() => setMsg(''), 4000) })
                          .catch(() => setMsg('Failed to add rule'))
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 whitespace-nowrap flex-shrink-0 ml-3"
                    >
                      + Add Rule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
