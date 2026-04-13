import { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle, Download, Eye, X, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { formatNumber, formatINR, formatDate } from '../utils/formatters'

const CTR_FORMAT_SAMPLES = {
  rbi: `CURRENCY TRANSACTION REPORT (CTR)
================================================================
Filed with: Financial Intelligence Unit India (FIU-IND)
Reference:  RBI Master Direction on KYC — INR 10 lakh threshold
Generated:  12-Apr-2026 10:55 UTC

Report Number:    CTR-20260412-0042
Filing Status:    PENDING
Filed Date:       PENDING
Created:          12-Apr-2026 10:55 UTC

CUSTOMER DETAILS
================================================================
Customer Name:    Rajesh Mehta
Customer Number:  CIF-1001
PAN:              AAAPM5055K
Address:          Mumbai, Maharashtra, India

TRANSACTION DETAILS
================================================================
Amount:           INR 15,00,000.00
Threshold:        INR 10,00,000.00 (mandatory CTR threshold)
Reporting Window: 15 days from end of transaction month

Reported under RBI Master Direction on KYC and PMLA Section 12.
This is the canonical document submitted to FIU-IND for archival.
================================================================`,

  rma: `LARGE CURRENCY TRANSACTION REPORT (LCTR)
================================================================
Filed with: Financial Intelligence Unit - Bhutan (FIU-Bhutan)
Authority:  Royal Monetary Authority of Bhutan
Reference:  RMA AML/CFT Rules 2009 — Nu. 100,000 threshold
Generated:  12-Apr-2026 10:55 UTC

Report Number:    CTR-20260412-0042
Filing Status:    PENDING
Filed Date:       PENDING
Created:          12-Apr-2026 10:55 UTC

CUSTOMER IDENTIFICATION
================================================================
Customer Name:    Rajesh Mehta
CID Number:       CIF-1001
Customer Type:    Individual
Address:          Thimphu, Bhutan

TRANSACTION DETAILS
================================================================
Amount:           Nu. 937,500.00 (Ngultrum)
INR Equivalent:   INR 15,00,000.00
Reporting Threshold: Nu. 100,000.00 (mandatory LCTR threshold)
Reporting Window: 7 days from transaction date (RMA Rule 14)

Reported under RMA AML/CFT Rules 2009.
================================================================`,
}

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const statusBadgeColors: Record<string, string> = {
  on_track: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  filed: 'bg-green-100 text-green-800',
  auto_generated: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-amber-100 text-amber-800',
}

export default function ComplianceCTRPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [formatModal, setFormatModal] = useState<{ report: any } | null>(null)
  const [detailModal, setDetailModal] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ format: string } | null>(null)
  const [uploadModal, setUploadModal] = useState<{ report: any } | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/compliance/filings/ctr')
      .then(res => setReports(res.data?.items || []))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load CTR reports'))
      .finally(() => setLoading(false))
  }, [])

  const loadReportDetail = (report: any) => {
    setDetailLoading(true)
    api.get(`/compliance/filings/ctr/${report.id}`)
      .then(res => setDetailModal(res.data))
      .catch(() => alert('Failed to load report details'))
      .finally(() => setDetailLoading(false))
  }

  const performDownload = (report: any, format: string) => {
    setDownloading(report.id)
    api.get(`/compliance/filings/ctr/${report.id}/download?format=${format}`, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${report.report_number || report.id}-${format.toUpperCase()}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => alert('Failed to download report'))
      .finally(() => {
        setDownloading(null)
        setFormatModal(null)
      })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, format: string) => {
    const file = e.target.files?.[0]
    if (!file || !uploadModal) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      // Upload endpoint would be implemented in backend
      await api.post(`/compliance/filings/ctr/${uploadModal.report.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      alert('CTR document uploaded successfully')
      setUploadModal(null)
    } catch {
      alert('Failed to upload CTR document')
    } finally {
      setUploading(false)
    }
  }

  const downloadFiling = (report: any) => {
    setFormatModal({ report })
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading CTR reports...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">CTR Report Details</h2>
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
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-slate-500 font-medium">Amount (INR)</p>
                    <p className="text-slate-800 font-mono">{formatINR(detailModal.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Transaction Date</p>
                    <p className="text-slate-800">{formatDate(detailModal.transaction_date)}</p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-slate-500 font-medium">PAN</p>
                  <p className="text-slate-800 font-mono">{detailModal.pan || 'Not on file'}</p>
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
              <h2 className="text-lg font-semibold text-slate-800">
                CTR Format — {previewModal.format === 'rbi' ? 'RBI (India)' : 'RMA (Bhutan)'}
              </h2>
              <button onClick={() => setPreviewModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap overflow-y-auto max-h-96 text-slate-700">
              {CTR_FORMAT_SAMPLES[previewModal.format as keyof typeof CTR_FORMAT_SAMPLES]}
            </div>
            <div className="mt-4 space-y-2">
              {previewModal.format === 'rbi' && (
                <div className="text-xs text-slate-600 bg-blue-50 p-3 rounded">
                  <p className="font-medium text-blue-900 mb-1">India RBI Format</p>
                  <p>Filed with FIU-IND under RBI Master Direction. INR 10 lakh threshold. 15-day reporting window from month end.</p>
                </div>
              )}
              {previewModal.format === 'rma' && (
                <div className="text-xs text-slate-600 bg-purple-50 p-3 rounded">
                  <p className="font-medium text-purple-900 mb-1">Bhutan RMA Format</p>
                  <p>Filed with FIU-Bhutan under RMA AML/CFT Rules 2009. Nu. 100,000 threshold. 7-day reporting window (Rule 14).</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Format Selection Modal */}
      {formatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Select CTR Format</h2>
            <p className="text-sm text-slate-600 mb-4">
              CTR documents are available in RBI (India) and RMA (Bhutan) formats.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => performDownload(formatModal.report, 'rbi')}
                disabled={downloading === formatModal.report.id}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {downloading === formatModal.report.id ? 'Downloading...' : 'RBI Format (India)'}
              </button>
              <button
                onClick={() => performDownload(formatModal.report, 'rma')}
                disabled={downloading === formatModal.report.id}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {downloading === formatModal.report.id ? 'Downloading...' : 'RMA Format (Bhutan)'}
              </button>
              <button
                onClick={() => setFormatModal(null)}
                disabled={downloading === formatModal.report.id}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Upload CTR Document</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload PDF documents for {uploadModal.report.report_number}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">India RBI Format (PDF)</label>
                <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-400 bg-blue-50">
                  <div className="text-center">
                    <Upload size={20} className="mx-auto text-blue-600 mb-1" />
                    <span className="text-xs text-blue-700 font-medium">Choose PDF or drag here</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileUpload(e, 'rbi')}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
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
                    onChange={(e) => handleFileUpload(e, 'rma')}
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
          <h1 className="text-2xl font-bold text-slate-800">CTR Filing Management</h1>
          <p className="text-sm text-slate-500 mt-1">Currency Transaction Reports — India RBI & Bhutan RMA</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total: {reports.length}</p>
          <p className="text-2xl font-bold text-blue-600">{reports.filter(r => r.filing_status === 'filed').length} Filed</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Pending Reports</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{reports.filter(r => r.filing_status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Auto-Generated</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{reports.filter(r => r.filing_status === 'auto_generated').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Filed Reports</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{reports.filter(r => r.filing_status === 'filed').length}</p>
        </div>
      </div>

      {/* CTR Reports Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">CTR Reports</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Report#</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Customer</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Amount (INR)</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Filed Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any, i: number) => (
                <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{r.report_number}</td>
                  <td className="py-2.5 px-3 text-slate-700">{r.customer_name || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">{formatINR(r.transaction_amount)}</td>
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
                        onClick={() => setPreviewModal({ format: 'rbi' })}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100"
                      >
                        <FileText size={12} />
                        Formats
                      </button>
                      <button
                        onClick={() => setUploadModal({ report: r })}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                      >
                        <Upload size={12} />
                        Upload
                      </button>
                      <button
                        onClick={() => downloadFiling(r)}
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
            <div className="text-center py-12 text-slate-400">No CTR reports found</div>
          )}
        </div>
      </div>
    </div>
  )
}
