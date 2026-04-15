import { useState, useEffect } from 'react'
import { FileText, AlertTriangle, Users, Clock, Shield, CheckCircle, Download, Eye, X, Upload, Plus, Send, Trash2, Pencil, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { formatNumber, formatINR, formatDate } from '../utils/formatters'

const FORMAT_SAMPLES = {
  ctr_rbi: `CURRENCY TRANSACTION REPORT (CTR)
================================================================
Filed with: Financial Intelligence Unit India (FIU-IND)
Reference:  RBI Master Direction on KYC — Nu. 10 lakh threshold
Generated:  12-Apr-2026 10:55 UTC

Report Number:    CTR-20260412-0042
Filing Status:    PENDING
Filed Date:       PENDING
Created:          12-Apr-2026 10:55 UTC

CUSTOMER DETAILS
----------------------------------------------------------------
Customer Name:    Rajesh Mehta
Customer Number:  CIF-1001
PAN:              AAAPM5055K
Address:          Mumbai, Maharashtra, India

TRANSACTION DETAILS
----------------------------------------------------------------
Amount:           Nu. 15,00,000.00
Threshold:        Nu. 10,00,000.00 (mandatory CTR threshold)
Reporting Window: 15 days from end of transaction month

Reported under RBI Master Direction on KYC and PMLA Section 12.
This is the canonical document submitted to FIU-IND for archival.
================================================================`,

  ctr_rma: `LARGE CURRENCY TRANSACTION REPORT (LCTR)
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
----------------------------------------------------------------
Customer Name:    Rajesh Mehta
CID Number:       CIF-1001
Customer Type:    Individual
Address:          Thimphu, Bhutan

TRANSACTION DETAILS
================================================================
Amount:           Nu. 937,500.00 (Ngultrum)
Nu. equivalent:   Nu. 15,00,000.00
Reporting Threshold: Nu. 100,000.00 (mandatory LCTR threshold)
Reporting Window: 7 days from transaction date (RMA Rule 14)

Reported under RMA AML/CFT Rules 2009.
================================================================`,

  sar_rbi: `Suspicious Transaction Report (SAR)
================================================================
Filed with: Financial Intelligence Unit India (FIU-IND)
Reference:  RBI Master Direction, PMLA Section 12
Generated:  12-Apr-2026 10:55 UTC

Report Number:    SAR-20260412-0015
Filing Status:    FILED
Filed Date:       12-Apr-2026
Created:          12-Apr-2026 10:55 UTC

SUBJECT (CUSTOMER) DETAILS
================================================================
Customer Name:    Hassan Trading
Customer ID:      CIF-1003
Account Number:   ACC-1015
Activity Type:    Hawala-like patterns

SUSPICIOUS ACTIVITY INDICATORS
================================================================
Pattern Type:     Structuring (Multiple deposits below CTR threshold)
Risk Score:       8.5/10 (HIGH RISK)
Timeline:         3 weeks of activity
Related Parties:   4 linked customers with similar patterns

Reported under PMLA Section 12 to Financial Intelligence Unit.
================================================================`,

  sar_rma: `SUSPICIOUS TRANSACTION REPORT (STR)
================================================================
Filed with: Financial Intelligence Unit - Bhutan (FIU-Bhutan)
Reference:  RMA AML/CFT Rules 2009, Section 11 — 7-day filing
Generated:  12-Apr-2026 10:55 UTC

Report Number:    SAR-20260412-0015
Filing Status:    FILED
Filed Date:       12-Apr-2026
Created:          12-Apr-2026 10:55 UTC

SUBJECT (CUSTOMER) DETAILS
================================================================
Customer Name:    Hassan Trading
CID Number:       CIF-1003
Activity Type:    Hawala-like patterns

SUSPICIOUS ACTIVITY INDICATORS
================================================================
Pattern Type:     Structuring (Multiple deposits below threshold)
Risk Score:       8.5/10 (HIGH RISK)
Amount:           Nu. 500,000.00

Reported under RMA AML/CFT Rules 2009, Section 11.
================================================================`,

  lvtr: `LARGE VALUE TRANSACTION REPORT (LVTR)
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
================================================================`,

  fir_india: `FIRST INFORMATION REPORT (FIR)
================================================================
Jurisdiction:        Republic of India
Filed with:          Indian Police
Reference:           Indian Penal Code 1860

FIR Number:          FIR-2026-1005
Status:              FILED
Priority:            HIGH
Bank Case Number:    CASE-2026-156

REPORTED AGAINST (SUBJECT / CUSTOMER)
================================================================
Name:                Pradeep Kumar
Customer ID:         CIF-1025
PAN:                 AAAPK9876P
Address:             Delhi, Delhi, INDIA

POLICE STATION & OFFICER DETAILS
================================================================
Police Station:      Cyber Crime PS, BKC
District:            Mumbai
State:               Maharashtra
Investigating Officer: Inspector Rajesh Singh

OFFENSE DETAILS
================================================================
Offense Type:        Card Fraud
IPC / Legal Sections: IPC 420, 468, 471
Fraud Amount:        Nu. 8,50,000.00

FIR FILING TIMELINE
================================================================
Draft Created:       10-Apr-2026 14:30 UTC
Filed Date:          11-Apr-2026 09:15 UTC
Acknowledged Date:   11-Apr-2026

INVESTIGATION STATUS
================================================================
Charge Sheet Filed:  Not yet filed
Court Name:          -
Next Hearing Date:   Not scheduled

RECOVERY & ASSET FREEZING
================================================================
Fraud Amount:        Nu. 8,50,000.00
Amount Recovered:    Nu. 2,10,000.00
Recovery Rate:       24.7%
Assets Frozen:       YES

REGULATORY REPORTING
================================================================
RBI Fraud Reported:  YES - FMR-1 filed
Cyber Cell Report:   YES

Generated:           12-Apr-2026 10:55 UTC
================================================================`,

  fir_bhutan: `FIRST INFORMATION REPORT (FIR)
================================================================
Jurisdiction:        Kingdom of Bhutan
Filed with:          Royal Bhutan Police (RBP)
Reference:           Bhutan Penal Code 2004

FIR Number:          FIR-2026-1005
Status:              FILED
Priority:            HIGH
Bank Case Number:    CASE-2026-156

SUBJECT DETAILS
================================================================
Full Name:           Pradeep Kumar
CID Number:          CIF-1025
Address:             Thimphu, Bhutan

REPORTING INSTITUTION
================================================================
Institution:         FinsurgeFRIMS Demo Bank
Branch:              Main Branch, Thimphu

OFFENSE DETAILS (BHUTAN PENAL CODE 2004)
================================================================
BPC Section(s):      264 (Money Laundering) + MLPCA 2018
Fraud Amount:        Nu. 53,12,500.00 (INR 8,50,000.00)

FIR FILING TIMELINE
================================================================
Draft Created:       10-Apr-2026 14:30 UTC
Filed Date:          11-Apr-2026 09:15 UTC
Acknowledged Date:   11-Apr-2026

INVESTIGATION STATUS
================================================================
Charge Sheet Filed:  Not yet filed
Court Name:          -
Next Hearing Date:   Not scheduled

RECOVERY & ASSET FREEZING
================================================================
Fraud Amount:        Nu. 53,12,500.00
Amount Recovered:    Nu. 13,12,500.00
Recovery Rate:       24.7%
Assets Frozen:       YES

Generated:           12-Apr-2026 10:55 UTC
================================================================`,
}

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
  const [formatModal, setFormatModal] = useState<{ filing: any; type: string } | null>(null)
  const [detailModal, setDetailModal] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ format: string } | null>(null)
  const [uploadModal, setUploadModal] = useState<{ filing: any } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ customer_id: '', suspicious_activity_type: 'structuring', total_amount: '', date_range_start: '', date_range_end: '', narrative: '' })
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<{ filing: any } | null>(null)
  const [editForm, setEditForm] = useState({ filing_status: '', suspicious_activity_type: '', narrative: '', regulatory_reference: '' })
  const [editing, setEditing] = useState(false)
  const [actionsModal, setActionsModal] = useState<any>(null)

  const loadData = () => {
    api.get('/compliance/dashboard')
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load compliance dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreateSAR = async () => {
    if (!createForm.customer_id || !createForm.total_amount || !createForm.date_range_start || !createForm.date_range_end) {
      alert('Please fill in all required fields')
      return
    }
    setCreating(true)
    try {
      await api.post('/compliance/filings/sar', {
        customer_id: createForm.customer_id,
        suspicious_activity_type: createForm.suspicious_activity_type,
        total_amount: Math.round(parseFloat(createForm.total_amount) * 100),
        date_range_start: createForm.date_range_start,
        date_range_end: createForm.date_range_end,
        narrative: createForm.narrative || null,
      })
      setCreateModal(false)
      setCreateForm({ customer_id: '', suspicious_activity_type: 'structuring', total_amount: '', date_range_start: '', date_range_end: '', narrative: '' })
      loadData()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create SAR')
    } finally {
      setCreating(false)
    }
  }

  const handleSubmitSAR = async (f: any) => {
    if (!confirm(`Submit ${f.report_number} to FIU-IND? This cannot be undone.`)) return
    setSubmitting(f.id)
    try {
      await api.post(`/compliance/filings/sar/${f.id}/submit`)
      loadData()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to Submit STR')
    } finally {
      setSubmitting(null)
    }
  }

  const handleDeleteSAR = async (f: any) => {
    if (!confirm(`Delete ${f.report_number}? This action cannot be undone.`)) return
    setDeleting(f.id)
    try {
      await api.delete(`/compliance/filings/sar/${f.id}`)
      loadData()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to delete SAR')
    } finally {
      setDeleting(null)
    }
  }

  const openEdit = (filing: any) => {
    setEditForm({
      filing_status: filing.filing_status || filing.status || '',
      suspicious_activity_type: filing.suspicious_activity_type || filing.activity_type || '',
      narrative: filing.narrative || '',
      regulatory_reference: filing.regulatory_reference || '',
    })
    setEditModal({ filing })
  }

  const handleEditSAR = async () => {
    if (!editModal) return
    setEditing(true)
    try {
      await api.put(`/compliance/filings/sar/${editModal.filing.id}`, editForm)
      setEditModal(null)
      loadData()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to update SAR')
    } finally {
      setEditing(false)
    }
  }

  const loadFilingDetail = (f: any) => {
    setDetailLoading(true)
    const filingType = (f.type || f.report_type || 'CTR').toLowerCase()
    api.get(`/compliance/filings/${filingType}/${f.id}`)
      .then(res => {
        setDetailModal({ ...res.data, type: filingType, report_number: f.report_number })
      })
      .catch(() => alert('Failed to load filing details'))
      .finally(() => setDetailLoading(false))
  }

  const performDownload = (f: any, format?: string) => {
    if (!f.id) {
      alert('This filing has no document on file yet')
      return
    }
    setDownloading(f.id)
    const filingType = (f.type || f.report_type || 'CTR').toLowerCase()
    let url = `/compliance/filings/${filingType}/${f.id}/download`
    if (format) {
      url += `?format=${format}`
    }
    api.get(url, { responseType: 'blob' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const objUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objUrl
        link.download = `${f.report_number || f.id}-${(format || 'rbi').toUpperCase()}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(objUrl)
      })
      .catch(() => alert('Failed to download filing'))
      .finally(() => {
        setDownloading(null)
        setFormatModal(null)
      })
  }

  const downloadFiling = (f: any) => {
    // SAR supports format selection (RBI vs RMA)
    setFormatModal({ filing: f, type: 'STR' })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, format: string) => {
    const file = e.target.files?.[0]
    if (!file || !uploadModal) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post(`/compliance/filings/sar/${uploadModal.filing.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      alert('SAR document uploaded successfully')
      setUploadModal(null)
    } catch {
      alert('Failed to upload SAR document')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const filingStatus = data?.filing_status || {}
  const metrics = data?.compliance_metrics || data?.metrics || {}
  const deadlines = data?.regulatory_deadlines || data?.deadlines || []
  const recentFilings = data?.recent_filings || data?.filings || []

  const filingCards = [
    { label: "STR"Pending', value: filingStatus.sar_pending ?? 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, href: '/filing-deadlines?type=sar' },
    { label: 'STR filed', value: filingStatus.sar_filed ?? 0, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, href: '/filing-deadlines?type=sar' },
  ]

  const complianceCards = [
    { label: 'PEP Customers', value: metrics.pep_customers ?? 0, color: 'text-purple-600', bg: 'bg-purple-50', icon: Users, href: '/customers?search=PEP' },
    { label: 'Open Investigations', value: metrics.open_investigations ?? 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: Shield, href: '/cases?status=under_investigation' },
  ]

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{detailModal.type.toUpperCase()} Details</h2>
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
                {detailModal.type === 'ctr' && (
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
                )}
                {detailModal.type === 'STR' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-slate-500 font-medium">Amount (INR)</p>
                      <p className="text-slate-800 font-mono">{formatINR(detailModal.amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Activity Type</p>
                      <p className="text-slate-800 capitalize">{detailModal.suspicious_activity_type}</p>
                    </div>
                  </div>
                )}
                {detailModal.type === 'lvtr' && (
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-slate-500 font-medium">Amount (Nu.)</p>
                      <p className="text-slate-800 font-mono">Nu. {(detailModal.amount_nu || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Amount (INR)</p>
                      <p className="text-slate-800 font-mono">{formatINR(detailModal.amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">Type</p>
                      <p className="text-slate-800 capitalize">{detailModal.transaction_type}</p>
                    </div>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <p className="text-slate-500 font-medium">Created</p>
                  <p className="text-slate-800">{formatDate(detailModal.created_at)}</p>
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
                SAR — {previewModal.format === 'rbi' ? 'RBI (India)' : 'RMA (Bhutan)'}
              </h2>
              <button onClick={() => setPreviewModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap overflow-y-auto max-h-96 text-slate-700">
              {FORMAT_SAMPLES[`sar_${previewModal.format}` as keyof typeof FORMAT_SAMPLES]}
            </div>
            <div className="mt-4 space-y-2">
              {previewModal.format === 'rbi' && (
                <div className="text-xs text-slate-600 bg-blue-50 p-3 rounded">
                  <p className="font-medium text-blue-900 mb-1">India RBI Format</p>
                  <p>Filed with FIU-IND under PMLA Section 12. Principal Officer workflow. 7-day filing deadline.</p>
                </div>
              )}
              {previewModal.format === 'rma' && (
                <div className="text-xs text-slate-600 bg-purple-50 p-3 rounded">
                  <p className="font-medium text-purple-900 mb-1">Bhutan RMA Format</p>
                  <p>Filed with FIU-Bhutan under RMA AML/CFT Rules 2009, Section 11. 7-day filing deadline.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Upload SAR Document</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload PDF documents for {uploadModal.filing.report_number}
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

      {/* Create SAR Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Create New SAR</h2>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Customer ID (CIF / UUID)</label>
                <input type="text" placeholder="e.g. CIF-1001 or UUID" value={createForm.customer_id}
                  onChange={e => setCreateForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Activity Type</label>
                <select value={createForm.suspicious_activity_type}
                  onChange={e => setCreateForm(f => ({ ...f, suspicious_activity_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {['structuring', 'layering', 'money_laundering', 'fraud', 'terrorist_financing', 'wire_fraud', 'identity_theft', 'other'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Amount (INR)</label>
                <input type="number" placeholder="e.g. 5000000" value={createForm.total_amount}
                  onChange={e => setCreateForm(f => ({ ...f, total_amount: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date Range Start</label>
                  <input type="date" value={createForm.date_range_start}
                    onChange={e => setCreateForm(f => ({ ...f, date_range_start: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date Range End</label>
                  <input type="date" value={createForm.date_range_end}
                    onChange={e => setCreateForm(f => ({ ...f, date_range_end: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Narrative (optional)</label>
                <textarea rows={3} placeholder="Describe the suspicious activity..." value={createForm.narrative}
                  onChange={e => setCreateForm(f => ({ ...f, narrative: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreateSAR} disabled={creating}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {creating ? 'Creating...' : 'Create SAR'}
                </button>
                <button onClick={() => setCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit SAR Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Edit SAR — {editModal.filing.report_number}</h2>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={editForm.filing_status}
                  onChange={e => setEditForm(f => ({ ...f, filing_status: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="auto_generated">Auto Generated</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="amended">Amended</option>
                </select>
                <p className="text-xs text-slate-400 mt-0.5">Use "Submit" button to mark as Filed</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Activity Type</label>
                <select value={editForm.suspicious_activity_type}
                  onChange={e => setEditForm(f => ({ ...f, suspicious_activity_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {['structuring', 'layering', 'money_laundering', 'fraud', 'terrorist_financing', 'wire_fraud', 'identity_theft', 'other'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Narrative</label>
                <textarea rows={3} placeholder="Describe the suspicious activity..." value={editForm.narrative}
                  onChange={e => setEditForm(f => ({ ...f, narrative: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Regulatory Reference</label>
                <input type="text" placeholder="e.g. PMLA Section 12" value={editForm.regulatory_reference}
                  onChange={e => setEditForm(f => ({ ...f, regulatory_reference: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleEditSAR} disabled={editing}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditModal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Hub Modal */}
      {actionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-slate-800">{actionsModal.report_number}</h2>
              <button onClick={() => setActionsModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {actionsModal.customer_name || actionsModal.customer} · {actionsModal.amount != null ? formatINR(actionsModal.amount) : '-'} · <span className="capitalize">{(actionsModal.filing_status || actionsModal.status || '').replace(/_/g, ' ')}</span>
            </p>
            <div className="space-y-2">
              <button onClick={() => { loadFilingDetail(actionsModal); setActionsModal(null) }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium text-left">
                <Eye size={16} className="text-slate-500 shrink-0" />
                <span>View Details</span>
              </button>
              {actionsModal.filing_status !== 'filed' && actionsModal.status !== 'filed' && actionsModal.id && (
                <button onClick={() => { openEdit(actionsModal); setActionsModal(null) }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium text-left">
                  <Pencil size={16} className="text-amber-600 shrink-0" />
                  <span>Edit Filing</span>
                </button>
              )}
              <button onClick={() => { setPreviewModal({ format: 'rbi' }); setActionsModal(null) }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-sm text-indigo-800 font-medium text-left">
                <FileText size={16} className="text-indigo-600 shrink-0" />
                <span>View Format Templates</span>
              </button>
              <button onClick={() => { setUploadModal({ filing: actionsModal }); setActionsModal(null) }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm text-green-800 font-medium text-left">
                <Upload size={16} className="text-green-600 shrink-0" />
                <span>Upload Document</span>
              </button>
              <button onClick={() => { downloadFiling(actionsModal); setActionsModal(null) }}
                disabled={downloading === actionsModal.id || !actionsModal.id}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium text-left disabled:opacity-40">
                <Download size={16} className="text-blue-600 shrink-0" />
                <span>{downloading === actionsModal.id ? 'Downloading...' : 'Download Report'}</span>
              </button>
              {actionsModal.filing_status !== 'filed' && actionsModal.status !== 'filed' && actionsModal.id && (
                <button onClick={() => { handleSubmitSAR(actionsModal); setActionsModal(null) }}
                  disabled={submitting === actionsModal.id}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium text-left disabled:opacity-40">
                  <Send size={16} className="text-emerald-600 shrink-0" />
                  <span>Submit to FIU-IND / FIU-Bhutan</span>
                </button>
              )}
              {actionsModal.filing_status !== 'filed' && actionsModal.status !== 'filed' && actionsModal.id && (
                <button onClick={() => { handleDeleteSAR(actionsModal); setActionsModal(null) }}
                  disabled={deleting === actionsModal.id}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-sm text-red-800 font-medium text-left disabled:opacity-40">
                  <Trash2 size={16} className="text-red-600 shrink-0" />
                  <span>Delete Filing</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">STR Filing Management</h1>
          <p className="text-sm text-slate-500 mt-1">Suspicious Transaction Reports — India RBI & Bhutan RMA</p>
        </div>
        <button onClick={() => setCreateModal(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
          <Plus size={16} />
          New SAR
        </button>
      </div>

      {/* Filing status cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">SAR Status</h3>
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

      {/* Format selection modal */}
      {formatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Select Document Format</h2>
            <p className="text-sm text-slate-600 mb-4">
              {formatModal.type.toUpperCase()} documents are available in RBI (India) and RMA (Bhutan) formats.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => performDownload(formatModal.filing, 'rbi')}
                disabled={downloading === formatModal.filing.id}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {downloading === formatModal.filing.id ? 'Downloading...' : 'RBI Format (India)'}
              </button>
              <button
                onClick={() => performDownload(formatModal.filing, 'rma')}
                disabled={downloading === formatModal.filing.id}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {downloading === formatModal.filing.id ? 'Downloading...' : 'RMA Format (Bhutan)'}
              </button>
              <button
                onClick={() => setFormatModal(null)}
                disabled={downloading === formatModal.filing.id}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent STR Filings table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">STR Reports</h3>
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
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentFilings.filter((f: any) => (f.type || f.report_type || '').toLowerCase() === 'STR').map((f: any, i: number) => (
                <tr key={f.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-xs text-slate-500 uppercase">{f.type || f.report_type || 'STR'}</td>
                  <td className="py-2.5 px-3 font-mono text-xs text-red-600">{f.report_number || f.id || '-'}</td>
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
                    <button onClick={() => setActionsModal(f)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
                      <MoreHorizontal size={13} />
                      Actions
                    </button>
                  </td>
                </tr>
              ))}
              {recentFilings.filter((f: any) => (f.type || f.report_type || '').toLowerCase() === 'STR').length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">No STR Filings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
