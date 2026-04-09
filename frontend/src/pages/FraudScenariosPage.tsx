import { useState, useEffect } from 'react'
import { BookOpen, Shield, AlertTriangle, Activity, Eye, EyeOff } from 'lucide-react'
import api from '../config/api'
import { formatNumber } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const riskBadgeColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

const categoryBadgeColors: Record<string, string> = {
  fraud: 'bg-red-100 text-red-800',
  cyber_fraud: 'bg-orange-100 text-orange-800',
  ai_fraud: 'bg-violet-100 text-violet-800',
  internal_fraud: 'bg-amber-100 text-amber-800',
}

const TABS = [
  { key: '', label: 'All' },
  { key: 'fraud', label: 'Fraud' },
  { key: 'cyber_fraud', label: 'Cyber Fraud' },
  { key: 'ai_fraud', label: 'AI Fraud' },
  { key: 'internal_fraud', label: 'Internal Fraud' },
]

export default function FraudScenariosPage() {
  const [stats, setStats] = useState<any>(null)
  const [typologies, setTypologies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    const params: any = {}
    if (tab) params.category = tab

    Promise.all([
      api.get('/fraud-scenarios/stats'),
      api.get('/fraud-scenarios/typologies', { params }),
    ])
      .then(([statsRes, typologiesRes]) => {
        setStats(statsRes.data)
        setTypologies(typologiesRes.data?.items || typologiesRes.data?.typologies || typologiesRes.data || [])
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load fraud scenarios'))
      .finally(() => setLoading(false))
  }, [tab])

  if (loading && !stats) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && !stats) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  const statCards = [
    { label: 'Total Typologies', value: stats?.total_typologies ?? 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Scenarios', value: stats?.active_scenarios ?? 0, icon: Shield, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Rules', value: stats?.total_rules ?? 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Detections (30d)', value: stats?.detections_30d ?? 0, icon: Activity, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatNumber(s.value)}</p>
              </div>
              <div className={`w-12 h-12 ${s.bg} rounded-xl flex items-center justify-center`}>
                <s.icon className={s.color} size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Typology cards grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">Loading...</div>
      ) : typologies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">No typologies found</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {typologies.map((typ, idx) => (
            <div key={typ.id || idx} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm">{typ.name || 'Unnamed Typology'}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      text={typ.category || 'unknown'}
                      colors={categoryBadgeColors[typ.category?.toLowerCase()] || 'bg-gray-100 text-gray-800'}
                    />
                    {typ.subcategory && (
                      <Badge text={typ.subcategory} colors="bg-slate-100 text-slate-600" />
                    )}
                  </div>
                </div>
                <Badge
                  text={typ.risk_level || 'medium'}
                  colors={riskBadgeColors[typ.risk_level?.toLowerCase()] || 'bg-gray-100 text-gray-800'}
                />
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{typ.description || 'No description available'}</p>

              {/* FATF Reference */}
              {typ.fatf_reference && (
                <p className="text-xs text-slate-400 mt-2">FATF: {typ.fatf_reference}</p>
              )}

              {/* Indicators */}
              {(typ.indicators || []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Indicators:</p>
                  <ul className="space-y-1">
                    {typ.indicators.slice(0, 5).map((ind: string, i: number) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400 mt-0.5">&#8226;</span>
                        <span>{ind}</span>
                      </li>
                    ))}
                    {typ.indicators.length > 5 && (
                      <li className="text-xs text-slate-400">+{typ.indicators.length - 5} more...</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <BookOpen size={12} />
                    {typ.rules_count ?? typ.rule_count ?? 0} rules
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity size={12} />
                    {typ.detections_30d ?? typ.detection_count ?? 0} detections (30d)
                  </span>
                </div>
                <Badge
                  text={typ.status === 'active' ? 'Active' : 'Inactive'}
                  colors={
                    typ.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-500'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
