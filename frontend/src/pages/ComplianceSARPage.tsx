import { useState, useEffect } from 'react'
import { FileText, AlertTriangle, Users, Clock, Shield, CheckCircle, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { formatNumber, formatINR, formatDate } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const priorityBadgeColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const statusBadgeColors: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  filed: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
}

export default function ComplianceSARPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    api.get('/compliance/dashboard')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load compliance dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const downloadFiling = (f: any) => {
    if (!f.id) {
      alert('This filing has no document on file yet')
      return
    }
    setDownloading(f.id)
    const filingType = (f.type || f.report_type || 'CTR').toLowerCase()
    api.get(`/compliance/filings/${filingType}/${f.id}/download`, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${f.report_number || f.id}.txt`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Failed to download filing'))
      .finally(() => setDownloading(null))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const filingStatus = data?.filing_status || {}
  const metrics = data?.compliance_metrics || data?.metrics || {}
  const deadlines = data?.regulatory_deadlines || data?.deadlines || []
  const recentFilings = data?.recent_filings || data?.filings || []

  const filingCards = [
    { label: 'CTR Pending', value: filingStatus.ctr_pending ?? 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, href: '/filing-deadlines' },
    { label: 'CTR Filed', value: filingStatus.ctr_filed ?? 0, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, href: '/filing-deadlines' },
    { label: 'SAR Pending', value: filingStatus.sar_pending ?? 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, href: '/filing-deadlines' },
    { label: 'SAR Filed', value: filingStatus.sar_filed ?? 0, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, href: '/filing-deadlines' },
  ]

  const complianceCards = [
    { label: 'PEP Customers', value: metrics.pep_customers ?? 0, color: 'text-purple-600', bg: 'bg-purple-50', icon: Users, href: '/customers?search=PEP' },
    { label: 'Open Investigations', value: metrics.open_investigations ?? 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: Shield, href: '/cases?status=under_investigation' },
  ]

  return (
    <div className="space-y-6">
      {/* Filing status cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Filing Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filingCards.map(card => (
            <Link key={card.label} to={card.href} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>{formatNumber(card.value)}</p>
                </div>
                <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <card.icon className={card.color} size={22} />
                </div>
              </div>
              <p className="text-[10px] text-blue-500 mt-1 font-medium">View details &rarr;</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Compliance metrics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Compliance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {complianceCards.map(card => (
            <Link key={card.label} to={card.href} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>{formatNumber(card.value)}</p>
                </div>
                <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <card.icon className={card.color} size={22} />
                </div>
              </div>
              <p className="text-[10px] text-blue-500 mt-1 font-medium">View details &rarr;</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Regulatory deadlines table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Regulatory Deadlines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Owner</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Frequency</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Next Due</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Days Until Due</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priority</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d: any, i: number) => {
                const isOverdue = d.status === 'overdue' || (d.days_until_due != null && d.days_until_due < 0)
                const isDueSoon = d.status === 'due_soon' || (d.days_until_due != null && d.days_until_due >= 0 && d.days_until_due <= 7)
                const rowBg = isOverdue ? 'bg-red-500/10' : isDueSoon ? 'bg-amber-500/10' : ''

                return (
                  <tr key={d.id || i} className={`border-t border-slate-100 ${rowBg}`}>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{d.name || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{d.owner || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(d.frequency || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">{formatDate(d.next_due || d.due_date)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`font-mono text-xs ${
                        isOverdue ? 'text-red-600 font-semibold' :
                        isDueSoon ? 'text-amber-600 font-semibold' :
                        'text-slate-600'
                      }`}>
                        {d.days_until_due != null ? d.days_until_due : '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        text={d.priority || '-'}
                        colors={priorityBadgeColors[d.priority] || 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        text={d.status || '-'}
                        colors={statusBadgeColors[d.status] || 'bg-gray-100 text-gray-800'}
                      />
                    </td>
                  </tr>
                )
              })}
              {deadlines.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No regulatory deadlines</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent filings table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Filings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Report#</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Filed Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Document</th>
              </tr>
            </thead>
            <tbody>
              {recentFilings.map((f: any, i: number) => (
                <tr key={f.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <Badge
                      text={(f.type || f.report_type || 'CTR').toUpperCase()}
                      colors={
                        (f.type || f.report_type || '').toLowerCase() === 'sar'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{f.report_number || f.id || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-700">{f.customer_name || f.customer || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">{f.amount != null ? formatINR(f.amount) : '-'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(f.filed_date || f.filing_date)}</td>
                  <td className="py-2.5 px-3">
                    <Badge
                      text={f.status || '-'}
                      colors={statusBadgeColors[f.status] || 'bg-gray-100 text-gray-800'}
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => downloadFiling(f)}
                      disabled={downloading === f.id || !f.id}
                      title={f.id ? 'Download filed document' : 'Document not yet available'}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download size={12} />
                      {downloading === f.id ? 'Downloading...' : 'Download'}
                    </button>
                  </td>
                </tr>
              ))}
              {recentFilings.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No recent filings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
