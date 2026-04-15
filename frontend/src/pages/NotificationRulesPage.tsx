import { useState, useEffect } from 'react'
import {
  Bell, Mail, MessageSquare, Smartphone, CheckCircle, XCircle,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Filter, ChevronDown,
  Send, Clock, Zap, Volume2, X, Eye, EyeOff, Tag, DollarSign, ShieldAlert
} from 'lucide-react'
import api from '../config/api'
import { formatNumber, formatDateTime } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const channelIcons: Record<string, any> = {
  sms: Smartphone,
  email: Mail,
  in_app: Bell,
  whatsapp: MessageSquare,
}

const channelColors: Record<string, string> = {
  sms: 'text-green-700 bg-green-50 border-green-200',
  email: 'text-blue-700 bg-blue-50 border-blue-200',
  in_app: 'text-amber-700 bg-amber-50 border-amber-200',
  whatsapp: 'text-emerald-700 bg-emerald-50 border-emerald-200',
}

const categoryColors: Record<string, string> = {
  alert: 'bg-red-50 border-red-200 text-red-700',
  case: 'bg-blue-50 border-blue-200 text-blue-700',
  transaction: 'bg-amber-50 border-amber-200 text-amber-700',
  compliance: 'bg-purple-50 border-purple-200 text-purple-700',
  kyc: 'bg-teal-50 border-teal-200 text-teal-700',
  detection: 'bg-orange-50 border-orange-200 text-orange-700',
  law_enforcement: 'bg-slate-100 border-slate-200 text-slate-700',
  system: 'bg-gray-50 border-gray-200 text-gray-700',
}

const logStatusConfig: Record<string, { color: string; icon: any; label: string }> = {
  delivered: { color: 'text-green-600', icon: CheckCircle, label: 'Delivered' },
  read:      { color: 'text-green-700', icon: CheckCircle, label: 'Read' },
  sent:      { color: 'text-blue-600',  icon: Send,        label: 'Sent' },
  pending:   { color: 'text-amber-600', icon: Clock,       label: 'Pending' },
  failed:    { color: 'text-red-600',   icon: XCircle,     label: 'Failed' },
}

