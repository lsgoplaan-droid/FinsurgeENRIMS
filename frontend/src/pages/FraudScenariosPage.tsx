import { useState, useEffect } from 'react'
import { BookOpen, Shield, AlertTriangle, Activity, Plus, Pencil, Trash2, X } from 'lucide-react'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const EMPTY_TYPOLOGY = {
  name: '',
  category: 'Fraud',
  subcategory: '',
  risk: 'medium',
  status: 'active',
  description: '',
  fatf_reference: '',
  indicators: '',  // newline-separated in form, converted to array on save
  rules_count: 0,
}

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const riskBadgeColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const categoryBadgeColors: Record<string, string> = {
  fraud: 'bg-red-100 text-red-800',
  Fraud: 'bg-red-100 text-red-800',
  cyber_fraud: 'bg-orange-100 text-orange-800',
  ai_fraud: 'bg-violet-100 text-violet-800',
  internal_fraud: 'bg-amber-100 text-amber-800',
  AML: 'bg-blue-100 text-blue-800',
  aml: 'bg-blue-100 text-blue-800',
  Compliance: 'bg-slate-100 text-slate-700',
  compliance: 'bg-slate-100 text-slate-700',
}

const TABS = [
  { key: '', label: 'All' },
  { key: 'fraud', label: 'Fraud' },
  { key: 'cyber_fraud', label: 'Cyber Fraud' },
  { key: 'ai_fraud', label: 'AI Fraud' },
  { key: 'internal_fraud', label: 'Internal Fraud' },
]

