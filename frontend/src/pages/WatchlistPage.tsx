import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Globe } from 'lucide-react'
import api from '../config/api'
import { formatDate } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

export default function WatchlistPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(() => {
    setLoading(true)
    const params: any = { page, page_size: 20 }

    api.get('/watchlists', { params })
      .then(res => {
        const d = res.data
        setEntries(d.items || d.data || d.entries || d.watchlists || [])
        setTotalPages(d.total_pages || d.pages || Math.ceil((d.total || 0) / 20))
        setTotal(d.total || 0)
      })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load watchlists'))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!search.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setError('')
    try {
      const res = await api.post('/watchlists/search', { query: search })
      setSearchResults(res.data.results || res.data.matches || res.data.items || res.data || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const matchScoreColor = (score: number) => {
    if (score >= 90) return 'bg-red-100 text-red-800'
    if (score >= 70) return 'bg-orange-100 text-orange-800'
    if (score >= 50) return 'bg-amber-100 text-amber-800'
    return 'bg-green-100 text-green-800'
  }

  const sourceColors: Record<string, string> = {
    ofac: 'bg-red-100 text-red-800',
    un: 'bg-blue-100 text-blue-800',
    eu: 'bg-indigo-100 text-indigo-800',
    pep: 'bg-purple-100 text-purple-800',
    interpol: 'bg-orange-100 text-orange-800',
    rbi: 'bg-emerald-100 text-emerald-800',
    internal: 'bg-slate-100 text-slate-800',
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search watchlists with fuzzy matching (name, alias, ID)..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          {searchResults !== null && (
            <button
              type="button"
              onClick={() => { setSearchResults(null); setSearch('') }}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Search results */}
      {searchResults !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={15} />
              Search Results ({searchResults.length} matches)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Match Score</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Source</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Nationality</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Reason</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r: any, i: number) => (
                  <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <Badge text={`${r.match_score || r.score || 0}%`} colors={matchScoreColor(r.match_score || r.score || 0)} />
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{r.name || r.full_name || '-'}</td>
                    <td className="py-2.5 px-3">
                      <Badge text={r.source || '-'} colors={sourceColors[(r.source || '').toLowerCase()] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(r.entity_type || r.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.nationality || r.country || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs truncate max-w-[200px]">{r.reason || r.listed_reason || '-'}</td>
                  </tr>
                ))}
                {searchResults.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">No matches found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main watchlist table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe size={15} />
            Watchlist Entries ({total})
          </h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Source</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Nationality</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Reason</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600">Listed Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-800">{e.name || e.full_name}</p>
                      {e.aliases && e.aliases.length > 0 && (
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">
                          aka: {Array.isArray(e.aliases) ? e.aliases.join(', ') : e.aliases}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge text={e.source || '-'} colors={sourceColors[(e.source || '').toLowerCase()] || 'bg-gray-100 text-gray-800'} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{(e.entity_type || e.type || '-').replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-600">{e.nationality || e.country || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs truncate max-w-[200px]">{e.reason || e.listed_reason || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(e.listed_date || e.created_at)}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No watchlist entries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
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
