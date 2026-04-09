import { useState, useEffect } from 'react'
import { FileDown, FileText, Clock, Shield, AlertTriangle, Users, Briefcase, TrendingUp } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatNumber, formatDate } from '../utils/formatters'

export default function BoardReportPage() {
  const [executive, setExecutive] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    api.get('/dashboard/executive')
      .then(res => setExecutive(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = () => {
    setGenerating(true)
    const token = localStorage.getItem('token')
    fetch(`${api.defaults.baseURL}/reports/board-report`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `FinsurgeFRIMS_Board_Report_${new Date().toISOString().slice(0, 10)}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .finally(() => setGenerating(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const e = executive || {}
  const sla = e.sla_compliance || {}

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Board Report Generator</h1>
          <p className="text-xs text-slate-500">One-click branded PDF for CRO / Board presentations — live data</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={generating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg shadow-sm transition-colors font-medium text-sm"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileDown size={16} />
              Download Board Report PDF
            </>
          )}
        </button>
      </div>

      {/* Report preview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* Report header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-t-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">F</div>
            <div>
              <h2 className="text-xl font-bold">FinsurgeFRIMS</h2>
              <p className="text-sm text-slate-300">Board Risk Report — {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="h-0.5 bg-blue-600 rounded" />
        </div>

        {/* Section 1: Executive Summary KPIs */}
        <div className="p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-xs font-bold">1</span>
            Executive Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Open Alerts', value: formatNumber(e.total_alerts_today || 0), sub: 'Today', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Open Cases', value: formatNumber(e.open_cases || 0), sub: `SLA: ${sla.rate || 0}%`, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'High Risk Customers', value: formatNumber(e.high_risk_customers || 0), sub: 'Active', icon: Users, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Suspicious Txns', value: formatNumber(e.suspicious_transactions || 0), sub: 'Flagged', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center`}>
                    <s.icon className={s.color} size={14} />
                  </div>
                  <span className="text-xs text-slate-500">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Risk Distribution */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-xs font-bold">2</span>
            Portfolio Risk Distribution
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(e.risk_distribution || {}).map(([cat, count]) => {
              const color = cat === 'very_high' ? '#ef4444' : cat === 'high' ? '#f97316' : cat === 'medium' ? '#f59e0b' : '#22c55e'
              return (
                <div key={cat} className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                  <div className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
                    {count as number}
                  </div>
                  <p className="text-xs text-slate-600 capitalize">{cat.replace(/_/g, ' ')}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: Alerts by Priority */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-xs font-bold">3</span>
            Alert Overview
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {['critical', 'high', 'medium', 'low'].map(p => {
              const count = (e.alerts_by_priority || {})[p] || 0
              const color = p === 'critical' ? 'bg-red-100 text-red-800 border-red-200' : p === 'high' ? 'bg-amber-100 text-amber-800 border-amber-200' : p === 'medium' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'
              return (
                <div key={p} className={`rounded-lg p-3 border text-center ${color}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs font-medium capitalize">{p}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 4: Recent Alerts */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-xs font-bold">4</span>
            Recent Alerts
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="py-2 px-3 text-left font-medium">Alert#</th>
                  <th className="py-2 px-3 text-left font-medium">Priority</th>
                  <th className="py-2 px-3 text-left font-medium">Title</th>
                  <th className="py-2 px-3 text-left font-medium">Status</th>
                  <th className="py-2 px-3 text-left font-medium">Customer</th>
                </tr>
              </thead>
              <tbody>
                {(e.recent_alerts || []).slice(0, 8).map((a: any, i: number) => (
                  <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-2 px-3 font-mono">{a.alert_number}</td>
                    <td className="py-2 px-3 capitalize">{a.priority}</td>
                    <td className="py-2 px-3 text-slate-700 truncate max-w-[200px]">{a.title}</td>
                    <td className="py-2 px-3 capitalize">{(a.status || '').replace(/_/g, ' ')}</td>
                    <td className="py-2 px-3">{a.customer_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Top Risk Customers */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-xs font-bold">5</span>
            Top Risk Customers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="py-2 px-3 text-left font-medium">CIF</th>
                  <th className="py-2 px-3 text-left font-medium">Name</th>
                  <th className="py-2 px-3 text-left font-medium">Risk Score</th>
                  <th className="py-2 px-3 text-left font-medium">Category</th>
                  <th className="py-2 px-3 text-left font-medium">PEP</th>
                </tr>
              </thead>
              <tbody>
                {(e.top_risk_customers || []).slice(0, 8).map((c: any, i: number) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="py-2 px-3 font-mono">{c.customer_number}</td>
                    <td className="py-2 px-3 font-medium text-slate-700">{c.name}</td>
                    <td className="py-2 px-3">
                      <span className={`font-bold ${c.risk_score >= 70 ? 'text-red-600' : c.risk_score >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                        {c.risk_score}
                      </span>
                    </td>
                    <td className="py-2 px-3 capitalize">{(c.risk_category || '').replace(/_/g, ' ')}</td>
                    <td className="py-2 px-3">{c.pep_status ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-xl">
          <p className="text-[10px] text-slate-400 text-center">
            CONFIDENTIAL — FinsurgeFRIMS Board Risk Report — Generated {new Date().toLocaleString('en-IN')} — Do not distribute without CRO approval
          </p>
        </div>
      </div>

      {/* Report info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <FileText size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-medium mb-1">About Board Reports</p>
          <p>The PDF includes: Executive Summary KPIs, Portfolio Risk Distribution, Alert Overview with weekly trends, Top 10 Active Cases, Top 10 Risk Customers, and Regulatory Filing Status. All data is live from the database at generation time.</p>
        </div>
      </div>
    </div>
  )
}
