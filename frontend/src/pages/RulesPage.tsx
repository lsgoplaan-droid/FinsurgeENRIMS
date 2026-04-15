import { useState, useEffect, type ReactNode } from 'react'
import {
  BookOpen, ChevronRight, ToggleLeft, ToggleRight, X, Plus, Edit3, Trash2,
  Save, Search, Play, CheckCircle2, Layers, Variable, GitBranch,
  AlertTriangle, ArrowDown,
} from 'lucide-react'
import api from '../config/api'
import { formatDateTime } from '../utils/formatters'

// ── Constants ──────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  'All Products', 'NEFT', 'RTGS', 'IMPS', 'SWIFT', 'UPI', 'Cash',
  'POS', 'ATM', 'Internet Banking', 'Mobile Banking', 'Standing Instruction',
]

const CATEGORIES = ['fraud', 'cyber_fraud', 'ai_fraud', 'internal_fraud']
const HIDDEN_CATEGORIES = ['aml', 'kyc', 'compliance']

const PRIORITIES = [
  { label: 'Low',      value: 'low',      num: 10, color: 'bg-green-100 text-green-800' },
  { label: 'Medium',   value: 'medium',   num: 20, color: 'bg-blue-100 text-blue-800' },
  { label: 'High',     value: 'high',     num: 30, color: 'bg-amber-100 text-amber-800' },
  { label: 'Critical', value: 'critical', num: 40, color: 'bg-red-100 text-red-800' },
]

const STATUSES = [
  { label: 'Draft',    value: 'draft',    color: 'bg-slate-100 text-slate-600' },
  { label: 'Active',   value: 'active',   color: 'bg-green-100 text-green-800' },
  { label: 'Inactive', value: 'inactive', color: 'bg-orange-100 text-orange-700' },
]

const OPERATORS = [
  { label: '> Greater than',       value: 'greater_than' },
  { label: '< Less than',          value: 'less_than' },
  { label: '>= Greater or equal',  value: 'greater_than_or_equal' },
  { label: '<= Less or equal',     value: 'less_than_or_equal' },
  { label: '= Equals',             value: 'equals' },
  { label: '≠ Not equals',         value: 'not_equals' },
  { label: '∈ In list',            value: 'in' },
  { label: '∉ Not in list',        value: 'not_in' },
  { label: '== Same field as',     value: 'equals_field' },
]

const AVAILABLE_FIELDS = [
  { label: 'Amount',                value: 'transaction.amount',                type: 'Decimal' },
  { label: 'Tx Method',             value: 'transaction.transaction_method',    type: 'String' },
  { label: 'Tx Type',               value: 'transaction.transaction_type',      type: 'String' },
  { label: 'Channel',               value: 'transaction.channel',               type: 'String' },
  { label: 'Employee Account',      value: 'transaction.is_employee_account',   type: 'Boolean' },
  { label: 'After Hours',           value: 'transaction.is_after_hours',        type: 'Boolean' },
  { label: 'Count (window)',         value: 'aggregate.transaction_count',       type: 'Integer' },
  { label: 'Sum (window)',           value: 'aggregate.transaction_sum',         type: 'Decimal' },
  { label: 'Unique Counterparties', value: 'aggregate.unique_counterparties',   type: 'Integer' },
  { label: 'Unique Locations',      value: 'aggregate.unique_locations',        type: 'Integer' },
  { label: 'Unique Channels',       value: 'aggregate.unique_channels',         type: 'Integer' },
  { label: 'Round Amounts',         value: 'aggregate.round_amount_count',      type: 'Integer' },
  { label: 'KYC Status',            value: 'customer.kyc_status',               type: 'String' },
  { label: 'Risk Score',            value: 'customer.risk_score',               type: 'Integer' },
  { label: 'Account Status',        value: 'account.status',                    type: 'String' },
  { label: 'Override Count',        value: 'audit.override_count',              type: 'Integer' },
  { label: 'Reversal Count',        value: 'audit.reversal_count',              type: 'Integer' },
  { label: 'Cash Variance',         value: 'branch.cash_variance',              type: 'Decimal' },
  { label: 'Maker ID',              value: 'audit.maker_id',                    type: 'String' },
]

const DATA_TYPES = ['Decimal', 'Integer', 'String', 'Boolean', 'Date']

