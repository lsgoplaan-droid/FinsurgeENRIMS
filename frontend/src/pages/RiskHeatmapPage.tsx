import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, AlertTriangle, Users, TrendingUp, ChevronRight, Shield, Briefcase, Loader2 } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatNumber, formatDate, priorityColors, statusColors } from '../utils/formatters'

// Simplified SVG paths for Indian states (for demo visualization)
const INDIA_STATES: Record<string, { cx: number; cy: number; r: number; label: string }> = {
  'Maharashtra': { cx: 190, cy: 340, r: 22, label: 'MH' },
  'Delhi': { cx: 210, cy: 180, r: 14, label: 'DL' },
  'Karnataka': { cx: 195, cy: 400, r: 20, label: 'KA' },
  'Tamil Nadu': { cx: 215, cy: 450, r: 19, label: 'TN' },
  'Gujarat': { cx: 140, cy: 280, r: 20, label: 'GJ' },
  'Rajasthan': { cx: 155, cy: 210, r: 24, label: 'RJ' },
  'Uttar Pradesh': { cx: 250, cy: 210, r: 24, label: 'UP' },
  'West Bengal': { cx: 320, cy: 270, r: 18, label: 'WB' },
  'Kerala': { cx: 195, cy: 480, r: 14, label: 'KL' },
  'Madhya Pradesh': { cx: 220, cy: 270, r: 23, label: 'MP' },
  'Punjab': { cx: 185, cy: 150, r: 14, label: 'PB' },
  'Haryana': { cx: 200, cy: 170, r: 12, label: 'HR' },
  'Bihar': { cx: 310, cy: 235, r: 16, label: 'BR' },
  'Telangana': { cx: 225, cy: 370, r: 17, label: 'TS' },
  'Andhra Pradesh': { cx: 240, cy: 400, r: 18, label: 'AP' },
  'Odisha': { cx: 290, cy: 310, r: 17, label: 'OD' },
  'Jharkhand': { cx: 305, cy: 260, r: 14, label: 'JH' },
  'Assam': { cx: 380, cy: 210, r: 14, label: 'AS' },
  'Chhattisgarh': { cx: 260, cy: 300, r: 16, label: 'CG' },
  'Uttarakhand': { cx: 230, cy: 155, r: 12, label: 'UK' },
  'Goa': { cx: 170, cy: 390, r: 8, label: 'GA' },
  'Himachal Pradesh': { cx: 210, cy: 135, r: 12, label: 'HP' },
  'Jammu & Kashmir': { cx: 195, cy: 100, r: 16, label: 'JK' },
}

function getRiskColor(avgRisk: number): string {
  if (avgRisk >= 70) return '#ef4444'
  if (avgRisk >= 50) return '#f97316'
  if (avgRisk >= 30) return '#f59e0b'
  return '#22c55e'
}

function getRiskGlow(avgRisk: number): string {
  if (avgRisk >= 70) return '0 0 12px rgba(239,68,68,0.5)'
  if (avgRisk >= 50) return '0 0 10px rgba(249,115,22,0.4)'
  return 'none'
}