const EMPTY_FORM = {
  name: '', description: '', trigger_event: '', recipient_type: 'compliance_officer',
  recipient_roles: '', channel_sms: false, channel_email: true, channel_in_app: true,
  channel_whatsapp: false, severity: 'medium', message_template: '',
  cooldown_minutes: 0, max_per_day: 100, escalation_delay_minutes: 0,
  condition_priority: '', condition_alert_type: '', condition_amount_min: '', condition_risk_score_min: '',
}

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [logStats, setLogStats] = useState<any>({})
  const [summary, setSummary] = useState<any>({})
  const [refData, setRefData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules')
  const [eventFilter, setEventFilter] = useState('')
  const [logChannelFilter, setLogChannelFilter] = useState('')
  const [logStatusFilter, setLogStatusFilter] = useState('')

  // Create / Edit modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Template preview
  const [previewRuleId, setPreviewRuleId] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get('/notification-rules/list'),
      api.get('/notification-rules/logs?limit=100'),
      api.get('/notification-rules/reference-data'),
    ])
      .then(([rulesRes, logsRes, refRes]) => {
        setRules(rulesRes.data?.rules || [])
        setSummary({ active: rulesRes.data?.active || 0, inactive: rulesRes.data?.inactive || 0, total: rulesRes.data?.total || 0 })
        setLogs(logsRes.data?.logs || [])
        setLogStats(logsRes.data?.stats || {})
        setRefData(refRes.data)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM })
    setEditingId(null)
    setModal('create')
  }

  const openEdit = (r: any) => {
    setFormData({
      name: r.name || '',
      description: r.description || '',
      trigger_event: r.trigger_event || '',
      recipient_type: r.recipient_type || 'compliance_officer',
      recipient_roles: r.recipient_roles || '',
      channel_sms: r.channels?.includes('sms') || false,
      channel_email: r.channels?.includes('email') || false,
      channel_in_app: r.channels?.includes('in_app') || false,
      channel_whatsapp: r.channels?.includes('whatsapp') || false,
      severity: r.severity || 'medium',
      message_template: r.message_template || '',
      cooldown_minutes: r.cooldown_minutes || 0,
      max_per_day: r.max_per_day || 100,
      escalation_delay_minutes: r.escalation_delay_minutes || 0,
      condition_priority: r.condition_priority || '',
      condition_alert_type: r.condition_alert_type || '',
      condition_amount_min: r.condition_amount_min != null ? String(r.condition_amount_min / 100) : '',
      condition_risk_score_min: r.condition_risk_score_min != null ? String(r.condition_risk_score_min) : '',
    })
    setEditingId(r.id)
    setModal('edit')
  }

  const saveRule = async () => {
    setSaving(true)
    const payload = {
      ...formData,
      condition_amount_min: formData.condition_amount_min ? Math.round(parseFloat(formData.condition_amount_min) * 100) : null,
      condition_risk_score_min: formData.condition_risk_score_min ? parseInt(formData.condition_risk_score_min) : null,
      condition_priority: formData.condition_priority || null,
      condition_alert_type: formData.condition_alert_type || null,
    }
    try {
      if (modal === 'edit' && editingId) {
        await api.put(`/notification-rules/${editingId}`, payload)
      } else {
        await api.post('/notification-rules/create', payload)
      }
      setModal(null)
      fetchData()
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const toggleRule = (id: string) => api.post(`/notification-rules/${id}/toggle`).then(fetchData).catch(() => {})
  const deleteRule = (id: string) => {
    if (!confirm('Delete this notification rule?')) return
    api.delete(`/notification-rules/${id}`).then(fetchData).catch(() => {})
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  // Group rules by event category
  const eventMap = Object.fromEntries((refData?.trigger_events || []).map((e: any) => [e.code, e]))
  const grouped: Record<string, any[]> = {}
  const displayRules = eventFilter ? rules.filter(r => r.trigger_event === eventFilter) : rules
  displayRules.forEach(r => {
    const cat = eventMap[r.trigger_event]?.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(r)
  })

  const filteredLogs = logs.filter(l => {
    if (logChannelFilter && l.channel !== logChannelFilter) return false
    if (logStatusFilter && l.status !== logStatusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: summary.active || 0, icon: Zap, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Sent', value: logStats.total || 0, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Delivery Rate', value: `${logStats.delivery_rate || 0}%`, icon: CheckCircle, color: (logStats.delivery_rate || 0) >= 90 ? 'text-green-600' : 'text-amber-600', bg: (logStats.delivery_rate || 0) >= 90 ? 'bg-green-50' : 'bg-amber-50' },
          { label: 'Failed', value: logStats.failed || 0, icon: XCircle, color: (logStats.failed || 0) > 0 ? 'text-red-600' : 'text-slate-500', bg: (logStats.failed || 0) > 0 ? 'bg-red-50' : 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slateate-500 text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{typeof s.value === 'number' ? formatNumber(s.value) : s.value}</p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {['sms', 'email', 'in_app', 'whatsapp'].map(ch => {
          const Icon = channelIcons[ch]
          return (
            <div key={ch} className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3 cursor-pointer transition-all ${logChannelFilter === ch ? 'ring-2 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setLogChannelFilter(logChannelFilter === ch ? '' : ch)}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${channelColors[ch]}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 capitalize">{ch.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold text-slate-700">{formatNumber(logStats.by_channel?.[ch] || 0)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          {[
            { key: 'rules', label: `Rules (${summary.total || 0})` },
            { key: 'logs', label: `Delivery Logs (${logStats.total || 0})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'rules' && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 mb-1">
            <Plus size={14} /> Add Rule
          </button>
        )}
      </div>

      {/* ── Rules Tab ── */}
      {activeTab === 'rules' && (
        <div className="space-y-5">
          {/* Filter row */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
            <Filter size={15} className="text-slate-400" />
            <div className="relative">
              <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
                <option value="">All Events</option>
                {refData?.trigger_events?.map((e: any) => (
                  <option key={e.code} value={e.code}>{e.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {eventFilter && (
              <button onClick={() => setEventFilter('')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {/* Grouped rule cards */}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-16 text-slate-400">No notification rules found</div>
          )}
          {Object.entries(grouped).map(([category, catRules]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${categoryColors[category] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {category.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400">{catRules.length} rule{catRules.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {catRules.map(r => (
                  <div key={r.id}
                    className={`bg-white rounded-xl shadow-sm border p-4 transition-all ${r.is_active ? 'border-slate-200' : 'border-slate-100 opacity-55'}`}>
                    <div className="flex items-start gap-3">
                      {/* Left: icon + toggle */}
                      <div className="flex flex-col items-center gap-2 pt-0.5">
                        <Volume2 size={16} className={r.is_active ? 'text-blue-500' : 'text-slate-300'} />
                        <button onClick={() => toggleRule(r.id)} title={r.is_active ? 'Disable' : 'Enable'}>
                          {r.is_active
                            ? <ToggleRight size={22} className="text-green-500" />
                            : <ToggleLeft size={22} className="text-slate-300" />}
                        </button>
                      </div>

                      {/* Centre: content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{r.name}</span>
                          <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-700'} />
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {r.trigger_event}
                          </span>
                        </div>
                        {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}

                        {/* Channels row */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {(r.channels || []).map((ch: string) => {
                            const Icon = channelIcons[ch] || Bell
                            return (
                              <span key={ch}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${channelColors[ch] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                <Icon size={11} />{ch.replace(/_/g, ' ')}
                              </span>
                            )
                          })}
                          <span className="text-xs text-slate-400 ml-1">
                            → <span className="text-slate-600 capitalize">{r.recipient_type?.replace(/_/g, ' ')}</span>
                            {r.recipient_roles && <span className="text-slate-400 ml-1">({r.recipient_roles})</span>}
                          </span>
                        </div>

                        {/* Conditions row */}
                        {(r.condition_priority || r.condition_alert_type || r.condition_amount_min || r.condition_risk_score_min) && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">When:</span>
                            {r.condition_priority && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                <Tag size={10} /> Priority = {r.condition_priority}
                              </span>
                            )}
                            {r.condition_alert_type && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                                <ShieldAlert size={10} /> Type = {r.condition_alert_type}
                              </span>
                            )}
                            {r.condition_amount_min != null && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                <DollarSign size={10} /> Amount ≥ Nu. {(r.condition_amount_min / 100).toLocaleString()}
                              </span>
                            )}
                            {r.condition_risk_score_min != null && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                <ShieldAlert size={10} /> Risk Score ≥ {r.condition_risk_score_min}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Settings row */}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                          {r.cooldown_minutes > 0 && <span><Clock size={9} className="inline" /> {r.cooldown_minutes}m cooldown</span>}
                          {r.max_per_day < 100 && <span>Max {r.max_per_day}/day</span>}
                          <span>{r.sent_24h} sent today</span>
                        </div>

                        {/* Template preview */}
                        {r.message_template && (
                          <div className="mt-2">
                            <button onClick={() => setPreviewRuleId(previewRuleId === r.id ? null : r.id)}
                              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                              {previewRuleId === r.id ? <EyeOff size={11} /> : <Eye size={11} />}
                              {previewRuleId === r.id ? 'Hide template' : 'Show template'}
                            </button>
                            {previewRuleId === r.id && (
                              <div className="mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 font-mono italic">
                                {r.message_template}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(r)} title="Edit rule"
                          className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteRule(r.id)} title="Delete rule"
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Log filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
            <Filter size={15} className="text-slate-400" />
            <div className="relative">
              <select value={logChannelFilter} onChange={e => setLogChannelFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
                <option value="">All Channels</option>
                {['sms', 'email', 'in_app', 'whatsapp'].map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={logStatusFilter} onChange={e => setLogStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
                <option value="">All Statuses</option>
                {['delivered', 'read', 'sent', 'pending', 'failed'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <span className="text-xs text-slate-400 ml-auto">{filteredLogs.length} of {logs.length}</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Rule</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Event</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Channel</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Recipient</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600 max-w-xs">Message</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => {
                    const ChIcon = channelIcons[l.channel] || Bell
                    const st = logStatusConfig[l.status] || logStatusConfig.pending
                    const StIcon = st.icon
                    return (
                      <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-xs font-medium text-slate-700 max-w-[140px] truncate">{l.rule_name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{l.trigger_event?.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${channelColors[l.channel] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            <ChIcon size={11} />{l.channel?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">{l.recipient_name || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${st.color}`}>
                            <StIcon size={12} />{st.label}
                          </span>
                          {l.failure_reason && <p className="text-[10px] text-red-400 mt-0.5">{l.failure_reason}</p>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 max-w-xs truncate" title={l.message}>{l.message || '-'}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-400 whitespace-nowrap">{l.sent_at ? formatDateTime(l.sent_at) : l.created_at?.split('T')[0] || '-'}</td>
                      </tr>
                    )
                  })}
                  {filteredLogs.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No notification logs</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-slate-800">
                {modal === 'edit' ? 'Edit Notification Rule' : 'Create Notification Rule'}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rule Name *</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. Alert Critical — Notify CRO" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                  <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="When does this fire?" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger Event *</label>
                  <select value={formData.trigger_event} onChange={e => setFormData({ ...formData, trigger_event: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="">— select event —</option>
                    {refData?.trigger_events?.map((e: any) => (
                      <option key={e.code} value={e.code}>{e.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Severity</label>
                  <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Conditions (optional — narrow when this fires)</p>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Priority =</label>
                    <select value={formData.condition_priority} onChange={e => setFormData({ ...formData, condition_priority: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                      <option value="">Any</option>
                      {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Alert Type =</label>
                    <select value={formData.condition_alert_type} onChange={e => setFormData({ ...formData, condition_alert_type: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                      <option value="">Any</option>
                      {['aml', 'fraud', 'kyc', 'compliance'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Amount ≥ Nu.</label>
                    <input type="number" value={formData.condition_amount_min} onChange={e => setFormData({ ...formData, condition_amount_min: e.target.value })}
                      placeholder="e.g. 1000000"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Risk Score ≥</label>
                    <input type="number" min="0" max="100" value={formData.condition_risk_score_min} onChange={e => setFormData({ ...formData, condition_risk_score_min: e.target.value })}
                      placeholder="e.g. 70"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Recipient</label>
                  <select value={formData.recipient_type} onChange={e => setFormData({ ...formData, recipient_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {refData?.recipient_types?.map((r: any) => (
                      <option key={r.code} value={r.code}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Recipient Roles (comma-sep)</label>
                  <input value={formData.recipient_roles} onChange={e => setFormData({ ...formData, recipient_roles: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. analyst, compliance_officer" />
                </div>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Delivery Channels</label>
                <div className="flex gap-4 flex-wrap">
                  {['sms', 'email', 'in_app', 'whatsapp'].map(ch => {
                    const Icon = channelIcons[ch]
                    const checked = formData[`channel_${ch}`]
                    return (
                      <label key={ch}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${checked ? channelColors[ch] : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}>
                        <input type="checkbox" className="sr-only" checked={checked}
                          onChange={e => setFormData({ ...formData, [`channel_${ch}`]: e.target.checked })} />
                        <Icon size={14} />
                        <span className="text-xs font-medium capitalize">{ch.replace(/_/g, ' ')}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Message template */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Message Template</label>
                <textarea value={formData.message_template} onChange={e => setFormData({ ...formData, message_template: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  rows={3} placeholder="Use {alert_number}, {customer_name}, {amount}, {priority}, {case_number}..." />
                <p className="text-[10px] text-slate-400 mt-1">Variables: &#123;alert_number&#125; &#123;customer_name&#125; &#123;amount&#125; &#123;priority&#125; &#123;case_number&#125; &#123;rule_name&#125;</p>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cooldown (min)</label>
                  <input type="number" min="0" value={formData.cooldown_minutes}
                    onChange={e => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Max per Day</label>
                  <input type="number" min="1" value={formData.max_per_day}
                    onChange={e => setFormData({ ...formData, max_per_day: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Escalation Delay (min)</label>
                  <input type="number" min="0" value={formData.escalation_delay_minutes}
                    onChange={e => setFormData({ ...formData, escalation_delay_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveRule} disabled={saving || !formData.name || !formData.trigger_event}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : modal === 'edit' ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