// ── Types ──────────────────────────────────────────────────────────────────

interface ConditionRow {
  id: string
  field: string
  operator: string
  value: string
  timeWindow: string
}

interface InputVariable {
  id: string
  field: string
  dataType: string
  description: string
}

interface RuleForm {
  name: string
  description: string
  productType: string
  category: string
  priority: string
  status: string
  logic: string
  conditionRows: ConditionRow[]
  inputVariables: InputVariable[]
  thenSeverity: string
  thresholdAmount: string
  thresholdCount: string
  timeWindow: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function newId() { return Math.random().toString(36).slice(2, 9) }

function priorityFromNum(num: number) {
  return PRIORITIES.find(p => p.num === num)?.value || 'medium'
}
function priorityInfo(value: string) {
  return PRIORITIES.find(p => p.value === value) || PRIORITIES[1]
}
function statusInfo(value: string) {
  return STATUSES.find(s => s.value === value) || STATUSES[0]
}

function conditionsToRows(conditions: any): { rows: ConditionRow[]; logic: string } {
  if (!conditions) return { rows: [], logic: 'AND' }
  const logic = conditions.logic || 'AND'
  const list = conditions.conditions || conditions.all || conditions.any || []
  return {
    logic,
    rows: (list as any[]).map(c => ({
      id: newId(),
      field: c.field || '',
      operator: c.operator || 'greater_than',
      value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value ?? ''),
      timeWindow: c.time_window || '',
    })),
  }
}

function rowsToConditions(rows: ConditionRow[], logic: string) {
  return {
    logic,
    conditions: rows.filter(r => r.field).map(r => ({
      field: r.field,
      operator: r.operator,
      value: (r.operator === 'in' || r.operator === 'not_in')
        ? r.value.split(',').map(v => v.trim())
        : (isNaN(Number(r.value)) ? r.value : Number(r.value)),
      ...(r.timeWindow ? { time_window: r.timeWindow } : {}),
    })),
  }
}

function deriveVarsFromRows(rows: ConditionRow[]): InputVariable[] {
  const seen = new Set<string>()
  return rows.filter(r => r.field).reduce<InputVariable[]>((acc, r) => {
    if (!seen.has(r.field)) {
      seen.add(r.field)
      const fd = AVAILABLE_FIELDS.find(f => f.value === r.field)
      acc.push({ id: newId(), field: r.field, dataType: fd?.type || 'Decimal', description: fd?.label || r.field })
    }
    return acc
  }, [])
}

function ruleToForm(rule: any): RuleForm {
  const { rows, logic } = conditionsToRows(rule.conditions || {})
  return {
    name: rule.name || '',
    description: rule.description || '',
    productType: rule.subcategory || 'All Products',
    category: rule.category || 'fraud',
    priority: priorityFromNum(rule.priority || 20),
    status: rule.is_enabled ? 'active' : 'inactive',
    logic,
    conditionRows: rows,
    inputVariables: deriveVarsFromRows(rows),
    thenSeverity: rule.actions?.[0]?.params?.severity || rule.severity || 'high',
    thresholdAmount: rule.threshold_amount ? String(rule.threshold_amount) : '',
    thresholdCount: rule.threshold_count ? String(rule.threshold_count) : '',
    timeWindow: rule.time_window || '',
  }
}

function formToPayload(form: RuleForm) {
  const pInfo = priorityInfo(form.priority)
  return {
    name: form.name,
    description: form.description,
    category: form.category,
    subcategory: form.productType !== 'All Products' ? form.productType : '',
    severity: form.thenSeverity,
    is_enabled: form.status === 'active',
    priority: pInfo.num,
    conditions: rowsToConditions(form.conditionRows, form.logic),
    actions: [{ action: 'create_alert', params: { title: `${form.name} — triggered`, severity: form.thenSeverity } }],
    time_window: form.timeWindow || null,
    threshold_amount: form.thresholdAmount ? parseInt(form.thresholdAmount) : null,
    threshold_count: form.thresholdCount ? parseInt(form.thresholdCount) : null,
  }
}

