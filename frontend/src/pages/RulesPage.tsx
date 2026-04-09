import { useState, useEffect } from 'react'
import { BookOpen, ChevronRight, ToggleLeft, ToggleRight, X, Plus, Edit3, Trash2, Save } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, priorityColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const CATEGORIES = ['fraud', 'cyber_fraud', 'ai_fraud', 'internal_fraud']
const SEVERITIES = ['critical', 'high', 'medium', 'low']
const HIDDEN_CATEGORIES = ['aml', 'kyc', 'compliance']

const emptyForm = {
  name: '', description: '', category: 'fraud', subcategory: '', severity: 'medium',
  is_enabled: true, priority: 20, time_window: '', threshold_amount: '', threshold_count: '',
}

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [selectedRule, setSelectedRule] = useState<any>(null)
  const [ruleLoading, setRuleLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const loadRules = () => {
    // Use fraud-detection/rules endpoint to stay in sync with Fraud Detection page
    api.get('/fraud-detection/rules')
      .then(res => {
        const items = res.data || []
        // Normalize field names to match /rules response
        setRules(items.map((r: any) => ({
          ...r,
          name: r.rule_id || r.name,
          description: r.name || r.description,
          detection_count: r.detection_count ?? 0,
          last_triggered_at: r.last_triggered || null,
        })))
      })
      .catch(() => {
        // Fallback to /rules endpoint
        api.get('/rules', { params: { page_size: 200 } })
          .then(res => {
            const items = res.data.items || res.data || []
            setRules(items.filter((r: any) => !HIDDEN_CATEGORIES.includes((r.category || '').toLowerCase())))
          })
          .catch(err => setError(err.response?.data?.detail || 'Failed to load rules'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRules() }, [])

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const handleToggleRule = async (ruleId: string) => {
    setTogglingId(ruleId)
    try {
      const res = await api.post(`/rules/${ruleId}/toggle`)
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_enabled: res.data.is_enabled ?? !r.is_enabled } : r))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle rule')
    } finally {
      setTogglingId(null)
    }
  }

  const viewRuleDetail = async (ruleId: string) => {
    setRuleLoading(true)
    try {
      const res = await api.get(`/rules/${ruleId}`)
      setSelectedRule(res.data)
    } catch { setSelectedRule(null) }
    finally { setRuleLoading(false) }
  }

  const openCreate = () => {
    setForm({ ...emptyForm })
    setEditingRule(null)
    setShowCreateModal(true)
  }

  const openEdit = (rule: any) => {
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      category: rule.category || 'fraud',
      subcategory: rule.subcategory || '',
      severity: rule.severity || 'medium',
      is_enabled: rule.is_enabled ?? true,
      priority: rule.priority || 20,
      time_window: rule.time_window || '',
      threshold_amount: rule.threshold_amount ? String(rule.threshold_amount) : '',
      threshold_count: rule.threshold_count ? String(rule.threshold_count) : '',
    })
    setEditingRule(rule)
    setShowCreateModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        threshold_amount: form.threshold_amount ? parseInt(form.threshold_amount) : null,
        threshold_count: form.threshold_count ? parseInt(form.threshold_count) : null,
        time_window: form.time_window || null,
      }
      if (editingRule) {
        await api.put(`/rules/${editingRule.id}`, payload)
        setMsg(`Rule "${form.name}" updated`)
      } else {
        await api.post('/rules/create', payload)
        setMsg(`Rule "${form.name}" created`)
      }
      setShowCreateModal(false)
      setEditingRule(null)
      setSelectedRule(null)
      loadRules()
      setTimeout(() => setMsg(''), 4000)
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Delete rule "${ruleName}"? This cannot be undone.`)) return
    try {
      await api.delete(`/rules/${ruleId}`)
      setMsg(`Rule "${ruleName}" deleted`)
      setSelectedRule(null)
      loadRules()
      setTimeout(() => setMsg(''), 4000)
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Failed to delete rule')
    }
  }

  const filteredRules = selectedCategory
    ? rules.filter(r => (r.category || '').toLowerCase() === selectedCategory.toLowerCase() || (r.subcategory || '').toLowerCase() === selectedCategory.toLowerCase())
    : rules

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && rules.length === 0) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const catMap: Record<string, { count: number; subcategories: Record<string, number> }> = {}
  rules.forEach(r => {
    const cat = r.category || 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { count: 0, subcategories: {} }
    catMap[cat].count++
    if (r.subcategory) catMap[cat].subcategories[r.subcategory] = (catMap[cat].subcategories[r.subcategory] || 0) + 1
  })
  const displayCategories = Object.entries(catMap).map(([name, data]) => ({
    name, key: name.toLowerCase(), count: data.count,
    subcategories: Object.entries(data.subcategories).map(([n, c]) => ({ name: n, key: n.toLowerCase(), count: c })),
  }))

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar */}
      <div className="w-64 flex-shrink-0 space-y-3">
        <button onClick={openCreate} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Rule
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Categories</h3>
          <div className="space-y-1">
            <button onClick={() => setSelectedCategory('')} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!selectedCategory ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              All Rules ({rules.length})
            </button>
            {displayCategories.map(cat => (
              <div key={cat.key || cat.name}>
                <button onClick={() => { setSelectedCategory(cat.key || cat.name); toggleCategory(cat.key || cat.name) }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === (cat.key || cat.name) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="capitalize">{cat.name.replace(/_/g, ' ')}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">{cat.count}</span>
                    {cat.subcategories.length > 0 && <ChevronRight size={14} className={`transition-transform ${expandedCategories.has(cat.key || cat.name) ? 'rotate-90' : ''}`} />}
                  </span>
                </button>
                {cat.subcategories && expandedCategories.has(cat.key || cat.name) && (
                  <div className="ml-3 space-y-0.5">
                    {cat.subcategories.map(sub => (
                      <button key={sub.key} onClick={() => setSelectedCategory(sub.key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${selectedCategory === sub.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {sub.name.replace(/_/g, ' ')} ({sub.count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - rules table */}
      <div className="flex-1 min-w-0 space-y-3">
        {msg && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')}><X size={14} /></button>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Severity</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Enabled</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Detections</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Triggered</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/50 transition-colors">
                    <td className="py-2.5 px-3 cursor-pointer" onClick={() => viewRuleDetail(r.id)}>
                      <p className="text-sm font-medium text-blue-700 hover:underline">{r.name || r.rule_name}</p>
                      {r.description && <p className="text-xs text-slate-400 truncate max-w-[300px]">{r.description}</p>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize text-xs">
                      {(r.category || '-').replace(/_/g, ' ')}
                      {r.subcategory && <span className="text-slate-400"> / {r.subcategory.replace(/_/g, ' ')}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.severity || '-'} colors={severityColors[r.severity] || priorityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3">
                      <button onClick={(e) => { e.stopPropagation(); handleToggleRule(r.id) }} disabled={togglingId === r.id} className="disabled:opacity-50">
                        {(r.is_enabled ?? r.enabled) ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} className="text-slate-300" />}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">{r.detection_count ?? '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(r.last_triggered_at)}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => handleDelete(r.id, r.name)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRules.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No rules found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rule Detail Modal */}
      {(selectedRule || ruleLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedRule(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            {ruleLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedRule && (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{selectedRule.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">{selectedRule.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { openEdit(selectedRule); setSelectedRule(null) }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => setSelectedRule(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[
                    ['Category', (selectedRule.category || '-').replace(/_/g, ' ')],
                    ['Subcategory', (selectedRule.subcategory || '-').replace(/_/g, ' ')],
                    ['Severity', selectedRule.severity || '-'],
                    ['Enabled', (selectedRule.is_enabled ?? selectedRule.enabled) ? 'Active' : 'Disabled'],
                    ['Detections', selectedRule.detection_count ?? 0],
                    ['Last Triggered', formatDateTime(selectedRule.last_triggered_at)],
                    ['Time Window', selectedRule.time_window || '-'],
                    ['Threshold Amount', selectedRule.threshold_amount ? `₹${(selectedRule.threshold_amount / 100).toLocaleString('en-IN')}` : '-'],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5 capitalize">{String(value || '-')}</p>
                    </div>
                  ))}
                </div>
                {selectedRule.conditions && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Conditions</h3>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                        {typeof selectedRule.conditions === 'string' ? selectedRule.conditions : JSON.stringify(selectedRule.conditions, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                {selectedRule.actions && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Actions</h3>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono">
                        {typeof selectedRule.actions === 'string' ? selectedRule.actions : JSON.stringify(selectedRule.actions, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">{editingRule ? 'Edit Rule' : 'Create New Rule'}</h3>
                <button onClick={() => { setShowCreateModal(false); setEditingRule(null) }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. FRD-NEW-001" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What does this rule detect?" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory</label>
                  <input value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))} placeholder="e.g. card, wire, behavioral" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 20 }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_enabled} onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))} className="rounded border-slate-300" />
                    <span className="text-sm text-slate-700">Enabled</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time Window</label>
                  <input value={form.time_window} onChange={e => setForm(f => ({ ...f, time_window: e.target.value }))} placeholder="e.g. 24h, 7d" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount Threshold (paise)</label>
                  <input type="number" value={form.threshold_amount} onChange={e => setForm(f => ({ ...f, threshold_amount: e.target.value }))} placeholder="e.g. 10000000" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Count Threshold</label>
                  <input type="number" value={form.threshold_count} onChange={e => setForm(f => ({ ...f, threshold_count: e.target.value }))} placeholder="e.g. 5" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-400">{editingRule ? 'Changes apply immediately' : 'Rule will be created and enabled'}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowCreateModal(false); setEditingRule(null) }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Save size={14} />
                  {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