export default function RiskHeatmapPage() {
  const [geoRisk, setGeoRisk] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<any>(null)
  const [hoveredState, setHoveredState] = useState<string | null>(null)
  const [stateCases, setStateCases] = useState<any[]>([])
  const [casesLoading, setCasesLoading] = useState(false)

  useEffect(() => {
    api.get('/dashboard/geo-risk')
      .then(res => setGeoRisk(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectState = (state: any | null) => {
    setSelectedState(state)
    setStateCases([])
    if (state) {
      setCasesLoading(true)
      // Fetch ALL customers in this state (server-side filter, not name-search), then their cases
      // Use dedicated drill-down endpoint for data consistency with heatmap counts
      api.get(`/dashboard/geo-risk/${encodeURIComponent(state.state)}/customers`, { params: { page_size: 100 } })
        .then(res => {
          const stateCustomers = res.data?.items || []
          const customerIds = stateCustomers.map((c: any) => c.id)
          if (customerIds.length === 0) {
            setStateCases([])
            return
          }
          // Fetch cases for each customer in parallel — this matches the heatmap count exactly
          return Promise.all(
            customerIds.map((cid: string) =>
              api.get('/cases', { params: { customer_id: cid, page_size: 20 } })
                .then(r => r.data?.items || [])
                .catch(() => [])
            )
          ).then(results => {
            const flat = results.flat()
            setStateCases(flat)
          })
        })
        .catch(() => {})
        .finally(() => setCasesLoading(false))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const states = geoRisk?.states || []
  const stateMap = new Map<string, any>(states.map((s: any) => [s.state, s]))

  const topRiskStates = [...states].sort((a: any, b: any) => b.avg_risk - a.avg_risk).slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Geographic Risk Heatmap</h1>
          <p className="text-xs text-slate-500">India state-level risk concentration — click any state for details</p>
        </div>
        {geoRisk?.summary?.hotspot && (
          <span className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs text-red-700 font-medium animate-pulse">
            <AlertTriangle size={14} />
            Hotspot: {geoRisk.summary.hotspot}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'States Monitored', value: geoRisk?.summary?.total_states || 0, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Customers', value: formatNumber(geoRisk?.summary?.total_customers || 0), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'High Risk', value: formatNumber(geoRisk?.summary?.total_high_risk || 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Open Alerts', value: formatNumber(geoRisk?.summary?.total_open_alerts || 0), icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Main content: Map + Detail panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: Interactive India Map */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">India Risk Map</h3>
          <div className="relative flex justify-center">
            <svg viewBox="60 60 380 480" className="w-full max-w-lg" style={{ maxHeight: 520 }}>
              {/* India outline (simplified) */}
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f0f9ff" />
                  <stop offset="100%" stopColor="#e0f2fe" />
                </radialGradient>
              </defs>

              {/* Background shape */}
              <ellipse cx="230" cy="290" rx="160" ry="230" fill="url(#bgGrad)" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.3" />

              {/* State circles */}
              {Object.entries(INDIA_STATES).map(([name, pos]) => {
                const data = stateMap.get(name)
                const avgRisk = data?.avg_risk || 0
                const isSelected = selectedState?.state === name
                const isHovered = hoveredState === name
                const color = data ? getRiskColor(avgRisk) : '#e2e8f0'
                const scale = isSelected ? 1.2 : isHovered ? 1.1 : 1

                return (
                  <g key={name}>
                    {/* Pulse ring for high risk */}
                    {avgRisk >= 60 && (
                      <circle
                        cx={pos.cx} cy={pos.cy} r={pos.r + 4}
                        fill="none" stroke={color} strokeWidth="1.5" opacity="0.3"
                      >
                        <animate attributeName="r" from={pos.r + 2} to={pos.r + 10} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={pos.cx} cy={pos.cy} r={pos.r * scale}
                      fill={color}
                      stroke={isSelected ? '#1e40af' : '#fff'}
                      strokeWidth={isSelected ? 3 : 1.5}
                      opacity={data ? (isHovered || isSelected ? 1 : 0.85) : 0.25}
                      style={{ cursor: data ? 'pointer' : 'default', filter: isSelected ? 'url(#glow)' : 'none', transition: 'all 0.2s' }}
                      onClick={() => data && selectState(isSelected ? null : data)}
                      onMouseEnter={() => data && setHoveredState(name)}
                      onMouseLeave={() => setHoveredState(null)}
                    />
                    <text
                      x={pos.cx} y={pos.cy + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#fff" fontSize={pos.r > 15 ? 10 : 8} fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      {pos.label}
                    </text>
                    {/* Risk score badge */}
                    {data && avgRisk >= 40 && (
                      <text
                        x={pos.cx} y={pos.cy + pos.r + 12}
                        textAnchor="middle" fill={color} fontSize="9" fontWeight="bold"
                        style={{ pointerEvents: 'none' }}
                      >
                        {avgRisk}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Hover tooltip */}
            {hoveredState && !selectedState && stateMap.get(hoveredState) && (() => {
              const hd = stateMap.get(hoveredState)!
              return (
                <div className="absolute top-4 right-4 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[180px] z-10">
                  <p className="text-sm font-bold text-slate-800">{hoveredState}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                    <p>Customers: <span className="font-medium">{hd.customers}</span></p>
                    <p>Avg Risk: <span className="font-bold" style={{ color: getRiskColor(hd.avg_risk) }}>{hd.avg_risk}</span></p>
                    <p>High Risk: <span className="text-red-600 font-medium">{hd.high_risk_count}</span></p>
                    <p>Open Alerts: <span className="text-amber-600 font-medium">{hd.open_alerts}</span></p>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
            {[
              { label: 'Low (< 30)', color: '#22c55e' },
              { label: 'Medium (30-50)', color: '#f59e0b' },
              { label: 'High (50-70)', color: '#f97316' },
              { label: 'Critical (70+)', color: '#ef4444' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div className="space-y-4">
          {/* Selected state detail */}
          {selectedState ? (
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-blue-900">{selectedState.state}</h3>
                <button onClick={() => selectState(null)} className="text-xs text-blue-600 hover:underline">Close</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Customers', formatNumber(selectedState.customers)],
                  ['Avg Risk Score', String(selectedState.avg_risk)],
                  ['High Risk', String(selectedState.high_risk_count)],
                  ['Open Alerts', String(selectedState.open_alerts)],
                  ['Txn Volume', formatINR(selectedState.transaction_volume)],
                  ['Flagged Amount', formatINR(selectedState.flagged_amount)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="bg-blue-50 rounded-lg p-2.5">
                    <p className="text-[10px] text-blue-600 font-medium">{label}</p>
                    <p className="text-sm font-bold text-blue-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Link
                  to={`/customers?state=${encodeURIComponent(selectedState.state)}`}
                  className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium hover:underline"
                >
                  View all {selectedState.customers} customers <ChevronRight size={12} />
                </Link>
                {selectedState.high_risk_count > 0 && (
                  <Link
                    to={`/customers?state=${encodeURIComponent(selectedState.state)}&risk_category=high`}
                    className="inline-flex items-center gap-1 text-xs text-red-700 font-medium hover:underline"
                  >
                    {selectedState.high_risk_count} high-risk only <ChevronRight size={12} />
                  </Link>
                )}
              </div>

              {/* Cases in this state */}
              <div className="mt-4 pt-3 border-t border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={14} className="text-blue-600" />
                  <h4 className="text-xs font-bold text-blue-900">Cases in {selectedState.state}</h4>
                </div>
                {casesLoading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    Loading cases...
                  </div>
                ) : stateCases.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No cases found in this state</p>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {stateCases.map((c: any) => (
                      <Link
                        key={c.id}
                        to={`/cases/${c.id}`}
                        className="block p-2 rounded-lg bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold text-blue-700">{c.case_number}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${priorityColors[c.priority] || 'bg-gray-100 text-gray-800'}`}>
                            {c.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-700 mt-0.5 truncate">{c.title || c.case_type?.replace(/_/g, ' ')}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">
                          <span>{c.customer_name}</span>
                          {c.total_suspicious_amount > 0 && <span className="text-red-600 font-medium">{formatINR(c.total_suspicious_amount)}</span>}
                          <span className={`px-1 py-0.5 rounded text-[8px] font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-800'}`}>
                            {(c.status || '').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-sm text-slate-500 text-center py-4">Click a state on the map to view details</p>
            </div>
          )}

          {/* Top 5 Risk States */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Top Risk States</h3>
            <div className="space-y-2.5">
              {topRiskStates.map((s: any, i: number) => {
                const color = getRiskColor(s.avg_risk)
                const pct = Math.min(s.avg_risk, 100)
                return (
                  <div
                    key={s.state}
                    className="cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-all"
                    onClick={() => selectState(s)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">
                        <span className="text-slate-400 mr-1.5">#{i + 1}</span>
                        {s.state}
                      </span>
                      <span className="text-xs font-bold" style={{ color }}>{s.avg_risk}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                      <span>{s.customers} customers</span>
                      <span className="text-red-500">{s.high_risk_count} high risk</span>
                      <span>{s.open_alerts} alerts</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* State comparison table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">All States</h3>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="py-1.5 font-medium">State</th>
                    <th className="py-1.5 font-medium text-right">Risk</th>
                    <th className="py-1.5 font-medium text-right">Cust.</th>
                    <th className="py-1.5 font-medium text-right">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((s: any) => (
                    <tr
                      key={s.state}
                      className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer"
                      onClick={() => selectState(s)}
                    >
                      <td className="py-1.5 font-medium text-slate-700">{s.state}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: getRiskColor(s.avg_risk) }}>{s.avg_risk}</td>
                      <td className="py-1.5 text-right text-slate-600">{s.customers}</td>
                      <td className="py-1.5 text-right text-slate-600">{s.open_alerts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
