import { useState, useEffect } from 'react'
import {
  Bell, Mail, MessageSquare, Smartphone, CheckCircle, XCircle,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Filter, ChevronDown,
  Send, AlertTriangle, Clock, Zap, Volume2
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

const channelIcons: Record<string, any> = {
  sms: Smartphone,
  email: Mail,
  in_app: Bell,
  whatsapp: MessageSquare,
}

const channelColors: Record<string, string> = {
  sms: 'text-green-600 bg-green-50',
  email: 'text-blue-600 bg-blue-50',
  in_app: 'text-amber-600 bg-amber-50',
  whatsapp: 'text-emerald-600 bg-emerald-50',
}

export default function NotificationRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [logStats, setLogStats] = useState<any>({})
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules')
  const [eventFilter, setEventFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [refData, setRefData] = useState<any>(null)
  const [formData, setFormData] = useState<any>({
    name: '', trigger_event: '', recipient_type: 'compliance_officer',
    channel_sms: false, channel_email: true, channel_in_app: true,
    severity: 'medium', message_template: '', cooldown_minutes: 0,
  })

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      api.get('/notification-rules/list'),
      api.get('/notification-rules/logs?limit=50'),
      api.get('/notification-rules/reference-data'),
    ])
      .then(([rulesRes, logsRes, refRes]) => {
        setRules(rulesRes.data?.rules || [])
        setSummary({ active: rulesRes.data?.active || 0, inactive: rulesRes.data?.inactive || 0, total: rulesRes.data?.total || 0, by_event: rulesRes.data?.by_event || {} })
        setLogs(logsRes.data?.logs || [])
        setLogStats(logsRes.data?.stats || {})
        setRefData(refRes.data)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load notification data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const toggleRule = (ruleId: string) => {
    api.post(`/notification-rules/${ruleId}/toggle`)
      .then(() => fetchData())
      .catch(() => {})
  }

  const deleteRule = (ruleId: string) => {
    api.delete(`/notification-rules/${ruleId}`)
      .then(() => fetchData())
      .catch(() => {})
  }

  const createRule = () => {
    api.post('/notification-rules/create', formData)
      .then(() => { setShowCreateModal(false); fetchData() })
      .catch(() => {})
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const filteredRules = eventFilter ? rules.filter(r => r.trigger_event === eventFilter) : rules

  const statCards = [
    { label: 'Active Rules', value: summary.active || 0, icon: Zap, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Sent (All Time)', value: logStats.total || 0, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Delivery Rate', value: `${logStats.delivery_rate || 0}%`, icon: CheckCircle, color: logStats.delivery_rate >= 90 ? 'text-green-600' : 'text-amber-600', bg: logStats.delivery_rate >= 90 ? 'bg-green-50' : 'bg-amber-50' },
    { label: 'Failed', value: logStats.failed || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
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
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>
                  {typeof s.value === 'number' ? formatNumber(s.value) : s.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['sms', 'email', 'in_app', 'whatsapp'].map(ch => {
          const Icon = channelIcons[ch]
          const count = logStats.by_channel?.[ch] || 0
          return (
            <div key={ch} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channelColors[ch]}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500 capitalize">{ch.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold text-slate-700">{formatNumber(count)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          {[
            { key: 'rules', label: `Rules (${summary.total || 0})` },
            { key: 'logs', label: `Delivery Logs (${logStats.total || 0})` },
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
        {activeTab === 'rules' && (
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 mb-1">
            <Plus size={14} /> Add Rule
          </button>
        )}
      </div>

      {/* Rules tab */}
      {activeTab === 'rules' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
            <Filter size={16} className="text-slate-400" />
            <div className="relative">
              <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
                <option value="">All Events</option>
                {refData?.trigger_events?.map((e: any) => (
                  <option key={e.code} value={e.code}>{e.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            {filteredRules.map(r => (
              <div key={r.id} className={`bg-white rounded-xl shadow-sm border p-4 ${r.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Volume2 size={16} className={r.is_active ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="font-medium text-slate-800">{r.name}</span>
                      <Badge text={r.severity} colors={severityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                      <Badge text={r.trigger_event} colors="bg-slate-100 text-slate-600" />
                    </div>
                    {r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-slate-400">
                        Recipients: <span className="text-slate-600 capitalize">{r.recipient_type?.replace(/_/g, ' ')}</span>
                        {r.recipient_roles && <span className="text-slate-500 ml-1">({r.recipient_roles})</span>}
                      </span>
                      <span className="text-xs text-slate-400">
                        Channels: {r.channels?.map((ch: string) => {
                          const Icon = channelIcons[ch]
                          return <span key={ch} className="inline-flex items-center gap-0.5 mx-1"><Icon size={12} /></span>
                        })}
                      </span>
                      {r.cooldown_minutes > 0 && <span className="text-xs text-slate-400"><Clock size={10} className="inline" /> {r.cooldown_minutes}m cooldown</span>}
                    </div>
                    {r.message_template && (
                      <p className="text-xs text-slate-400 mt-1 italic truncate max-w-xl">&ldquo;{r.message_template}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className="text-xs text-slate-400">{r.sent_24h} sent / 24h</span>
                    <button onClick={() => toggleRule(r.id)} className="p-1 rounded hover:bg-slate-100">
                      {r.is_active ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} className="text-slate-400" />}
                    </button>
                    <button onClick={() => deleteRule(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredRules.length === 0 && (
              <div className="text-center py-12 text-slate-400">No notification rules found</div>
            )}
          </div>
        </>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Message</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const Icon = channelIcons[l.channel] || Bell
                  return (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-xs text-slate-700 font-medium">{l.rule_name}</td>
                      <td className="py-2.5 px-3"><Badge text={l.trigger_event} colors="bg-slate-100 text-slate-600" /></td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${channelColors[l.channel] || 'text-slate-600 bg-slate-50'}`}>
                          <Icon size={12} /> {l.channel?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600">{l.recipient_name || '-'}</td>
                      <td className="py-2.5 px-3">
                        {l.status === 'delivered' || l.status === 'read' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> {l.status}</span>
                        ) : l.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle size={12} /> failed</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Clock size={12} /> {l.status}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 max-w-xs truncate">{l.message}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-400">{l.created_at?.split('T')[0]}</td>
                    </tr>
                  )
                })}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No notification logs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Create Notification Rule</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Name</label>
                <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Rule name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Trigger Event</label>
                <select value={formData.trigger_event} onChange={e => setFormData({ ...formData, trigger_event: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  <option value="">Select event</option>
                  {refData?.trigger_events?.map((e: any) => (
                    <option key={e.code} value={e.code}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Recipient Type</label>
                <select value={formData.recipient_type} onChange={e => setFormData({ ...formData, recipient_type: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  {refData?.recipient_types?.map((r: any) => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Channels</label>
                <div className="flex gap-4 mt-1">
                  {['sms', 'email', 'in_app', 'whatsapp'].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={formData[`channel_${ch}`]} onChange={e => setFormData({ ...formData, [`channel_${ch}`]: e.target.checked })} />
                      {ch.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Severity</label>
                <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg">
                  {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Message Template</label>
                <textarea value={formData.message_template} onChange={e => setFormData({ ...formData, message_template: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" rows={3} placeholder="Use {alert_number}, {customer_name}, {amount}, {priority}..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Cooldown (minutes)</label>
                <input type="number" value={formData.cooldown_minutes} onChange={e => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 0 })} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={createRule} disabled={!formData.name || !formData.trigger_event} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
