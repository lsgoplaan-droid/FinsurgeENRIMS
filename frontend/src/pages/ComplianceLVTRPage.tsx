import { useState, useEffect } from 'react'
import { FileText, CheckCircle, Download, Eye, X, Upload } from 'lucide-react'
import api from '../config/api'
import { formatNumber, formatDate } from '../utils/formatters'

const LVTR_FORMAT_SAMPLE = `LARGE VALUE TRANSACTION REPORT (LVTR)
================================================================
Filed with: Financial Intelligence Unit - Bhutan (FIU-Bhutan)
Reference:  RMA AML/CFT Rules 2009, Rule 14 — Nu. 100,000
Generated:  12-Apr-2026 10:55 UTC

Report Number:    LVTR-20260412-0008
Filing Status:    FILED
Filed Date:       12-Apr-2026
Created:          12-Apr-2026 10:55 UTC

TRANSACTION DETAILS
================================================================
Customer Name:    Ananya Sharma
CID Number:       CIF-1010
Transaction Type: Cash Deposit
Amount:           Nu. 250,000.00 (INR 4,00,000.00)
Reporting Threshold: Nu. 100,000.00 (7-day filing window)
Transaction Date: 10-Apr-2026

COMPLIANCE
================================================================
Threshold Exceeded: YES
Filing Deadline:  17-Apr-2026
Status:           ON TRACK

Reported under RMA AML/CFT Rules 2009, Rule 14.
================================================================`

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const statusBadgeColors: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  auto_generated: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-amber-100 text-amber-800',
  filed: 'bg-green-100 text-green-800',
}

export default function ComplianceLVTRPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [detailModal, setDetailModal] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [previewModal, setPreviewModal] = useState<boolean>(false)
  const [uploadModal, setUploadModal] = useState<{ report: any } | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/compliance/lvtr')
      .then(res => setReports(res.data?.items || []))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load LVTR reports'))
      .finally(() => setLoading(false))
  }, [])

  const loadReportDetail = (report: any) => {
    setDetailLoading(true)
    api.get(`/compliance/filings/lvtr/${report.id}`)
      .then(res => setDetailModal(res.data))
      .catch(() => alert('Failed to load report details'))
      .finally(() => setDetailLoading(false))
  }

  const performDownload = (report: any) => {
    setDownloading(report.id)
    api.get(`/compliance/filings/lvtr/${report.id}/download?format=rma`, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${report.report_number || report.id}-RMA.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Failed to download report'))
      .finally(() => setDownloading(null))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadModal) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post(`/compliance/filings/lvtr/${uploadModal.report.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      alert('LVTR document uploaded successfully')
      setUploadModal(null)
    } catch {
      alert('Failed to upload LVTR document')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading LVTR reports...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">LVTR Report Details</h2>
              <button onClick={() => setDetailModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            {detailLoading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 font-medium">Report #</p>
                    <p className="text-slate-800 font-mono">{detailModal.report_number}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Status</p>
                    <p className="text-slate-800 capitalize">{detailModal.filing_status}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Customer</p>
                    <p className="text-slate-800">{detailModal.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Customer ID</p>
                    <p className="text-slate-800 font-mono">{detailModal.customer_number}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-slate-500 font-medium">Amount (Nu.)</p>
                    <p className="text-slate-800 font-mono">Nu. {(detailModal.amount_nu || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Amount (INR)</p>
                    <p className="text-slate-800 font-mono">INR {((detailModal.amount || 0) / 100).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Type</p>
                    <p className="text-slate-800 capitalize">{detailModal.transaction_type}</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-slate-500 font-medium">Transaction Date</p>
                  <p className="text-slate-800">{formatDate(detailModal.transaction_date)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Format Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">LVTR Format — RMA (Bhutan)</h2>
              <button onClick={() => setPreviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap overflow-y-auto max-h-96 text-slate-700">
              {LVTR_FORMAT_SAMPLE}
            </div>
            <div className="mt-4">
              <div className="text-xs text-slate-600 bg-purple-50 p-3 rounded">
                <p className="font-medium text-purple-900 mb-1">Bhutan RMA Format</p>
                <p>Filed with FIU-Bhutan under RMA AML/CFT Rules 2009, Rule 14. Nu. 100,000+ threshold. 7-day filing window. All amounts in Nu. with INR equivalent.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Upload LVTR Document</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload PDF document for {uploadModal.report.report_number}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bhutan RMA Format (PDF)</label>
                <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:border-purple-400 bg-purple-50">
                  <div className="text-center">
                    <Upload size={20} className="mx-auto text-purple-600 mb-1" />
                    <span className="text-xs text-purple-700 font-medium">Choose PDF or drag here</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
              <button
                onClick={() => setUploadModal(null)}
                disabled={uploading}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">LVTR Filing Management</h1>
          <p className="text-sm text-slate-500 mt-1">Large Value Transaction Reports — Bhutan RMA Rule 14</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total: {reports.length}</p>
          <p className="text-2xl font-bold text-green-600">{reports.filter(r => r.filing_status === 'filed').length} Filed</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Auto-Generated</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{reports.filter(r => r.filing_status === 'auto_generated').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Pending Review</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{reports.filter(r => r.filing_status === 'pending_review').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Filed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{reports.filter(r => r.filing_status === 'filed').length}</p>
        </div>
      </div>

      {/* LVTR Reports Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">LVTR Reports (RMA Rule 14 — Nu. 100,000+)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Report#</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount (Nu.)</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Filed Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any, i: number) => (
                <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-xs text-purple-600">{r.report_number}</td>
                  <td className="py-2.5 px-3 text-slate-700">{r.customer_name || '-'}</td>
                  <td className="py-2.5 px-3 text-slate-600 capitalize text-xs">{r.transaction_type}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">Nu. {(r.transaction_amount_nu || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDate(r.filed_at) || 'Pending'}</td>
                  <td className="py-2.5 px-3">
                    <Badge text={r.filing_status} colors={statusBadgeColors[r.filing_status] || 'bg-gray-100 text-gray-800'} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => loadReportDetail(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100"
                      >
                        <Eye size={12} />
                        Details
                      </button>
                      <button
                        onClick={() => setPreviewModal(true)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100"
                      >
                        <FileText size={12} />
                        Format
                      </button>
                      <button
                        onClick={() => setUploadModal({ report: r })}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                      >
                        <Upload size={12} />
                        Upload
                      </button>
                      <button
                        onClick={() => performDownload(r)}
                        disabled={downloading === r.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-40"
                      >
                        <Download size={12} />
                        {downloading === r.id ? '...' : 'Download'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reports.length === 0 && (
            <div className="text-center py-12 text-slate-400">No LVTR reports found</div>
          )}
        </div>
      </div>
    </div>
  )
}
