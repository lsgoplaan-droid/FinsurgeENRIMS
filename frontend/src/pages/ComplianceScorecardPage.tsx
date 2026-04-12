import { useState, useEffect } from 'react'
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  TrendingUp, Clock, FileText
} from 'lucide-react'
import api from '../config/api'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  compliant: { label: 'Compliant', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  partial: { label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertTriangle },
  at_risk: { label: 'At Risk', color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle },
  not_implemented: { label: 'Not Implemented', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
}

type RegulatorTab = 'rbi' | 'rma'

export default function ComplianceScorecardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<RegulatorTab>('rbi')

  useEffect(() => {
    api.get('/compliance-scorecard/summary')
      .then(res => {
        setData(res.data)
        const ids = new Set<string>((res.data.sections || []).map((s: any) => s.id))
        setExpandedSections(ids)
      })
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

  if (!data) {
    return <div className="text-center text-slate-400 py-20">No compliance data available</div>
  }

  const { sections, summary } = data
  const scoreColor = summary.overall_score >= 70 ? 'text-green-600' : summary.overall_score >= 50 ? 'text-amber-600' : 'text-red-600'

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedSections(next)
  }

  const rbiSections = sections.filter((s: any) => !s.id.startsWith('rma_'))
  const rmaSections = sections.filter((s: any) => s.id.startsWith('rma_'))
  const currentSections = activeTab === 'rbi' ? rbiSections : rmaSections
  const currentSummary = activeTab === 'rbi' ? data.rbi_summary : data.rma_summary

  const SectionCard = ({ section }: { section: any }) => {
    const isExpanded = expandedSections.has(section.id)
    const sectionCompliant = section.requirements.filter((r: any) => r.status === 'compliant').length
    const sectionTotal = section.requirements.length
    const sectionScore = Math.round((sectionCompliant / sectionTotal) * 100)

    return (
      <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection(section.id)}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800">{section.title}</p>
              <p className="text-[10px] text-slate-400">{section.rbi_reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {section.requirements.map((r: any, i: number) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    r.status === 'compliant' ? 'bg-green-500' :
                    r.status === 'partial' ? 'bg-amber-500' :
                    r.status === 'at_risk' ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  title={r.requirement}
                />
              ))}
            </div>
            <span className={`text-sm font-bold ${sectionScore >= 70 ? 'text-green-600' : sectionScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {sectionCompliant}/{sectionTotal}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-slate-100">
            {section.requirements.map((req: any) => {
              const cfg = statusConfig[req.status] || statusConfig.not_implemented
              const Icon = cfg.icon
              return (
                <div key={req.id} className="flex items-start gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <div className={`w-7 h-7 ${cfg.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={cfg.color} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{req.requirement}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${req.coverage}%`,
                              backgroundColor: req.coverage >= 90 ? '#22c55e' : req.coverage >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{req.coverage}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{req.evidence}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-slate-800">Multi-Regulator Compliance Scorecard</h1>
        <p className="text-xs text-slate-500">RBI (India) + RMA (Bhutan) requirements mapped to system features — auto-assessed status</p>
      </div>

      {/* Overall Score Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={summary.overall_score >= 70 ? '#22c55e' : summary.overall_score >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(summary.overall_score / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${scoreColor}`}>{summary.overall_score}%</span>
                <span className="text-[9px] text-slate-400">Overall</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Overall Compliance</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {summary.total_requirements} requirements assessed — Average coverage: {summary.avg_coverage}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {[
              { label: 'Compliant', value: summary.compliant, color: 'bg-green-500' },
              { label: 'Partial', value: summary.partial, color: 'bg-amber-500' },
              { label: 'At Risk', value: summary.at_risk, color: 'bg-orange-500' },
              { label: 'Not Impl.', value: summary.not_implemented, color: 'bg-red-500' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-white font-bold text-lg mx-auto`}>
                  {s.value}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-green-500 transition-all" style={{ width: `${(summary.compliant / summary.total_requirements) * 100}%` }} />
            <div className="bg-amber-500 transition-all" style={{ width: `${(summary.partial / summary.total_requirements) * 100}%` }} />
            <div className="bg-orange-500 transition-all" style={{ width: `${(summary.at_risk / summary.total_requirements) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(summary.not_implemented / summary.total_requirements) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('rbi')}
          className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'rbi'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          RBI (India) — {data.rbi_summary.total_requirements} Requirements
        </button>
        <button
          onClick={() => setActiveTab('rma')}
          className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'rma'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-600 border-transparent hover:text-slate-800'
          }`}
        >
          RMA (Bhutan) — {data.rma_summary.total_requirements} Requirements
        </button>
      </div>

      {/* Tab Content - Regulator Score Card */}
      {currentSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{currentSummary.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {currentSummary.total_requirements} requirements — Coverage: {currentSummary.avg_coverage}%
              </p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${
                currentSummary.score >= 70 ? 'text-green-600' :
                currentSummary.score >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {currentSummary.score}%
              </div>
            </div>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Compliant', value: currentSummary.compliant, color: 'bg-green-100 text-green-700' },
              { label: 'Partial', value: currentSummary.partial, color: 'bg-amber-100 text-amber-700' },
              { label: 'At Risk', value: currentSummary.at_risk, color: 'bg-orange-100 text-orange-700' },
              { label: 'Not Impl.', value: currentSummary.not_implemented, color: 'bg-red-100 text-red-700' },
            ].map(s => (
              <div key={s.label} className={`p-3 rounded-lg ${s.color} text-center`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(currentSummary.compliant / currentSummary.total_requirements) * 100}%` }}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${(currentSummary.partial / currentSummary.total_requirements) * 100}%` }}
            />
            <div
              className="bg-orange-500 transition-all"
              style={{ width: `${(currentSummary.at_risk / currentSummary.total_requirements) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(currentSummary.not_implemented / currentSummary.total_requirements) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Tab Content - Sections */}
      <div className="space-y-3">
        {currentSections.map((section: any) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* Assessment info */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Last assessed: {new Date(summary.last_assessed).toLocaleString('en-IN')}</span>
        <span>Auto-assessed from live system state</span>
      </div>
    </div>
  )
}