export default function FraudScenariosPage() {
  const [stats, setStats] = useState<any>(null)
  const [typologies, setTypologies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY_TYPOLOGY)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const fetchData = () => {
    setLoading(true)
    setError('')
    const params: any = {}
    if (tab) params.category = tab

    Promise.all([
      api.get('/fraud-scenarios/stats'),
      api.get('/fraud-scenarios/typologies', { params }),
    ])
      .then(([statsRes, typologiesRes]) => {
        setStats(statsRes.data)
        const HIDDEN = ['aml', 'kyc', 'compliance']
        const raw = typologiesRes.data?.items || typologiesRes.data?.typologies || typologiesRes.data || []
        setTypologies(raw.filter((t: any) => !HIDDEN.includes(t.category?.toLowerCase())))
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load fraud scenarios'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [tab])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_TYPOLOGY })
    setShowModal(true)
  }

  const openEdit = (typ: any) => {
    setEditingId(typ.id)
    setForm({
      name: typ.name || '',
      category: typ.category || 'Fraud',
      subcategory: typ.subcategory || '',
      risk: typ.risk || typ.risk_level || 'medium',
      status: typ.status || 'active',
      description: typ.description || '',
      fatf_reference: typ.fatf_reference || '',
      indicators: (typ.indicators || []).join('\n'),
      rules_count: typ.rules_count || 0,
    })
    setShowModal(true)
  }

  const saveTypology = () => {
    setSaving(true)
    const payload = {
      ...form,
      rules_count: Number(form.rules_count) || 0,
      indicators: form.indicators
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean),
    }
    const req = editingId
      ? api.put(`/fraud-scenarios/typologies/${editingId}`, payload)
      : api.post('/fraud-scenarios/typologies', payload)
    req
      .then(() => {
        setShowModal(false)
        setActionMsg(editingId ? 'Typology updated' : 'Typology created')
        setTimeout(() => setActionMsg(''), 3000)
        fetchData()
      })
      .catch(err => setActionMsg(err.response?.data?.detail || 'Save failed'))
      .finally(() => setSaving(false))
  }

  const deleteTypology = (id: string) => {
    if (!window.confirm('Delete this typology? This cannot be undone.')) return
    api.delete(`/fraud-scenarios/typologies/${id}`)
      .then(() => {
        setActionMsg('Typology deleted')
        setTimeout(() => setActionMsg(''), 3000)
        fetchData()
      })
      .catch(() => setActionMsg('Delete failed'))
  }

  if (loading && !stats) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && !stats) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const statCards = [
    { label: 'Total Typologies', value: stats?.total_typologies ?? 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Scenarios', value: stats?.active_scenarios ?? 0, icon: Shield, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Rules', value: stats?.total_rules ?? 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Detections (30d)', value: stats?.detections_30d ?? 0, icon: Activity, color: 'text-red-600', bg: 'bg-red-50' },
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
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(s.value)}</p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + new button */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={openCreate}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> New Typology
        </button>
      </div>

      {actionMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')}><X size={14} /></button>
        </div>
      )}

      {/* Typology cards grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">Loading...</div>
      ) : typologies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">No typologies found</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {typologies.map((typ, idx) => (
            <div key={typ.id || idx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm">{typ.name || 'Unnamed Typology'}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      text={typ.category || 'unknown'}
                      colors={categoryBadgeColors[typ.category?.toLowerCase()] || 'bg-gray-100 text-gray-800'}
                    />
                    {typ.subcategory && (
                      <Badge text={typ.subcategory} colors="bg-slate-100 text-slate-600" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    text={typ.risk || typ.risk_level || 'medium'}
                    colors={riskBadgeColors[(typ.risk || typ.risk_level || '').toLowerCase()] || 'bg-gray-100 text-gray-800'}
                  />
                  <button
                    onClick={() => openEdit(typ)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit typology"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteTypology(typ.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete typology"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{typ.description || 'No description available'}</p>

              {/* FATF Reference */}
              {typ.fatf_reference && (
                <p className="text-xs text-slate-400 mt-2">FATF: {typ.fatf_reference}</p>
              )}

              {/* Indicators */}
              {(typ.indicators || []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Indicators:</p>
                  <ul className="space-y-1">
                    {typ.indicators.slice(0, 5).map((ind: string, i: number) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400 mt-0.5">&#8226;</span>
                        <span>{ind}</span>
                      </li>
                    ))}
                    {typ.indicators.length > 5 && (
                      <li className="text-xs text-slate-400">+{typ.indicators.length - 5} more...</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} />
                    {typ.rules_count ?? typ.rule_count ?? 0} rules
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity size={12} />
                    {typ.detections_30d ?? typ.detection_count ?? 0} detections (30d)
                  </span>
                </div>
                <Badge
                  text={typ.status === 'active' ? 'Active' : 'Inactive'}
                  colors={
                    typ.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-500'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Typology Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Typology' : 'New Typology'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. UPI Collect Request Fraud"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="Fraud">Fraud</option>
                    <option value="cyber_fraud">Cyber Fraud</option>
                    <option value="ai_fraud">AI Fraud</option>
                    <option value="internal_fraud">Internal Fraud</option>
                    <option value="AML">AML</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={form.subcategory}
                    onChange={e => setForm({ ...form, subcategory: e.target.value })}
                    placeholder="e.g. Digital Payment"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Risk Level</label>
                  <select
                    value={form.risk}
                    onChange={e => setForm({ ...form, risk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the typology and how it works..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">FATF Reference</label>
                  <input
                    type="text"
                    value={form.fatf_reference}
                    onChange={e => setForm({ ...form, fatf_reference: e.target.value })}
                    placeholder="e.g. FATF Typology 2024"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Linked Rules Count</label>
                  <input
                    type="number"
                    min={0}
                    value={form.rules_count}
                    onChange={e => setForm({ ...form, rules_count: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Indicators (one per line)</label>
                <textarea
                  value={form.indicators}
                  onChange={e => setForm({ ...form, indicators: e.target.value })}
                  rows={4}
                  placeholder={"Multiple cash deposits below threshold\nDifferent branches same day\nNo business justification"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={saving || !form.name.trim() || !form.description.trim()}
                onClick={saveTypology}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