function evalSimulation(form: RuleForm, values: Record<string, string>): 'TRIGGERED' | 'NO_ALERT' {
  const active = form.conditionRows.filter(r => r.field)
  if (active.length === 0) return 'NO_ALERT'
  const results = active.map(row => {
    const raw = values[row.field] ?? ''
    const inputNum = parseFloat(raw)
    const thresh = parseFloat(row.value)
    switch (row.operator) {
      case 'greater_than':          return inputNum > thresh
      case 'less_than':             return inputNum < thresh
      case 'greater_than_or_equal': return inputNum >= thresh
      case 'less_than_or_equal':    return inputNum <= thresh
      case 'equals':                return raw === row.value || inputNum === thresh
      case 'not_equals':            return raw !== row.value && inputNum !== thresh
      case 'in':                    return row.value.split(',').map(v => v.trim()).includes(raw)
      case 'not_in':                return !row.value.split(',').map(v => v.trim()).includes(raw)
      default:                      return true
    }
  })
  const fired = form.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
  return fired ? 'TRIGGERED' : 'NO_ALERT'
}

const EMPTY_FORM: RuleForm = {
  name: '', description: '', productType: 'All Products', category: 'fraud',
  priority: 'medium', status: 'draft', logic: 'AND',
  conditionRows: [{ id: 'c0', field: 'transaction.amount', operator: 'greater_than', value: '1000000', timeWindow: '' }],
  inputVariables: [{ id: 'v0', field: 'transaction.amount', dataType: 'Decimal', description: 'Amount' }],
  thenSeverity: 'high', thresholdAmount: '', thresholdCount: '', timeWindow: '',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CanvasNode({ icon, title, color, children }: {
  icon: ReactNode; title: string; color: string; children: ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl border-2 ${color} p-5 shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function NodeConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center gap-0">
        <div className="w-px h-5 bg-slate-300" />
        <ArrowDown size={12} className="text-slate-300 -mt-1" />
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function RulesPage() {
  const [mode, setMode] = useState<'list' | 'editor'>('list')
  const [sidebarTab, setSidebarTab] = useState<'properties' | 'simulation'>('properties')

  // List state
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Editor state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Simulation state
  const [simValues, setSimValues] = useState<Record<string, string>>({})
  const [simResult, setSimResult] = useState<'TRIGGERED' | 'NO_ALERT' | null>(null)
  const [simRan, setSimRan] = useState(false)

  const loadRules = () => {
    setLoading(true)
    api.get('/rules', { params: { page_size: 200 } })
      .then(res => {
        const items: any[] = res.data.items || res.data || []
        setRules(items.filter(r => !HIDDEN_CATEGORIES.includes((r.category || '').toLowerCase())))
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load rules'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRules() }, [])

  const openCreate = () => {
    setEditingRuleId(null)
    setForm({ ...EMPTY_FORM, conditionRows: [{ id: newId(), field: 'transaction.amount', operator: 'greater_than', value: '', timeWindow: '' }] })
    resetSim()
    setSidebarTab('properties')
    setMode('editor')
  }

  const openEdit = async (rule: any) => {
    try {
      const res = await api.get(`/rules/${rule.id}`)
      setForm(ruleToForm(res.data))
    } catch {
      setForm(ruleToForm(rule))
    }
    setEditingRuleId(rule.id)
    resetSim()
    setSidebarTab('properties')
    setMode('editor')
  }

  const resetSim = () => { setSimValues({}); setSimResult(null); setSimRan(false) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (editingRuleId) {
        await api.put(`/rules/${editingRuleId}`, payload)
        setMsg(`Rule "${form.name}" updated`)
      } else {
        await api.post('/rules/create', payload)
        setMsg(`Rule "${form.name}" created`)
      }
      setMode('list')
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
      loadRules()
      setTimeout(() => setMsg(''), 4000)
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Failed to delete rule')
    }
  }

  const handleToggle = async (ruleId: string) => {
    try {
      const res = await api.post(`/rules/${ruleId}/toggle`)
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_enabled: res.data.is_enabled ?? !r.is_enabled } : r))
    } catch { /* ignore */ }
  }

  // Condition row mutations
  const addConditionRow = () => {
    const updated = [...form.conditionRows, { id: newId(), field: 'transaction.amount', operator: 'greater_than', value: '', timeWindow: '' }]
    setForm(f => ({ ...f, conditionRows: updated, inputVariables: deriveVarsFromRows(updated) }))
  }

  const updateConditionRow = (id: string, changes: Partial<ConditionRow>) => {
    const updated = form.conditionRows.map(r => r.id === id ? { ...r, ...changes } : r)
    setForm(f => ({ ...f, conditionRows: updated, inputVariables: deriveVarsFromRows(updated) }))
  }

  const removeConditionRow = (id: string) => {
    const updated = form.conditionRows.filter(r => r.id !== id)
    setForm(f => ({ ...f, conditionRows: updated, inputVariables: deriveVarsFromRows(updated) }))
  }

  // Filtered list
  const filteredRules = rules
    .filter(r => !selectedCategory || r.category === selectedCategory)
    .filter(r => !searchQuery ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()))

  const catMap = rules.reduce<Record<string, number>>((acc, r) => {
    const cat = r.category || 'other'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  // ── EDITOR VIEW ──────────────────────────────────────────────────────────

  if (mode === 'editor') {
    const uniqueFields = Array.from(new Set(form.conditionRows.filter(r => r.field).map(r => r.field)))

    return (
      <div className="fixed inset-0 bg-slate-100 z-40 flex flex-col">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setMode('list')} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium">
              <BookOpen size={14} />
              Rules Engine
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-800">{editingRuleId ? 'Edit Rule' : 'New Rule'}</span>
            {form.name && <span className="text-slate-400">— {form.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMode('list')} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Rule'}
            </button>
          </div>
        </div>

        {msg && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700 flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')}><X size={14} /></button>
          </div>
        )}

        {/* Two-panel layout */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: Canvas ── */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">

              {/* Node 1: Rule Definition */}
              <CanvasNode icon={<Layers size={15} className="text-blue-600" />} title="RULE DEFINITION" color="border-blue-300 bg-blue-50/40">
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    {form.name || <span className="italic text-slate-400 font-normal text-sm">Untitled rule — fill in name →</span>}
                  </p>
                  {form.description && <p className="text-xs text-slate-500 mt-0.5">{form.description}</p>}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo(form.status).color}`}>{statusInfo(form.status).label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo(form.priority).color}`}>{priorityInfo(form.priority).label} Priority</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{form.category.replace(/_/g, ' ')}</span>
                    {form.productType !== 'All Products' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{form.productType}</span>
                    )}
                  </div>
                </div>
              </CanvasNode>

              <NodeConnector />

              {/* Node 2: Input Variables */}
              <CanvasNode icon={<Variable size={15} className="text-purple-600" />} title="INPUT" color="border-purple-200 bg-purple-50/30">
                <p className="text-xs text-slate-500 mb-3">Transaction fields evaluated by this rule — auto-derived from conditions below</p>
                {form.inputVariables.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No variables yet — add conditions to define inputs</p>
                ) : (
                  <div className="space-y-1.5">
                    {form.inputVariables.map((v, i) => (
                      <div key={v.id} className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg border border-slate-100">
                        <span className="text-xs font-mono text-slate-700 flex-1 truncate">{v.field}</span>
                        <span className="text-xs text-slate-400 hidden sm:block">{v.description}</span>
                        <select
                          value={v.dataType}
                          onChange={e => setForm(f => ({
                            ...f,
                            inputVariables: f.inputVariables.map((iv, j) => j === i ? { ...iv, dataType: e.target.value } : iv),
                          }))}
                          className="text-xs border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 bg-white cursor-pointer"
                        >
                          {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </CanvasNode>

              <NodeConnector />

              {/* Node 3: Condition */}
              <CanvasNode icon={<GitBranch size={15} className="text-amber-600" />} title="CONDITION" color="border-amber-200 bg-amber-50/30">
                {/* Logic toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-slate-500 font-medium">Match</span>
                  {['AND', 'OR'].map(l => (
                    <button
                      key={l}
                      onClick={() => setForm(f => ({ ...f, logic: l }))}
                      className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
                        form.logic === l
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                  <span className="text-xs text-slate-500">of the following conditions</span>
                </div>

                {/* Condition rows */}
                <div className="space-y-2">
                  {form.conditionRows.map((row, i) => (
                    <div key={row.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <span className="text-xs font-bold text-amber-600 w-6 text-center flex-shrink-0">
                        {i === 0 ? 'IF' : form.logic}
                      </span>
                      <select
                        value={row.field}
                        onChange={e => updateConditionRow(row.id, { field: e.target.value })}
                        className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 min-w-[140px]"
                      >
                        {AVAILABLE_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        value={row.operator}
                        onChange={e => updateConditionRow(row.id, { operator: e.target.value })}
                        className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700"
                      >
                        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                      </select>
                      <input
                        value={row.value}
                        onChange={e => updateConditionRow(row.id, { value: e.target.value })}
                        placeholder="value"
                        className="w-28 text-xs px-2 py-1.5 border border-slate-200 rounded-lg font-mono bg-white"
                      />
                      <input
                        value={row.timeWindow}
                        onChange={e => updateConditionRow(row.id, { timeWindow: e.target.value })}
                        placeholder="window (1h)"
                        className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                      />
                      <button
                        onClick={() => removeConditionRow(row.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Remove condition"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addConditionRow}
                  className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={13} /> Add Condition
                </button>
              </CanvasNode>

              {/* THEN / ELSE split */}
              <NodeConnector />
              <div className="grid grid-cols-2 gap-4">
                {/* THEN */}
                <div>
                  <p className="text-center text-xs font-semibold text-green-700 mb-2">THEN — conditions met</p>
                  <div className="bg-white rounded-xl border-2 border-green-300 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-800">Create Alert</span>
                    </div>
                    <label className="block text-xs text-slate-500 mb-1">Alert Severity</label>
                    <select
                      value={form.thenSeverity}
                      onChange={e => setForm(f => ({ ...f, thenSeverity: e.target.value }))}
                      className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                {/* ELSE */}
                <div>
                  <p className="text-center text-xs font-semibold text-slate-500 mb-2">ELSE — no match</p>
                  <div className="bg-white rounded-xl border-2 border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">No Action</p>
                        <p className="text-xs text-slate-400">Transaction passes through</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <NodeConnector />

              {/* Node 5: Result */}
              <CanvasNode icon={<Play size={15} className="text-green-600" />} title="RESULT" color="border-green-200 bg-green-50/30">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Outcome: <span className="font-medium">
                      Create <span className={`capitalize font-semibold ${
                        form.thenSeverity === 'critical' ? 'text-red-600'
                        : form.thenSeverity === 'high' ? 'text-amber-600'
                        : form.thenSeverity === 'medium' ? 'text-blue-600'
                        : 'text-green-600'
                      }`}>{form.thenSeverity}</span> alert
                    </span></p>
                    {form.timeWindow && <p>Time window: <span className="font-mono font-medium">{form.timeWindow}</span></p>}
                    <p>Logic: <span className="font-medium">{form.logic}</span> ({form.conditionRows.filter(r => r.field).length} condition{form.conditionRows.filter(r => r.field).length !== 1 ? 's' : ''})</p>
                  </div>
                  <button
                    onClick={() => { setSidebarTab('simulation'); resetSim() }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Play size={12} />
                    Run Simulation
                  </button>
                </div>
              </CanvasNode>

              <div className="h-8" />
            </div>
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="w-80 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 flex-shrink-0">
              {(['properties', 'simulation'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                    sidebarTab === tab
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {tab === 'properties' ? 'Properties' : 'Simulation'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">

              {sidebarTab === 'properties' ? (
                <div className="space-y-6">

                  {/* Rule Definition */}
                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Rule Definition</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Rule Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={form.name}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. High Value Card Transaction"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                        <textarea
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Describe what this rule detects…"
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Product Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.productType}
                          onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {PRODUCT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Rule Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.category}
                          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                          <select
                            value={form.priority}
                            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                          <select
                            value={form.status}
                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Thresholds */}
                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Thresholds <span className="text-slate-300 font-normal">(optional)</span></h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Threshold (paise)</label>
                        <input
                          type="number"
                          value={form.thresholdAmount}
                          onChange={e => setForm(f => ({ ...f, thresholdAmount: e.target.value }))}
                          placeholder="e.g. 10000000 = Nu.1L"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Count Threshold</label>
                        <input
                          type="number"
                          value={form.thresholdCount}
                          onChange={e => setForm(f => ({ ...f, thresholdCount: e.target.value }))}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Time Window</label>
                        <input
                          value={form.timeWindow}
                          onChange={e => setForm(f => ({ ...f, timeWindow: e.target.value }))}
                          placeholder="e.g. 1h, 24h, 7d"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </section>

                  {/* IMPORTS */}
                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">IMPORTS</h3>
                    <p className="text-xs text-slate-400 mb-2">Include other saved rules as referenced models.</p>
                    <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                      <Plus size={12} /> Add import
                    </button>
                  </section>
                </div>

              ) : (
                /* Simulation tab */
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Test Case</h3>
                    {uniqueFields.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Add conditions first to enable simulation</p>
                    ) : (
                      <div className="space-y-3">
                        {uniqueFields.map(field => {
                          const fd = AVAILABLE_FIELDS.find(f => f.value === field)
                          return (
                            <div key={field}>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                {fd?.label || field}
                                <span className="text-slate-400 font-mono font-normal ml-1 text-[10px]">{field}</span>
                              </label>
                              <input
                                value={simValues[field] || ''}
                                onChange={e => setSimValues(sv => ({ ...sv, [field]: e.target.value }))}
                                placeholder={fd?.type === 'String' ? 'text value' : '0'}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )
                        })}

                        <button
                          onClick={() => {
                            setSimResult(evalSimulation(form, simValues))
                            setSimRan(true)
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Play size={14} /> Run Simulation
                        </button>

                        {simRan && simResult && (
                          <div className={`rounded-xl p-4 text-center border-2 ${
                            simResult === 'TRIGGERED'
                              ? 'bg-red-50 border-red-300'
                              : 'bg-green-50 border-green-300'
                          }`}>
                            {simResult === 'TRIGGERED' ? (
                              <>
                                <AlertTriangle size={28} className="text-red-500 mx-auto mb-1.5" />
                                <p className="font-bold text-red-700 text-sm">RULE TRIGGERED</p>
                                <p className="text-xs text-red-600 mt-1">
                                  Creates a <span className="font-semibold capitalize">{form.thenSeverity}</span> alert
                                </p>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={28} className="text-green-500 mx-auto mb-1.5" />
                                <p className="font-bold text-green-700 text-sm">NO ALERT</p>
                                <p className="text-xs text-green-600 mt-1">Transaction passes — no action taken</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading…</div>
  if (error && rules.length === 0) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  return (
    <div className="flex gap-4 h-full">

      {/* Category sidebar */}
      <div className="w-52 flex-shrink-0 space-y-3">
        <button
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Rule
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Categories</h3>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedCategory('')}
              className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedCategory ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>All Rules</span>
              <span className="text-xs text-slate-400">{rules.length}</span>
            </button>
            {Object.entries(catMap).map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                  selectedCategory === cat ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{cat.replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-400">{count as number}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules list */}
      <div className="flex-1 min-w-0 space-y-3">
        {msg && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')}><X size={14} /></button>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex items-center gap-3">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search rules by name or description…"
            className="flex-1 text-sm border-0 outline-none text-slate-700 bg-transparent"
          />
          <span className="text-xs text-slate-400 flex-shrink-0">{filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rule Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Modified</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map(r => {
                  const pInfo = PRIORITIES.find(p => p.num === r.priority) || PRIORITIES[1]
                  const sInfo = r.is_enabled ? STATUSES[1] : STATUSES[2]
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-3 px-4 max-w-xs">
                        <button onClick={() => openEdit(r)} className="text-left w-full">
                          <p className="text-sm font-semibold text-blue-700 group-hover:underline truncate">{r.name}</p>
                          {r.description && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">{r.description}</p>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-600">{r.subcategory || 'All Products'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize whitespace-nowrap">
                          {(r.category || '—').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pInfo.color}`}>{pInfo.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggle(r.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            title="Toggle rule"
                          >
                            {r.is_enabled
                              ? <ToggleRight size={20} className="text-green-500" />
                              : <ToggleLeft size={20} className="text-slate-300" />}
                          </button>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sInfo.color}`}>{sInfo.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(r.created_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(r)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit rule"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredRules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                      {searchQuery ? `No rules match "${searchQuery}"` : 'No rules found in this category'}
                    </td>
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
