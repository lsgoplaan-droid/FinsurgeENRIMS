import { useState, useEffect } from 'react'
import { Plug, Zap, Clock, Upload, Send, CheckCircle, XCircle, Loader, RefreshCw, Activity, Database, Globe, CreditCard, Building2, Smartphone, Monitor, Landmark, Shield, FileText, Search } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, formatNumber } from '../utils/formatters'

const sourceIcons: Record<string, any> = {
  'cbs-finacle': Building2,
  'txn-switch': Zap,
  'card-mgmt': CreditCard,
  'swift-gw': Globe,
  'rtgs-neft': Landmark,
  'internet-banking': Monitor,
  'mobile-banking': Smartphone,
  'atm-switch': Database,
  'ofac-sdn': Shield,
  'un-sanctions': Shield,
  'pep-worldcheck': Search,
  'india-mha': Shield,
  'ckyc-registry': FileText,
  'fiu-ind': Send,
}

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  connected: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Connected' },
  synced: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Synced' },
  disconnected: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Disconnected' },
  error: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Error' },
  running: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Loader, label: 'Running' },
  completed: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Failed' },
}

const typeLabels: Record<string, { label: string; color: string }> = {
  real_time: { label: 'Real-Time', color: 'bg-emerald-100 text-emerald-800' },
  batch: { label: 'Batch Sync', color: 'bg-blue-100 text-blue-800' },
  outbound: { label: 'Outbound', color: 'bg-purple-100 text-purple-800' },
}

export default function IntegrationsPage() {
  const [sources, setSources] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sources' | 'batches'>('sources')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/integrations/sources'),
      api.get('/integrations/batches'),
      api.get('/integrations/stats'),
    ])
      .then(([srcRes, batchRes, statsRes]) => {
        setSources(srcRes.data)
        setBatches(batchRes.data)
        setStats(statsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>

  const filteredSources = filterType ? sources.filter(s => s.type === filterType) : sources
  const realTimeSources = sources.filter(s => s.type === 'real_time')
  const batchSources = sources.filter(s => s.type === 'batch')
  const outboundSources = sources.filter(s => s.type === 'outbound')

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Real-Time Sources', value: stats.real_time_connected, icon: Zap, color: 'text-emerald-600', sub: 'Connected' },
            { label: 'Batch Sources', value: stats.batch_synced, icon: Clock, color: 'text-blue-600', sub: 'Synced' },
            { label: 'Records Today', value: formatNumber(stats.total_records_today), icon: Database, color: 'text-indigo-600', sub: 'Ingested' },
            { label: 'Avg Latency', value: `${stats.avg_latency_ms}ms`, icon: Activity, color: 'text-amber-600', sub: 'Real-time' },
            { label: 'System Uptime', value: `${stats.overall_uptime}%`, icon: CheckCircle, color: 'text-green-600', sub: 'Last 30 days' },
            { label: 'Failed Jobs (24h)', value: stats.failed_jobs_24h, icon: XCircle, color: stats.failed_jobs_24h > 0 ? 'text-red-600' : 'text-green-600', sub: 'Batch imports' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
                <s.icon size={16} className={s.color} />
              </div>
              <div className="text-xl font-bold text-slate-800">{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0">
        {[
          { key: 'sources', label: 'Data Sources', icon: Plug, count: sources.length },
          { key: 'batches', label: 'Batch Jobs', icon: Clock, count: batches.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Sources Tab */}
      {tab === 'sources' && (
        <div className="space-y-4">
          {/* Filter pills */}
          <div className="flex gap-2">
            {[
              { key: '', label: `All Sources (${sources.length})` },
              { key: 'real_time', label: `Real-Time (${realTimeSources.length})` },
              { key: 'batch', label: `Batch (${batchSources.length})` },
              { key: 'outbound', label: `Outbound (${outboundSources.length})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterType === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Source Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredSources.map(src => {
              const Icon = sourceIcons[src.id] || Plug
              const st = statusConfig[src.status] || statusConfig.connected
              const StatusIcon = st.icon
              const typeInfo = typeLabels[src.type] || typeLabels.batch

              return (
                <div key={src.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Icon size={20} className="text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{src.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                          <span className="text-xs text-slate-400">{src.protocol}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                      <StatusIcon size={12} />
                      {st.label}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">{src.description}</p>

                  <div className="text-xs text-slate-400 mb-3 font-mono bg-slate-50 px-2 py-1 rounded">{src.host}</div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {(src.data_types || []).map((dt: string) => (
                      <span key={dt} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{dt.replace(/_/g, ' ')}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                    {src.type === 'real_time' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Records Today</div>
                          <div className="text-sm font-semibold text-slate-700">{formatNumber(src.records_today)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Avg Latency</div>
                          <div className="text-sm font-semibold text-slate-700">{src.avg_latency_ms}ms</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Uptime</div>
                          <div className="text-sm font-semibold text-green-600">{src.uptime_percent}%</div>
                        </div>
                      </>
                    )}
                    {src.type === 'batch' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Records Synced</div>
                          <div className="text-sm font-semibold text-slate-700">{formatNumber(src.records_synced)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Frequency</div>
                          <div className="text-sm font-medium text-slate-600">{src.sync_frequency}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Last Sync</div>
                          <div className="text-xs font-medium text-slate-600">{formatDateTime(src.last_sync)}</div>
                        </div>
                      </>
                    )}
                    {src.type === 'outbound' && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Filed MTD</div>
                          <div className="text-sm font-semibold text-slate-700">{src.reports_filed_mtd}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Frequency</div>
                          <div className="text-sm font-medium text-slate-600">{src.sync_frequency}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase">Last Filed</div>
                          <div className="text-xs font-medium text-slate-600">{formatDateTime(src.last_submission)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Batches Tab */}
      {tab === 'batches' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Job ID</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Job Name</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-4 font-medium text-slate-600">Started</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Duration</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Records</th>
                  <th className="text-right py-2.5 px-4 font-medium text-slate-600">Errors</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((job: any) => {
                  const st = statusConfig[job.status] || statusConfig.completed
                  const StatusIcon = st.icon
                  return (
                    <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{job.id}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-700">{job.name}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{job.category}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.color}`}>
                          <StatusIcon size={11} className={job.status === 'running' ? 'animate-spin' : ''} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(job.started_at)}</td>
                      <td className="py-2.5 px-4 text-right text-xs text-slate-600 font-mono">
                        {job.duration_seconds ? (
                          job.duration_seconds >= 60 ? `${Math.floor(job.duration_seconds / 60)}m ${job.duration_seconds % 60}s` : `${job.duration_seconds}s`
                        ) : (
                          <span className="text-amber-500">Running...</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">{formatNumber(job.records_processed)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">
                        <span className={job.records_failed > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>{job.records_failed}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
