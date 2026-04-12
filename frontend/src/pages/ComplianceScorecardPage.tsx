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

export default function ComplianceScorecardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.get('/compliance-scorecard/summary')
      .then(res => {
        setData(res.data)
        // Expand all sections by default
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
            {/* Score ring */}
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
                {summary.total_requirements} requirements assessed &mdash; Average coverage: {summary.avg_coverage}%
              </p>
            </div>
          </div>

          {/* Status distribution */}
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

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-green-500 transition-all" style={{ width: `${(summary.compliant / summary.total_requirements) * 100}%` }} />
            <div className="bg-amber-500 transition-all" style={{ width: `${(summary.partial / summary.total_requirements) * 100}%` }} />
            <div className="bg-orange-500 transition-all" style={{ width: `${(summary.at_risk / summary.total_requirements) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(summary.not_implemented / summary.total_requirements) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Regulator-Specific Scores */}
      {data.rbi_summary && data.rma_summary && (
        <div className="grid grid-cols-2 gap-4">
          {[data.rbi_summary, data.rma_summary].map((reg: any) => {
            const regScore = reg.score
            const regColor = regScore >= 70 ? 'text-green-600' : regScore >= 50 ? 'text-amber-600' : 'text-red-600'
            return (
              <div key={reg.title} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{reg.title}</h3>
                  <span className={`text-2xl font-bold ${regColor}`}>{reg.score}%</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {reg.total_requirements} requirements — Coverage: {reg.avg_coverage}%
                </p>
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${reg.score}%`,
                        backgroundColor: reg.score >= 70 ? '#22c55e' : reg.score >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2 text-[9px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{reg.compliant}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{reg.partial}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />{reg.at_risk}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{reg.not_implemented}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* RBI Sections */}
      {sections.filter((s: any) => !s.id.startsWith('rma_')).length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3 px-1">RBI Requirements (India)</h2>
          {sections.filter((s: any) => !s.id.startsWith('rma_')).map((section: any) => {
        const isExpanded = expandedSections.has(section.id)
        const sectionCompliant = section.requirements.filter((r: any) => r.status === 'compliant').length
        const sectionTotal = section.requirements.length
        const sectionScore = Math.round((sectionCompliant / sectionTotal) * 100)

        return (
          <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Section header */}
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

            {/* Requirements */}
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
          })}
        </div>
      )}

      {/* RMA Sections */}
      {sections.filter((s: any) => s.id.startsWith('rma_')).length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3 px-1">RMA Requirements (Bhutan)</h2>
          {sections.filter((s: any) => s.id.startsWith('rma_')).map((section: any) => {
        const isExpanded = expandedSections.has(section.id)
        const sectionCompliant = section.requirements.filter((r: any) => r.status === 'compliant').length
        const sectionTotal = section.requirements.length
        const sectionScore = Math.round((sectionCompliant / sectionTotal) * 100)

        return (
          <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Section header */}
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

            {/* Requirements */}
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
          })}
        </div>
      )}

      {/* Assessment info */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Last assessed: {new Date(summary.last_assessed).toLocaleString('en-IN')}</span>
        <span>Auto-assessed from live system state</span>
      </div>
    </div>
  )
}
