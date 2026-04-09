import { useState, useEffect } from 'react'
import {
  Shield, CheckCircle2, AlertTriangle, Download, Search, ChevronLeft, ChevronRight,
  Hash, Clock, User, Filter, BarChart3, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899', '#14b8a6']

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [pagination, setPagination] = useState<any>({ page: 1, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verification, setVerification] = useState<any>(null)
  const [tab, setTab] = useState<'log' | 'analytics'>('log')
  const [filters, setFilters] = useState({ action: '', resource_type: '' })

  const loadEntries = (page = 1) => {
    setLoading(true)
    const params: any = { page, per_page: 30 }
    if (filters.action) params.action = filters.action
    if (filters.resource_type) params.resource_type = filters.resource_type
    api.get('/audit-trail/entries', { params })
      .then(res => {
        setEntries(res.data.entries || [])
        setPagination(res.data.pagination || {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadStats = () => {
    api.get('/audit-trail/stats')
      .then(res => setStats(res.data))
      .catch(() => {})
  }

  useEffect(() => {
    loadEntries()
    loadStats()
  }, [])

  const handleVerify = () => {
    setVerifying(true)
    api.get('/audit-trail/verify')
      .then(res => setVerification(res.data))
      .catch(() => setVerification({ chain_intact: false, error: true }))
      .finally(() => setVerifying(false))
  }

  const handleExport = () => {
    const token = localStorage.getItem('token')
    fetch(`${api.defaults.baseURL}/audit-trail/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `AuditTrail_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const trendData = stats?.daily_trend || []
  const actionData = Object.entries(stats?.actions_breakdown || {}).slice(0, 8).map(([name, value]) => ({
    name: name.length > 20 ? name.slice(0, 20) + '...' : name,
    value: value as number,
  }))
  const resourceData = Object.entries(stats?.resource_types || {}).map(([name, value]) => ({
    name,
    value: value as number,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Audit Trail</h1>
          <p className="text-xs text-slate-500">Tamper-proof hash chain audit log with export — RBI compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
          >
            {verifying ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
            Verify Chain
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Verification result */}
      {verification && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          verification.chain_intact ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {verification.chain_intact ? (
            <CheckCircle2 className="text-green-600" size={20} />
          ) : (
            <AlertTriangle className="text-red-600" size={20} />
          )}
          <div>
            <p className={`text-sm font-bold ${verification.chain_intact ? 'text-green-800' : 'text-red-800'}`}>
              {verification.chain_intact ? 'Hash Chain Verified — No Tampering Detected' : 'Chain Integrity Issue Detected'}
            </p>
            <p className="text-xs text-slate-500">
              {verification.total_verified} entries verified at {new Date(verification.verified_at).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: formatNumber(stats?.total_entries || 0), icon: Hash, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Today', value: formatNumber(stats?.entries_today || 0), icon: Clock, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'This Week', value: formatNumber(stats?.entries_week || 0), icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'This Month', value: formatNumber(stats?.entries_month || 0), icon: User, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={s.color} size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
        {(['log', 'analytics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'log' ? 'Audit Log' : 'Analytics'}
          </button>
        ))}
      </div>

      {tab === 'analytics' ? (
        <div className="space-y-4">
          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">14-Day Activity Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Actions by Resource Type</h3>
              {resourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={resourceData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={45}
                      label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                      {resourceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-slate-400 text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Top users and actions */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Users (30 days)</h3>
              <div className="space-y-2">
                {(stats?.top_users || []).map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <span className="text-xs text-slate-700">{u.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((u.actions / (stats?.entries_month || 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-8 text-right">{u.actions}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Actions</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={actionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 3, 3, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Filter by action..."
              value={filters.action}
              onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-40"
            />
            <input
              type="text"
              placeholder="Filter by resource type..."
              value={filters.resource_type}
              onChange={e => setFilters(f => ({ ...f, resource_type: e.target.value }))}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-40"
            />
            <button
              onClick={() => loadEntries(1)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              <Search size={12} />
            </button>
          </div>

          {/* Entries table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="py-2.5 px-3 font-medium text-slate-600">Timestamp</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">User</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Action</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Resource</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">IP Address</th>
                    <th className="py-2.5 px-3 font-medium text-slate-600">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading...</td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">No audit entries found</td></tr>
                  ) : (
                    entries.map((e: any) => (
                      <tr key={e.id} className="border-t border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {e.created_at ? new Date(e.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700">{e.user_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">{e.action}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {e.resource_type && <span className="text-slate-400">{e.resource_type}/</span>}
                          {e.resource_id ? e.resource_id.slice(0, 8) : '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{e.ip_address || '-'}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono text-[9px] text-slate-400" title={e.hash}>
                            {e.hash ? e.hash.slice(0, 12) + '...' : '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.total_pages} ({formatNumber(pagination.total)} entries)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => loadEntries(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => loadEntries(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
