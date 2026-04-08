import { useState, useEffect } from 'react'
import { Users, Activity, FileText, Search, Shield, Database, Server, Clock } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, timeAgo } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

type Tab = 'users' | 'health' | 'audit'

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  compliance_officer: 'bg-purple-100 text-purple-800',
  analyst: 'bg-blue-100 text-blue-800',
  investigator: 'bg-amber-100 text-amber-800',
  auditor: 'bg-green-100 text-green-800',
  viewer: 'bg-slate-100 text-slate-800',
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [auditSearch, setAuditSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    if (tab === 'users') {
      api.get('/admin/users')
        .then(res => setUsers(res.data.items || res.data.data || res.data.users || res.data || []))
        .catch(err => setError(err.response?.data?.detail || 'Failed to load users'))
        .finally(() => setLoading(false))
    } else if (tab === 'health') {
      api.get('/admin/system-health')
        .then(res => setHealth(res.data))
        .catch(err => setError(err.response?.data?.detail || 'Failed to load system health'))
        .finally(() => setLoading(false))
    } else if (tab === 'audit') {
      const params: any = { page_size: 50 }
      if (auditSearch) params.search = auditSearch
      api.get('/admin/audit-log', { params })
        .then(res => setAuditLog(res.data.items || res.data.data || res.data.logs || res.data || []))
        .catch(err => setError(err.response?.data?.detail || 'Failed to load audit log'))
        .finally(() => setLoading(false))
    }
  }, [tab, auditSearch])

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'health', label: 'System Health', icon: Activity },
    { key: 'audit', label: 'Audit Log', icon: FileText },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">User</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Username</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Email</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Roles</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Department</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                            {(u.full_name || u.username || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700">{u.full_name || u.name || u.username}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{u.username}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs">{u.email || '-'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || [u.role]).filter(Boolean).map((role: string) => (
                            <Badge key={role} text={role} colors={roleColors[role] || 'bg-gray-100 text-gray-800'} />
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs capitalize">{(u.department || '-').replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          text={u.is_active !== false ? 'active' : 'inactive'}
                          colors={u.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-400">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* System Health tab */}
      {tab === 'health' && (
        <>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading...</div>
          ) : health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Database Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Database size={18} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Database</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(health.database || health.db || health).filter(([k]) => !['status', 'uptime', 'services', 'version'].includes(k)).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-medium text-slate-700">{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Status */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Server size={18} className="text-green-600" />
                  <h3 className="text-sm font-semibold text-slate-700">System Status</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-sm text-slate-500">Status</span>
                    <Badge text={health.status || 'healthy'} colors={health.status === 'healthy' || !health.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} />
                  </div>
                  {health.version && (
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-sm text-slate-500">Version</span>
                      <span className="text-sm font-mono text-slate-700">{health.version}</span>
                    </div>
                  )}
                  {health.uptime && (
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-sm text-slate-500">Uptime</span>
                      <span className="text-sm text-slate-700">{health.uptime}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Services */}
              {health.services && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield size={18} className="text-purple-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Services</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(health.services).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600 capitalize">{service.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${String(status) === 'healthy' || String(status) === 'up' || status === true ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-xs text-slate-500">{String(status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity counts if available */}
              {health.counts && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 col-span-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-amber-600" />
                    <h3 className="text-sm font-semibold text-slate-700">Entity Counts</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(health.counts).map(([entity, count]) => (
                      <div key={entity} className="text-center p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold text-slate-800">{(count as number).toLocaleString()}</p>
                        <p className="text-xs text-slate-500 capitalize mt-1">{entity.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* Audit Log tab */}
      {tab === 'audit' && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Search audit log..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Timestamp</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">User</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Action</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Resource</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">Details</th>
                      <th className="text-left py-2.5 px-3 font-medium text-slate-600">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((log, i) => (
                      <tr key={log.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDateTime(log.timestamp || log.created_at)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{log.user_name || log.username || log.user_id || '-'}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            text={log.action || '-'}
                            colors={
                              (log.action || '').includes('create') ? 'bg-green-100 text-green-800' :
                              (log.action || '').includes('delete') ? 'bg-red-100 text-red-800' :
                              (log.action || '').includes('update') ? 'bg-blue-100 text-blue-800' :
                              (log.action || '').includes('login') ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          />
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs capitalize">{(log.resource || log.entity_type || '-').replace(/_/g, ' ')}</td>
                        <td className="py-2.5 px-3 text-slate-500 text-xs truncate max-w-[250px]">{log.details || log.description || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{log.ip_address || log.ip || '-'}</td>
                      </tr>
                    ))}
                    {auditLog.length === 0 && (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-400">No audit log entries</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
