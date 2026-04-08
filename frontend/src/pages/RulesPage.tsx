import { useState, useEffect } from 'react'
import { BookOpen, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../config/api'
import { formatDateTime, priorityColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-green-100 text-green-800',
}

interface Category {
  name: string
  key: string
  count: number
  subcategories?: { name: string; key: string; count: number }[]
}

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/rules')
      .then(res => {
        const items = res.data.items || res.data || []
        setRules(items)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load rules'))
      .finally(() => setLoading(false))
  }, [])

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleToggleRule = async (ruleId: string) => {
    setTogglingId(ruleId)
    try {
      const res = await api.post(`/rules/${ruleId}/toggle`)
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_enabled: res.data.is_enabled ?? !r.is_enabled, enabled: res.data.enabled ?? !r.enabled } : r))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle rule')
    } finally {
      setTogglingId(null)
    }
  }

  const filteredRules = selectedCategory
    ? rules.filter(r => (r.category || '').toLowerCase() === selectedCategory.toLowerCase() || (r.subcategory || '').toLowerCase() === selectedCategory.toLowerCase())
    : rules

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
  if (error && rules.length === 0) return <div className="flex items-center justify-center h-full text-red-500">{error}</div>

  // Build categories from rules if API didn't return them
  const displayCategories = categories.length > 0 ? categories : (() => {
    const catMap: Record<string, { count: number; subcategories: Record<string, number> }> = {}
    rules.forEach(r => {
      const cat = r.category || 'Uncategorized'
      if (!catMap[cat]) catMap[cat] = { count: 0, subcategories: {} }
      catMap[cat].count++
      if (r.subcategory) {
        catMap[cat].subcategories[r.subcategory] = (catMap[cat].subcategories[r.subcategory] || 0) + 1
      }
    })
    return Object.entries(catMap).map(([name, data]) => ({
      name,
      key: name.toLowerCase(),
      count: data.count,
      subcategories: Object.entries(data.subcategories).map(([n, c]) => ({ name: n, key: n.toLowerCase(), count: c })),
    }))
  })()

  return (
    <div className="flex gap-4 h-full">
      {/* Left sidebar - categories */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Categories</h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategory('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedCategory ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Rules ({rules.length})
            </button>

            {displayCategories.map(cat => (
              <div key={cat.key || cat.name}>
                <button
                  onClick={() => {
                    setSelectedCategory(cat.key || cat.name)
                    toggleCategory(cat.key || cat.name)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === (cat.key || cat.name) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="capitalize">{cat.name.replace(/_/g, ' ')}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">{cat.count}</span>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <ChevronRight size={14} className={`transition-transform ${expandedCategories.has(cat.key || cat.name) ? 'rotate-90' : ''}`} />
                    )}
                  </span>
                </button>
                {cat.subcategories && expandedCategories.has(cat.key || cat.name) && (
                  <div className="ml-3 space-y-0.5">
                    {cat.subcategories.map(sub => (
                      <button
                        key={sub.key || sub.name}
                        onClick={() => setSelectedCategory(sub.key || sub.name)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedCategory === (sub.key || sub.name) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {sub.name.replace(/_/g, ' ')} ({sub.count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - rules table */}
      <div className="flex-1 min-w-0">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Category</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Severity</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Enabled</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600">Detections</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Last Triggered</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(r => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.name || r.rule_name}</p>
                        {r.description && <p className="text-xs text-slate-400 truncate max-w-[300px]">{r.description}</p>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize text-xs">
                      {(r.category || '-').replace(/_/g, ' ')}
                      {r.subcategory && <span className="text-slate-400"> / {r.subcategory.replace(/_/g, ' ')}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.severity || '-'} colors={severityColors[r.severity] || priorityColors[r.severity] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleRule(r.id)}
                        disabled={togglingId === r.id}
                        className="transition-colors disabled:opacity-50"
                      >
                        {(r.is_enabled ?? r.enabled) ? (
                          <ToggleRight size={24} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={24} className="text-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">{r.detection_count ?? r.detections ?? '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(r.last_triggered || r.last_triggered_at)}</td>
                  </tr>
                ))}
                {filteredRules.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No rules found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
