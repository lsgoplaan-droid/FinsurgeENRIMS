import { useState, useEffect } from 'react'
import {
  Shield, FileText, AlertTriangle, Scale, DollarSign, CheckCircle,
  XCircle, Clock, ChevronRight, Plus, Building2, Phone, User,
  Calendar, Gavel, IndianRupee, ArrowUpRight, Filter, ChevronDown,
  X, Save, ArrowRight, Flag, Globe, Download
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import api from '../config/api'
import { formatNumber, formatDateTime } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  filed: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-indigo-100 text-indigo-800',
  under_investigation: 'bg-amber-100 text-amber-800',
  charge_sheet_filed: 'bg-orange-100 text-orange-800',
  court_proceedings: 'bg-purple-100 text-purple-800',
  convicted: 'bg-green-100 text-green-800',
  acquitted: 'bg-red-100 text-red-800',
  closed: 'bg-slate-100 text-slate-600',
  withdrawn: 'bg-slate-100 text-slate-600',
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const PIE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#3b82f6']

function formatINR(paise: number) {
  const inr = paise / 100
  if (inr >= 10000000) return `${(inr / 10000000).toFixed(2)} Cr`
  if (inr >= 100000) return `${(inr / 100000).toFixed(2)} L`
  if (inr >= 1000) return `${(inr / 1000).toFixed(1)}K`
  return inr.toFixed(0)
}

const OFFENSE_TYPES = [
  { code: 'cheating', label: 'Cheating (IPC 420)' },
  { code: 'forgery', label: 'Forgery (IPC 468, 471)' },
  { code: 'cyber_fraud', label: 'Cyber Fraud (IT Act 66C, 66D)' },
  { code: 'money_laundering', label: 'Money Laundering (PMLA Sec 3, 4)' },
  { code: 'identity_theft', label: 'Identity Theft (IT Act 66C)' },
  { code: 'card_fraud', label: 'Card Fraud (IPC 420, IT Act 66C)' },
  { code: 'upi_fraud', label: 'UPI Fraud (IPC 420, IT Act 66D)' },
  { code: 'loan_fraud', label: 'Loan Fraud (IPC 420, 467)' },
  { code: 'insider_fraud', label: 'Insider Fraud (IPC 408, 409)' },
  { code: 'phishing', label: 'Phishing (IT Act 66D)' },
  { code: 'sim_swap', label: 'SIM Swap Fraud (IPC 420, IT Act 66)' },
  { code: 'account_takeover', label: 'Account Takeover (IPC 420, IT Act 43)' },
]

const POLICE_STATIONS = [
  { name: 'Cyber Crime PS, BKC', district: 'Mumbai', state: 'Maharashtra' },
  { name: 'EOW, Mandir Marg', district: 'Delhi', state: 'Delhi' },
  { name: 'Cyber Crime Cell, HAL', district: 'Bangalore', state: 'Karnataka' },
  { name: 'Cyber Crime Wing, Egmore', district: 'Chennai', state: 'Tamil Nadu' },
  { name: 'Lalbazar Cyber Crime', district: 'Kolkata', state: 'West Bengal' },
  { name: 'Cyber Crime PS, Banjara Hills', district: 'Hyderabad', state: 'Telangana' },
  { name: 'Cyber Crime Cell, Koregaon Park', district: 'Pune', state: 'Maharashtra' },
  { name: 'Cyber Crime PS, Ashram Road', district: 'Ahmedabad', state: 'Gujarat' },
]

export default function PoliceFIRPage() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [firs, setFirs] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedFIR, setSelectedFIR] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showManagePanel, setShowManagePanel] = useState(false)
  const [cases, setCases] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  // Create form state
  const [createForm, setCreateForm] = useState({
    case_id: '', police_station: '', police_district: '', police_state: '',
    offense_type: 'cheating', offense_description: '', fraud_amount: '',
    offense_date: '', priority: 'medium', notes: '',
  })

  // Manage form state
  const [manageForm, setManageForm] = useState({
    investigating_officer: '', officer_contact: '', officer_designation: '',
    acknowledgment_number: '', charge_sheet_number: '', court_name: '',
    court_case_number: '', next_hearing_date: '', hearing_notes: '',
    amount_recovered: '', recovery_details: '', notes: '',
  })

  const refreshData = () => {
    Promise.all([
      api.get('/police-fir/dashboard/summary'),
      api.get('/police-fir/list'),
    ])
      .then(([dashRes, listRes]) => {
        setDashboard(dashRes.data)
        setFirs(listRes.data?.firs || [])
        setSummary(listRes.data?.summary || {})
      })
      .catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    refreshData()
    setLoading(false)
  }, [])

  // Load cases for the create form
  useEffect(() => {
    if (showCreateModal && cases.length === 0) {
      api.get('/cases', { params: { page_size: 50 } })
        .then(res => setCases(res.data?.items || res.data?.cases || []))
        .catch(() => {})
    }
  }, [showCreateModal])

  const loadDetail = (firId: string) => {
    setDetailLoading(true)
    api.get(`/police-fir/${firId}`)
      .then(res => {
        setSelectedFIR(res.data)
        setManageForm({
          investigating_officer: res.data.investigating_officer || '',
          officer_contact: res.data.officer_contact || '',
          officer_designation: res.data.officer_designation || '',
          acknowledgment_number: res.data.acknowledgment_number || '',
          charge_sheet_number: res.data.charge_sheet_number || '',
          court_name: res.data.court_name || '',
          court_case_number: res.data.court_case_number || '',
          next_hearing_date: res.data.next_hearing_date?.split('T')[0] || '',
          hearing_notes: res.data.hearing_notes || '',
          amount_recovered: res.data.amount_recovered ? String(res.data.amount_recovered / 100) : '',
          recovery_details: res.data.recovery_details || '',
          notes: res.data.notes || '',
        })
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  const downloadFIR = (firId: string, firNumber: string) => {
    setDownloading(firId)
    api.get(`/police-fir/${firId}/download`, { responseType: 'arraybuffer' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/plain;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `FIR-${firNumber}.txt`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      })
      .catch(err => {
        console.error('Download error:', err)
        alert('Failed to download FIR document')
      })
      .finally(() => setDownloading(null))
  }

  const handleCreate = () => {
    if (!createForm.case_id || !createForm.police_station || !createForm.offense_type) return
    setActionLoading(true)
    api.post('/police-fir/create', {
      ...createForm,
      fraud_amount: createForm.fraud_amount ? Math.round(parseFloat(createForm.fraud_amount) * 100) : 0,
    })
      .then(res => {
        setShowCreateModal(false)
        setCreateForm({ case_id: '', police_station: '', police_district: '', police_state: '', offense_type: 'cheating', offense_description: '', fraud_amount: '', offense_date: '', priority: 'medium', notes: '' })
        refreshData()
        loadDetail(res.data.id)
        setActionMsg(`FIR ${res.data.fir_number} created as draft`)
        setTimeout(() => setActionMsg(''), 4000)
      })
      .catch(() => setActionMsg('Failed to create FIR'))
      .finally(() => setActionLoading(false))
  }

  const handleStatusTransition = (newStatus: string) => {
    if (!selectedFIR) return
    setActionLoading(true)
    api.put(`/police-fir/${selectedFIR.id}/update`, { status: newStatus })
      .then(() => {
        loadDetail(selectedFIR.id)
        refreshData()
        setActionMsg(`Status changed to ${newStatus.replace(/_/g, ' ')}`)
        setTimeout(() => setActionMsg(''), 4000)
      })
      .catch((err) => setActionMsg(err.response?.data?.detail || 'Failed to update status'))
      .finally(() => setActionLoading(false))
  }

  const handleUpdateDetails = () => {
    if (!selectedFIR) return
    setActionLoading(true)
    api.put(`/police-fir/${selectedFIR.id}/update`, {
      ...manageForm,
      amount_recovered: manageForm.amount_recovered ? Math.round(parseFloat(manageForm.amount_recovered) * 100) : undefined,
      next_hearing_date: manageForm.next_hearing_date || undefined,
    })
      .then(() => {
        loadDetail(selectedFIR.id)
        refreshData()
        setShowManagePanel(false)
        setActionMsg('FIR details updated')
        setTimeout(() => setActionMsg(''), 4000)
      })
      .catch(() => setActionMsg('Failed to update'))
      .finally(() => setActionLoading(false))
  }

  const handleReportRBI = () => {
    if (!selectedFIR) return
    setActionLoading(true)
    api.post(`/police-fir/${selectedFIR.id}/report-rbi`)
      .then(res => {
        loadDetail(selectedFIR.id)
        refreshData()
        setActionMsg(`RBI FMR-1 filed: ${res.data.rbi_reference}`)
        setTimeout(() => setActionMsg(''), 5000)
      })
      .catch(() => setActionMsg('Failed to report to RBI'))
      .finally(() => setActionLoading(false))
  }

  const handleReportCyberCell = () => {
    if (!selectedFIR) return
    setActionLoading(true)
    api.post(`/police-fir/${selectedFIR.id}/report-cyber-cell`)
      .then(res => {
        loadDetail(selectedFIR.id)
        refreshData()
        setActionMsg(`Cyber Cell complaint: ${res.data.cyber_complaint_number}`)
        setTimeout(() => setActionMsg(''), 5000)
      })
      .catch(() => setActionMsg('Failed to report to Cyber Cell'))
      .finally(() => setActionLoading(false))
  }

  const handleStationSelect = (idx: number) => {
    const ps = POLICE_STATIONS[idx]
    if (ps) {
      setCreateForm(f => ({ ...f, police_station: ps.name, police_district: ps.district, police_state: ps.state }))
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const filteredFirs = statusFilter ? firs.filter(f => f.status === statusFilter) : firs

  const offenseData = (dashboard?.offense_breakdown || []).map((o: any) => ({
    name: o.offense_type?.replace(/_/g, ' '),
    count: o.count,
    amount: o.fraud_amount / 100,
  }))

  const statCards = [
    { label: 'Total FIRs', value: dashboard?.total_firs || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Cases', value: dashboard?.active || 0, icon: Scale, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Convictions', value: dashboard?.convictions || 0, icon: Gavel, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Recovery Rate', value: `${dashboard?.recovery_rate || 0}%`, icon: IndianRupee, color: dashboard?.recovery_rate >= 30 ? 'text-green-600' : 'text-red-600', bg: dashboard?.recovery_rate >= 30 ? 'bg-green-50' : 'bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      {/* Action message */}
      {actionMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')}><X size={14} /></button>
        </div>
      )}

      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Police FIR Management</h1>
          <p className="text-xs text-slate-500">File FIRs, track investigations, court proceedings, recovery & RBI reporting</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          File New FIR
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>
                  {typeof s.value === 'number' ? formatNumber(s.value) : s.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial summary + chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Fraud Amount</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatINR(dashboard?.total_fraud_amount || 0)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Recovered</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatINR(dashboard?.total_recovered || 0)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">RBI FMR-1 Filed</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">{dashboard?.rbi_reported || 0}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Cyber Cell Reported</p>
              <p className="text-xl font-bold text-purple-600 mt-1">{dashboard?.cyber_reported || 0}</p>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">FIR by Offense Type</h3>
          {offenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={offenseData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatNumber(v)} />
                <Bar dataKey="count" name="Count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-slate-400">No FIR data</div>
          )}
        </div>
      </div>

      {/* Upcoming hearings */}
      {(dashboard?.upcoming_hearings || []).length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gavel size={18} className="text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-800">Upcoming Court Hearings ({dashboard.upcoming_hearings.length})</h3>
          </div>
          <div className="space-y-2">
            {dashboard.upcoming_hearings.map((h: any) => (
              <div key={h.fir_id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100 cursor-pointer hover:bg-purple-50/50" onClick={() => loadDetail(h.fir_id)}>
                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-purple-500" />
                  <div>
                    <span className="text-sm font-medium text-slate-700">{h.fir_number}</span>
                    <span className="text-xs text-slate-400 ml-2">{h.offense_type?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-700">{h.court_name}</span>
                  <span className="text-xs font-semibold text-purple-600">{h.next_hearing_date?.split('T')[0]}</span>
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Create */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter size={16} className="text-slate-400" />
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white cursor-pointer">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="filed">Filed</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="under_investigation">Under Investigation</option>
              <option value="charge_sheet_filed">Charge Sheet Filed</option>
              <option value="court_proceedings">Court Proceedings</option>
              <option value="convicted">Convicted</option>
              <option value="closed">Closed</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            {summary.draft || 0} draft | {summary.filed || 0} filed | {summary.under_investigation || 0} investigating
          </span>
        </div>
      </div>

      {/* FIR Detail panel with manage actions */}
      {selectedFIR && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-indigo-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{selectedFIR.fir_number}</h3>
                <span className="text-xs text-slate-400">Case: {selectedFIR.case_number} | Customer: {selectedFIR.customer_name || '-'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadFIR(selectedFIR.id, selectedFIR.fir_number)}
                disabled={downloading === selectedFIR.id}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Download size={14} />
                Download
              </button>
              <button onClick={() => setShowManagePanel(!showManagePanel)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors">
                Edit Details
              </button>
              <button onClick={() => { setSelectedFIR(null); setShowManagePanel(false) }} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-medium">Police Station</p>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-slate-400" />
                <span className="text-sm text-slate-700">{selectedFIR.police_station}</span>
              </div>
              <p className="text-xs text-slate-400">{selectedFIR.police_district}, {selectedFIR.police_state}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-medium">Investigating Officer</p>
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400" />
                <span className="text-sm text-slate-700">{selectedFIR.investigating_officer || 'Not assigned'}</span>
              </div>
              {selectedFIR.officer_contact && <p className="text-xs text-slate-400">{selectedFIR.officer_contact} ({selectedFIR.officer_designation})</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase font-medium">Offense</p>
              <Badge text={selectedFIR.offense_type} colors="bg-red-100 text-red-800" />
              <p className="text-xs text-slate-400">{selectedFIR.ipc_sections}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-red-500/10 rounded-lg p-3">
              <p className="text-xs text-red-600">Fraud Amount</p>
              <p className="text-lg font-bold text-red-700">{formatINR(selectedFIR.fraud_amount)}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3">
              <p className="text-xs text-green-600">Recovered</p>
              <p className="text-lg font-bold text-green-700">{formatINR(selectedFIR.amount_recovered)}</p>
            </div>
            <div className="bg-indigo-500/10 rounded-lg p-3">
              <p className="text-xs text-indigo-600">Status</p>
              <Badge text={selectedFIR.status} colors={statusColors[selectedFIR.status] || 'bg-gray-100 text-gray-700'} />
            </div>
            <div className="bg-purple-500/10 rounded-lg p-3">
              <p className="text-xs text-purple-600">Assets</p>
              <p className="text-sm font-semibold">{selectedFIR.assets_frozen ? <span className="text-amber-600">Frozen</span> : <span className="text-slate-400">Not frozen</span>}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap mb-4 p-3 bg-slate-50 rounded-lg">
            <span className="text-xs font-medium text-slate-500 mr-2">Actions:</span>

            {/* Status transitions */}
            {(selectedFIR.valid_transitions || []).map((t: string) => (
              <button
                key={t}
                onClick={() => handleStatusTransition(t)}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <ArrowRight size={12} />
                {t.replace(/_/g, ' ')}
              </button>
            ))}

            {/* RBI report */}
            {!selectedFIR.rbi_fraud_reported && selectedFIR.status !== 'draft' && (
              <button
                onClick={handleReportRBI}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Flag size={12} />
                Report to RBI (FMR-1)
              </button>
            )}
            {selectedFIR.rbi_fraud_reported && (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                <CheckCircle size={12} />
                RBI: {selectedFIR.rbi_reference}
              </span>
            )}

            {/* Cyber Cell report */}
            {!selectedFIR.cyber_cell_reported && selectedFIR.status !== 'draft' && (
              <button
                onClick={handleReportCyberCell}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Globe size={12} />
                Report to Cyber Cell
              </button>
            )}
            {selectedFIR.cyber_cell_reported && (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                <CheckCircle size={12} />
                Cyber: {selectedFIR.cyber_complaint_number}
              </span>
            )}
          </div>

          {/* Manage panel (edit details) */}
          {showManagePanel && (
            <div className="border border-indigo-200 rounded-lg p-4 mb-4 bg-indigo-50/30">
              <h4 className="text-sm font-semibold text-indigo-800 mb-3">Update FIR Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Investigating Officer</label>
                  <input value={manageForm.investigating_officer} onChange={e => setManageForm(f => ({ ...f, investigating_officer: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Officer Contact</label>
                  <input value={manageForm.officer_contact} onChange={e => setManageForm(f => ({ ...f, officer_contact: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Officer Designation</label>
                  <input value={manageForm.officer_designation} onChange={e => setManageForm(f => ({ ...f, officer_designation: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Acknowledgment #</label>
                  <input value={manageForm.acknowledgment_number} onChange={e => setManageForm(f => ({ ...f, acknowledgment_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Charge Sheet #</label>
                  <input value={manageForm.charge_sheet_number} onChange={e => setManageForm(f => ({ ...f, charge_sheet_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Court Name</label>
                  <input value={manageForm.court_name} onChange={e => setManageForm(f => ({ ...f, court_name: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Court Case #</label>
                  <input value={manageForm.court_case_number} onChange={e => setManageForm(f => ({ ...f, court_case_number: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Next Hearing Date</label>
                  <input type="date" value={manageForm.next_hearing_date} onChange={e => setManageForm(f => ({ ...f, next_hearing_date: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Amount Recovered (INR)</label>
                  <input type="number" value={manageForm.amount_recovered} onChange={e => setManageForm(f => ({ ...f, amount_recovered: e.target.value }))} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" placeholder="e.g. 150000" />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] text-slate-500 uppercase">Notes</label>
                  <textarea value={manageForm.notes} onChange={e => setManageForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={handleUpdateDetails} disabled={actionLoading} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                  <Save size={12} />
                  Save Changes
                </button>
                <button onClick={() => setShowManagePanel(false)} className="px-4 py-2 text-slate-600 rounded-lg text-xs hover:bg-slate-100">Cancel</button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {selectedFIR.timeline?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Activity Timeline</h4>
              <div className="space-y-2">
                {selectedFIR.timeline.map((t: any) => (
                  <div key={t.id} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-slate-700">{t.description}</span>
                      <span className="text-slate-400 ml-2">{t.user_name} &middot; {t.created_at?.split('T')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FIR list table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">FIR Number</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Case</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Offense</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Police Station</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Fraud Amt</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Recovered</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-[140px]">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">RBI</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Cyber</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600">Download</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Filed</th>
              </tr>
            </thead>
            <tbody>
              {filteredFirs.map(f => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-3 cursor-pointer" onClick={() => loadDetail(f.id)}>
                    <span className="font-mono text-xs text-indigo-600 font-semibold">{f.fir_number}</span>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 cursor-pointer" onClick={() => loadDetail(f.id)}>{f.case_number}</td>
                  <td className="py-2.5 px-3 cursor-pointer" onClick={() => loadDetail(f.id)}>
                    <Badge text={f.offense_type} colors="bg-red-50 text-red-700" />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 cursor-pointer" onClick={() => loadDetail(f.id)}>{f.police_station}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-600 text-xs cursor-pointer" onClick={() => loadDetail(f.id)}>{formatINR(f.fraud_amount)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-green-600 text-xs cursor-pointer" onClick={() => loadDetail(f.id)}>{formatINR(f.amount_recovered)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap cursor-pointer" onClick={() => loadDetail(f.id)}>
                    <Badge text={f.status} colors={statusColors[f.status] || 'bg-gray-100 text-gray-700'} />
                  </td>
                  <td className="py-2.5 px-3 cursor-pointer" onClick={() => loadDetail(f.id)}>
                    {f.rbi_fraud_reported ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-slate-300" />}
                  </td>
                  <td className="py-2.5 px-3 cursor-pointer" onClick={() => loadDetail(f.id)}>
                    {f.cyber_cell_reported ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-slate-300" />}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadFIR(f.id, f.fir_number)
                      }}
                      disabled={downloading === f.id}
                      className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Download FIR document"
                    >
                      <Download size={14} className={downloading === f.id ? 'text-slate-300' : 'text-blue-600'} />
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-500 cursor-pointer" onClick={() => loadDetail(f.id)}>{f.filed_at?.split('T')[0] || '-'}</td>
                </tr>
              ))}
              {filteredFirs.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-slate-400">No FIR records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create FIR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">File New FIR</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Case selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Linked Case *</label>
                <select
                  value={createForm.case_id}
                  onChange={e => setCreateForm(f => ({ ...f, case_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="">Select a case...</option>
                  {cases.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.case_number} — {c.customer_name || c.case_type} ({c.status?.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>

              {/* Police Station */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Police Station *</label>
                <select
                  onChange={e => handleStationSelect(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2"
                >
                  <option value="">Select known station...</option>
                  {POLICE_STATIONS.map((ps, i) => (
                    <option key={i} value={i}>{ps.name} — {ps.district}, {ps.state}</option>
                  ))}
                </select>
                <input
                  value={createForm.police_station}
                  onChange={e => setCreateForm(f => ({ ...f, police_station: e.target.value }))}
                  placeholder="Or enter police station name"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
                  <input value={createForm.police_district} onChange={e => setCreateForm(f => ({ ...f, police_district: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                  <input value={createForm.police_state} onChange={e => setCreateForm(f => ({ ...f, police_state: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>

              {/* Offense type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Offense Type *</label>
                <select
                  value={createForm.offense_type}
                  onChange={e => setCreateForm(f => ({ ...f, offense_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  {OFFENSE_TYPES.map(o => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fraud Amount (INR)</label>
                  <input type="number" value={createForm.fraud_amount} onChange={e => setCreateForm(f => ({ ...f, fraud_amount: e.target.value }))} placeholder="e.g. 500000" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Offense Date</label>
                  <input type="date" value={createForm.offense_date} onChange={e => setCreateForm(f => ({ ...f, offense_date: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Offense Description</label>
                <textarea value={createForm.offense_description} onChange={e => setCreateForm(f => ({ ...f, offense_description: e.target.value }))} rows={3} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="Describe the offense in detail..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="Additional notes..." />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-400">FIR will be created as Draft — file with police station to activate</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={actionLoading || !createForm.case_id || !createForm.police_station}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Plus size={14} />
                  {actionLoading ? 'Creating...' : 'Create FIR Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
