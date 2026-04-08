import { useState } from 'react'
import { Search, Users, ArrowRight, ArrowLeftRight, Building, User, AlertTriangle } from 'lucide-react'
import api from '../config/api'
import { formatINR, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

interface NetworkNode {
  id: string
  name: string
  type: string
  risk_score?: number
  risk_category?: string
  customer_number?: string
}

interface NetworkEdge {
  source: string
  target: string
  relationship: string
  strength?: number
  transaction_count?: number
  total_amount?: number
}

export default function NetworkPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [data, setData] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[]; center?: NetworkNode } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    setError('')
    setData(null)
    setSelectedNode(null)

    try {
      // First search for customer
      const searchRes = await api.get('/customers', { params: { search: searchQuery, page_size: 1 } })
      const customers = searchRes.data.items || searchRes.data.data || searchRes.data.customers || []
      if (customers.length === 0) {
        setError('No customer found matching the search query')
        setLoading(false)
        return
      }
      const cid = customers[0].id
      setCustomerId(cid)

      // Fetch network graph
      const graphRes = await api.get(`/network/${cid}/graph`)
      setData(graphRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load network data')
    } finally {
      setLoading(false)
    }
  }

  const riskColor = (score: number) => {
    if (score >= 75) return '#ef4444'
    if (score >= 50) return '#f97316'
    if (score >= 25) return '#f59e0b'
    return '#10b981'
  }

  const nodeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'business':
      case 'corporate': return Building
      default: return User
    }
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
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for a customer by name or customer number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Analyze Network'}
          </button>
        </form>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading && <div className="text-center text-slate-500 py-12">Loading network data...</div>}

      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Network visualization - nodes */}
          <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Users size={16} />
              Network Graph ({data.nodes?.length || 0} nodes, {data.edges?.length || 0} connections)
            </h3>

            {/* Simple visual representation */}
            <div className="relative min-h-[400px] bg-slate-50 rounded-lg p-6 overflow-auto">
              {/* Center node */}
              {data.center && (
                <div className="flex flex-col items-center mb-8">
                  <div
                    className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold cursor-pointer shadow-lg ring-4 ring-blue-200"
                    onClick={() => setSelectedNode(data.center!)}
                  >
                    {(data.center.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-2">{data.center.name}</p>
                  <p className="text-xs text-slate-400">Center Node</p>
                </div>
              )}

              {/* Connected nodes grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(data.nodes || []).filter(n => n.id !== data.center?.id).map(node => {
                  const Icon = nodeIcon(node.type)
                  const edge = data.edges?.find(e => e.source === node.id || e.target === node.id)

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedNode?.id === node.id
                          ? 'border-blue-400 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                          style={{ backgroundColor: node.risk_score ? riskColor(node.risk_score) : '#94a3b8' }}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{node.name}</p>
                          <p className="text-xs text-slate-400 capitalize">{(node.type || '').replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {edge && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <ArrowLeftRight size={10} />
                          <span className="capitalize truncate">{(edge.relationship || '').replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {node.risk_score != null && (
                        <div className="mt-1.5">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${node.risk_score}%`, backgroundColor: riskColor(node.risk_score) }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {(data.nodes || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-12">No network connections found</p>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="space-y-4">
            {/* Selected node details */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {selectedNode ? 'Node Details' : 'Select a Node'}
              </h3>
              {selectedNode ? (
                <div className="space-y-3">
                  {[
                    ['Name', selectedNode.name],
                    ['Type', (selectedNode.type || '-').replace(/_/g, ' ')],
                    ['ID', selectedNode.customer_number || selectedNode.id],
                    ['Risk Score', selectedNode.risk_score ?? '-'],
                    ['Risk Category', selectedNode.risk_category],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="text-sm font-medium text-slate-700 capitalize">{(value ?? '-').toString().replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                  {selectedNode.risk_category && (
                    <div className="pt-1">
                      <Badge text={selectedNode.risk_category} colors={riskColors[selectedNode.risk_category] || 'bg-gray-100 text-gray-800'} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Click on a node to see details</p>
              )}
            </div>

            {/* Relationships table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Relationships ({data.edges?.length || 0})</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(data.edges || []).map((edge, i) => {
                  const sourceNode = data.nodes?.find(n => n.id === edge.source)
                  const targetNode = data.nodes?.find(n => n.id === edge.target)
                  return (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-slate-700 truncate">{sourceNode?.name || edge.source}</span>
                        <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate">{targetNode?.name || edge.target}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="capitalize">{(edge.relationship || '').replace(/_/g, ' ')}</span>
                        {edge.transaction_count != null && <span>{edge.transaction_count} txns</span>}
                        {edge.total_amount != null && <span>{formatINR(edge.total_amount)}</span>}
                        {edge.strength != null && (
                          <span className="flex items-center gap-0.5">
                            strength: {edge.strength}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {(!data.edges || data.edges.length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-4">No relationships</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Network Analysis</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Search for a customer above to visualize their network of relationships, transaction patterns, and risk connections.
          </p>
        </div>
      )}
    </div>
  )
}
