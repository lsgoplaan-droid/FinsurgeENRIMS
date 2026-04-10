import { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronLeft, ChevronRight, Search, Download } from 'lucide-react'
import api from '../config/api'
import { formatINR, formatDate, statusColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

type ReportTab = 'ctr' | 'sar'

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('ctr')
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  const downloadReport = (report: any) => {
    if (!report.id) {
      alert('This report has no document on file yet')
      return
    }
    setDownloading(report.id)
    api.get(`/compliance/filings/${tab}/${report.id}/download`, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${report.report_number || report.id}.txt`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Failed to download report'))
      .finally(() => setDownloading(null))
  }

  const fetchData = useCallback(() => {
    setLoading(true)
    setError('')
    const params: any = { page, page_size: 20 }
    if (search) params.search = search

    api.get(`/reports/${tab}`, { params })
      .then(res => {
        const d = res.data
        setReports(d.items || d.data || d.reports || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [tab, page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const switchTab = (t: ReportTab) => {
    setTab(t)
    setPage(1)
    setSearch('')
  }

  return (
    <div className="space-y-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchTab('ctr')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === 'ctr'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText size={15} /> CTR Reports
        </button>
        <button
          onClick={() => switchTab('sar')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
            tab === 'sar'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText size={15} /> SAR Reports
        </button>
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {tab === 'ctr' ? 'Currency Transaction Reports (CTR)' : 'Suspicious Activity Reports (SAR)'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tab === 'ctr'
                ? 'Reports for cash transactions exceeding regulatory thresholds'
                : 'Reports for transactions flagged as potentially suspicious'
              }
            </p>
          </div>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search reports..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Report#</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Filed Date</th>
                  {tab === 'sar' && <th className="text-left py-2.5 px-3 font-medium text-slate-600">Reason</th>}
                  {tab === 'ctr' && <th className="text-left py-2.5 px-3 font-medium text-slate-600">Transaction Date</th>}
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Document</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{r.report_number || r.id}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.customer_name || r.customer_id || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">{r.amount != null ? formatINR(r.amount) : '-'}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.status || '-'} colors={statusColors[r.status] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(r.filed_date || r.filing_date)}</td>
                    {tab === 'sar' && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs truncate max-w-[200px]">{r.reason || r.suspicious_activity_type || '-'}</td>
                    )}
                    {tab === 'ctr' && (
                      <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(r.transaction_date)}</td>
                    )}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => downloadReport(r)}
                        disabled={downloading === r.id || !r.id}
                        title={r.id ? 'Download report document' : 'Document not yet available'}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download size={12} />
                        {downloading === r.id ? 'Downloading...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={tab === 'sar' ? 7 : 7} className="py-12 text-center text-slate-400">No reports found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              if (p > totalPages) return null
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
