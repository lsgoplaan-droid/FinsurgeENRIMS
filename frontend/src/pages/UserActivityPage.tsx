import { useState, useEffect } from 'react'
import { Users, AlertTriangle, Activity, Clock, Shield, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  const bg = intensity === 0 ? 'bg-slate-50'
    : intensity < 0.25 ? 'bg-blue-100'
    : intensity < 0.5 ? 'bg-blue-300'
    : intensity < 0.75 ? 'bg-blue-500'
    : 'bg-blue-700'
  const text = intensity >= 0.5 ? 'text-white' : 'text-slate-600'
  return (
    <div
      className={`w-7 h-7 rounded-sm flex items-center justify-center text-[8px] font-medium ${bg} ${text}`}
      title={`${value} actions`}
    >
      {value > 0 ? value : ''}
    </div>
  )
}

export default function UserActivityPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  useEffect(() => {
    api.get('/user-activity/summary')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return <div className="text-center text-slate-400 py-20">No activity data</div>

  const { users, heatmap, anomalies, summary } = data
  const maxHeatVal = Math.max(1, ...heatmap.flatMap((d: any) => d.hours))

  // Bar chart data: top 10 users by 7d activity
  const barData = users.slice(0, 10).map((u: any) => ({
    name: u.name.split(' ')[0],
    '7d Actions': u.actions_7d,
    'Today': u.actions_today,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">User Activity Analytics</h1>
        <p className="text-xs text-slate-500">Who did what, when — anomaly detection and access pattern monitoring</p>
      </div>

      {/* Anomaly banner */}
      {anomalies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800">{anomalies.length} Anomal{anomalies.length === 1 ? 'y' : 'ies'} Detected</span>
          </div>
          <div className="space-y-1">
            {anomalies.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                <span className="font-medium">{a.user}:</span>
                <span>{a.anomaly}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: summary.total_users, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active (7d)', value: summary.active_users_7d, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Actions (30d)', value: formatNumber(summary.total_actions_30d), icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Anomalies', value: summary.users_with_anomalies, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* User activity bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">User Activity (Top 10)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="7d Actions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Today" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity heatmap */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity Heatmap (Last 7 Days)</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex items-center gap-0.5 mb-1 ml-10">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="w-7 text-center text-[8px] text-slate-400">
                    {i % 3 === 0 ? `${i}h` : ''}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {heatmap.map((day: any) => (
                <div key={day.date} className="flex items-center gap-0.5 mb-0.5">
                  <span className="text-[9px] text-slate-500 w-10 text-right pr-1">{day.day}</span>
                  {day.hours.map((val: number, h: number) => (
                    <HeatmapCell key={h} value={val} max={maxHeatVal} />
                  ))}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10 text-[9px] text-slate-400">
                <span>Less</span>
                {['bg-slate-50', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'].map(c => (
                  <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="py-2.5 px-3 font-medium text-slate-600">User</th>
                <th className="py-2.5 px-3 font-medium text-slate-600">Roles</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">30d</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">7d</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Today</th>
                <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Records</th>
                <th className="py-2.5 px-3 font-medium text-slate-600">Last Action</th>
                <th className="py-2.5 px-3 font-medium text-slate-600">Top Actions</th>
                <th className="py-2.5 px-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr
                  key={u.id}
                  className={`border-t border-slate-50 hover:bg-slate-50 cursor-pointer ${u.anomalies.length > 0 ? 'bg-amber-50/30' : ''}`}
                  onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">
                        {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.name}</p>
                        <p className="text-[9px] text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.roles.map((r: string) => (
                      <span key={r} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] mr-0.5">{r}</span>
                    ))}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">{u.actions_30d}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-600">{u.actions_7d}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-green-600">{u.actions_today}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">{u.unique_resources}</td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    {u.last_action ? new Date(u.last_action).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-0.5">
                      {u.top_actions.slice(0, 3).map((a: any) => (
                        <span key={a.action} className="px-1 py-0.5 bg-blue-50 text-blue-700 rounded text-[8px]">{a.action} ({a.count})</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.anomalies.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[9px] font-medium">
                        <AlertTriangle size={8} /> Anomaly
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-[9px] font-medium">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected user detail */}
      {selectedUser && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-900">{selectedUser.name} — Activity Detail</h3>
            <button onClick={() => setSelectedUser(null)} className="text-xs text-blue-600 hover:underline">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Email', selectedUser.email],
              ['Roles', selectedUser.roles.join(', ')],
              ['Last IP', selectedUser.last_ip || 'Unknown'],
              ['Last Action', selectedUser.last_action_type || '-'],
              ['30d Actions', selectedUser.actions_30d],
              ['7d Actions', selectedUser.actions_7d],
              ['Today', selectedUser.actions_today],
              ['Records Accessed', selectedUser.unique_resources],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-white rounded-lg p-2.5">
                <p className="text-[10px] text-blue-600 font-medium">{label}</p>
                <p className="text-xs font-bold text-blue-900">{value}</p>
              </div>
            ))}
          </div>
          {selectedUser.anomalies.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-bold text-amber-800 mb-1">Anomalies:</p>
              {selectedUser.anomalies.map((a: string, i: number) => (
                <p key={i} className="text-xs text-amber-700">{a}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
