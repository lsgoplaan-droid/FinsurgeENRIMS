import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Users, ArrowRight, ArrowLeftRight, Building, User, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import api from '../config/api'
import { formatINR, riskColors } from '../utils/formatters'

const Badge = ({ text, colors }: { text: string; colors: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>{text.replace(/_/g, ' ')}</span>
)

interface NetworkNode {
  id: string
  name?: string
  label?: string
  type?: string
  customer_type?: string
  risk_score?: number
  risk_category?: string
  customer_number?: string
  pep_status?: boolean
  is_center?: boolean
  // Layout positions
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface NetworkEdge {
  source: string
  target: string
  type?: string
  relationship?: string
  label?: string
  strength?: number
  detail?: string
  transaction_count?: number
  total_amount?: number
}

function nodeName(n: NetworkNode): string {
  return n.name || n.label || n.customer_number || '?'
}

function edgeLabel(e: NetworkEdge): string {
  return (e.relationship || e.label || e.type || '').replace(/_/g, ' ')
}

function nodeInitials(n: NetworkNode): string {
  const name = nodeName(n)
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function riskColor(score: number): string {
  if (score >= 75) return '#ef4444'
  if (score >= 50) return '#f97316'
  if (score >= 25) return '#f59e0b'
  return '#10b981'
}

function riskColorLight(score: number): string {
  if (score >= 75) return '#fecaca'
  if (score >= 50) return '#fed7aa'
  if (score >= 25) return '#fef08a'
  return '#bbf7d0'
}

function edgeColor(edge: NetworkEdge): string {
  const t = (edge.relationship || edge.type || '').toLowerCase()
  if (t.includes('suspicious') || t.includes('fraud')) return '#ef4444'
  if (t.includes('transaction') || t.includes('fund')) return '#3b82f6'
  if (t.includes('family') || t.includes('relative')) return '#8b5cf6'
  if (t.includes('business') || t.includes('partner')) return '#f59e0b'
  if (t.includes('account') || t.includes('shared')) return '#06b6d4'
  return '#94a3b8'
}

// Simple force-directed layout
function computeLayout(nodes: NetworkNode[], edges: NetworkEdge[], centerId: string | undefined, width: number, height: number): NetworkNode[] {
  const cx = width / 2, cy = height / 2
  const positioned = nodes.map((n, i) => {
    if (n.id === centerId) {
      return { ...n, x: cx, y: cy, vx: 0, vy: 0 }
    }
    const angle = (2 * Math.PI * i) / Math.max(nodes.length - 1, 1)
    const radius = Math.min(width, height) * 0.32
    return {
      ...n,
      x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
    }
  })

  // Run force simulation for a fixed number of iterations
  const nodeMap = new Map(positioned.map(n => [n.id, n]))
  for (let iter = 0; iter < 80; iter++) {
    const alpha = 0.3 * (1 - iter / 80)

    // Repulsion between all nodes
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i], b = positioned[j]
        let dx = (b.x || 0) - (a.x || 0)
        let dy = (b.y || 0) - (a.y || 0)
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 8000 / (dist * dist)
        dx = (dx / dist) * force * alpha
        dy = (dy / dist) * force * alpha
        if (a.id !== centerId) { a.x = (a.x || 0) - dx; a.y = (a.y || 0) - dy }
        if (b.id !== centerId) { b.x = (b.x || 0) + dx; b.y = (b.y || 0) + dy }
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.source)
      const b = nodeMap.get(edge.target)
      if (!a || !b) continue
      let dx = (b.x || 0) - (a.x || 0)
      let dy = (b.y || 0) - (a.y || 0)
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const idealDist = 150
      const force = (dist - idealDist) * 0.01 * alpha
      dx = (dx / dist) * force
      dy = (dy / dist) * force
      if (a.id !== centerId) { a.x = (a.x || 0) + dx; a.y = (a.y || 0) + dy }
      if (b.id !== centerId) { b.x = (b.x || 0) - dx; b.y = (b.y || 0) - dy }
    }

    // Center gravity
    for (const n of positioned) {
      if (n.id === centerId) continue
      n.x = (n.x || 0) + (cx - (n.x || 0)) * 0.01 * alpha
      n.y = (n.y || 0) + (cy - (n.y || 0)) * 0.01 * alpha
    }

    // Keep in bounds
    const pad = 50
    for (const n of positioned) {
      if (n.id === centerId) continue
      n.x = Math.max(pad, Math.min(width - pad, n.x || 0))
      n.y = Math.max(pad, Math.min(height - pad, n.y || 0))
    }
  }

  return positioned
}

// SVG Network Graph Component
function NetworkGraph({
  nodes, edges, center, selectedNode, onSelectNode
}: {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  center?: NetworkNode
  selectedNode: NetworkNode | null
  onSelectNode: (n: NetworkNode | null) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const width = 900, height = 600

  const positioned = computeLayout(nodes, edges, center?.id, width, height)
  const nodeMap = new Map(positioned.map(n => [n.id, n]))

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.graph-node')) return
    setDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const handleMouseUp = () => setDragging(false)

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 bg-white rounded-lg shadow border border-slate-200 hover:bg-slate-50"><ZoomIn size={14} /></button>
        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))} className="p-1.5 bg-white rounded-lg shadow border border-slate-200 hover:bg-slate-50"><ZoomOut size={14} /></button>
        <button onClick={resetView} className="p-1.5 bg-white rounded-lg shadow border border-slate-200 hover:bg-slate-50"><Maximize2 size={14} /></button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full bg-slate-900 rounded-lg cursor-grab active:cursor-grabbing"
        style={{ minHeight: 500 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Arrow markers */}
          <marker id="arrow-default" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
          {edges.map((e, i) => (
            <marker key={`arrow-${i}`} id={`arrow-${i}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor(e)} />
            </marker>
          ))}
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Animated flow dash */}
          <style>{`
            @keyframes flowDash { to { stroke-dashoffset: -40; } }
            .flow-line { animation: flowDash 2s linear infinite; }
          `}</style>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Grid dots */}
          {Array.from({ length: 20 }).map((_, i) =>
            Array.from({ length: 14 }).map((_, j) => (
              <circle key={`g-${i}-${j}`} cx={i * 50} cy={j * 50} r="0.8" fill="#1e293b" />
            ))
          )}

          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodeMap.get(edge.source)
            const tgt = nodeMap.get(edge.target)
            if (!src || !tgt) return null

            const sx = src.x || 0, sy = src.y || 0
            const tx = tgt.x || 0, ty = tgt.y || 0
            const dx = tx - sx, dy = ty - sy
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const nodeR = src.id === center?.id ? 30 : 22
            const tgtR = tgt.id === center?.id ? 30 : 22

            // Shorten line to stop at node edge
            const x1 = sx + (dx / dist) * nodeR
            const y1 = sy + (dy / dist) * nodeR
            const x2 = tx - (dx / dist) * tgtR
            const y2 = ty - (dy / dist) * tgtR

            // Midpoint for label and curve
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
            const col = edgeColor(edge)
            const isSelected = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id)
            const opacity = selectedNode ? (isSelected ? 1 : 0.15) : 0.6

            // Amount label
            const amtLabel = edge.total_amount ? `${(edge.total_amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}` : ''
            const relLabel = edgeLabel(edge)

            return (
              <g key={`edge-${i}`} opacity={opacity}>
                {/* Base line */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={isSelected ? 2.5 : 1.5} strokeOpacity={0.5} markerEnd={`url(#arrow-${i})`} />
                {/* Animated flow */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={isSelected ? 2.5 : 1.5} strokeDasharray="8 32" className="flow-line" />
                {/* Edge label bg */}
                {(relLabel || amtLabel) && (
                  <g>
                    <rect x={mx - 50} y={my - 14} width={100} height={amtLabel ? 26 : 16} rx="4" fill="#0f172a" fillOpacity="0.85" />
                    <text x={mx} y={my - 2} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">{relLabel}</text>
                    {amtLabel && <text x={mx} y={my + 9} textAnchor="middle" fill={col} fontSize="8" fontWeight="bold" fontFamily="sans-serif">{amtLabel}</text>}
                  </g>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {positioned.map(node => {
            const isCenter = node.id === center?.id
            const isSelected = selectedNode?.id === node.id
            const r = isCenter ? 30 : 22
            const score = node.risk_score || 0
            const fill = isCenter ? '#3b82f6' : riskColor(score)
            const lightFill = isCenter ? '#93c5fd' : riskColorLight(score)
            const dimmed = selectedNode && !isSelected && !edges.some(e => (e.source === selectedNode.id && e.target === node.id) || (e.target === selectedNode.id && e.source === node.id)) && node.id !== selectedNode.id

            return (
              <g
                key={node.id}
                className="graph-node cursor-pointer"
                onClick={() => onSelectNode(isSelected ? null : node)}
                opacity={dimmed ? 0.2 : 1}
              >
                {/* Pulse for high risk */}
                {score >= 70 && !isCenter && (
                  <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4">
                    <animate attributeName="r" from={String(r + 4)} to={String(r + 14)} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Selection ring */}
                {isSelected && <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" />}
                {/* Outer ring */}
                <circle cx={node.x} cy={node.y} r={r + 2} fill={lightFill} fillOpacity="0.3" />
                {/* Main circle */}
                <circle cx={node.x} cy={node.y} r={r} fill={fill} stroke={isSelected ? '#fff' : isCenter ? '#60a5fa' : fill} strokeWidth={isCenter ? 3 : 2} filter={isCenter ? 'url(#glow)' : undefined} />
                {/* Icon/initials */}
                <text x={node.x} y={(node.y || 0) + (isCenter ? 1 : 1)} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={isCenter ? 14 : 10} fontWeight="bold" fontFamily="sans-serif">
                  {nodeInitials(node)}
                </text>
                {/* Label */}
                <text x={node.x} y={(node.y || 0) + r + 14} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontFamily="sans-serif">
                  {nodeName(node).length > 18 ? nodeName(node).slice(0, 16) + '...' : nodeName(node)}
                </text>
                {/* Risk score badge */}
                {!isCenter && score > 0 && (
                  <g>
                    <rect x={(node.x || 0) + r - 8} y={(node.y || 0) - r - 2} width="20" height="12" rx="6" fill={fill} />
                    <text x={(node.x || 0) + r + 2} y={(node.y || 0) - r + 7} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">{score}</text>
                  </g>
                )}
                {/* PEP badge */}
                {node.pep_status && (
                  <g>
                    <rect x={(node.x || 0) - r} y={(node.y || 0) - r - 2} width="22" height="12" rx="6" fill="#8b5cf6" />
                    <text x={(node.x || 0) - r + 11} y={(node.y || 0) - r + 7} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="sans-serif">PEP</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

// NxN Flow Matrix
function FlowMatrix({ nodes, edges, center }: { nodes: NetworkNode[]; edges: NetworkEdge[]; center?: NetworkNode }) {
  // Build NxN matrix showing flows between nodes
  const nodeList = [
    ...(center ? [center] : []),
    ...nodes.filter(n => n.id !== center?.id).slice(0, 9), // limit to 10 nodes
  ]
  const nodeIds = nodeList.map(n => n.id)

  const getFlow = (fromId: string, toId: string): number => {
    const edge = edges.find(e => e.source === fromId && e.target === toId)
    return edge?.total_amount || 0
  }

  const maxFlow = Math.max(1, ...edges.map(e => e.total_amount || 0))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Fund Flow Matrix (NxN)</h3>
      <table className="text-[10px] w-full">
        <thead>
          <tr>
            <th className="py-1 px-1.5 text-left text-slate-500 font-medium">From \ To</th>
            {nodeList.map(n => (
              <th key={n.id} className="py-1 px-1.5 text-center text-slate-500 font-medium max-w-[70px] truncate" title={nodeName(n)}>
                {nodeName(n).split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodeList.map(from => (
            <tr key={from.id} className="border-t border-slate-50">
              <td className="py-1 px-1.5 font-medium text-slate-600 whitespace-nowrap max-w-[80px] truncate" title={nodeName(from)}>
                {nodeName(from).split(' ')[0]}
              </td>
              {nodeList.map(to => {
                const flow = getFlow(from.id, to.id)
                const intensity = flow / maxFlow
                const bg = from.id === to.id
                  ? 'bg-slate-100'
                  : flow > 0
                    ? `rgba(59,130,246,${0.1 + intensity * 0.6})`
                    : ''
                return (
                  <td
                    key={to.id}
                    className="py-1 px-1.5 text-center font-mono"
                    style={{ backgroundColor: from.id === to.id ? '#f1f5f9' : flow > 0 ? `rgba(59,130,246,${0.1 + intensity * 0.6})` : undefined }}
                    title={flow > 0 ? `${nodeName(from)} → ${nodeName(to)}: ₹${(flow / 100).toLocaleString('en-IN')}` : ''}
                  >
                    {from.id === to.id ? (
                      <span className="text-slate-300">—</span>
                    ) : flow > 0 ? (
                      <span className="text-white font-bold" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                        {flow >= 10000000 ? `${(flow / 10000000).toFixed(1)}Cr` : flow >= 100000 ? `${(flow / 100000).toFixed(1)}L` : `${(flow / 100).toFixed(0)}`}
                      </span>
                    ) : (
                      <span className="text-slate-200">·</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9px] text-slate-400 mt-2">Cell intensity indicates relative flow volume. Amounts in INR.</p>
    </div>
  )
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
      const searchRes = await api.get('/customers', { params: { search: searchQuery, page_size: 1 } })
      const customers = searchRes.data.items || searchRes.data.data || searchRes.data.customers || []
      if (customers.length === 0) {
        setError('No customer found matching the search query')
        setLoading(false)
        return
      }
      const cid = customers[0].id
      setCustomerId(cid)
      const graphRes = await api.get(`/network/${cid}/graph`)
      setData(graphRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load network data')
    } finally {
      setLoading(false)
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
              placeholder="Search for a customer by name or CIF number (e.g. Rajesh Mehta, CIF-1001)..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Network'}
          </button>
        </form>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Building network graph...</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-3 px-5">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">Network Analysis</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 ml-4">
              <span><strong className="text-blue-600">{data.nodes?.length || 0}</strong> entities</span>
              <span><strong className="text-indigo-600">{data.edges?.length || 0}</strong> connections</span>
              <span><strong className="text-red-600">{(data.nodes || []).filter(n => (n.risk_score || 0) >= 70).length}</strong> high-risk</span>
              <span><strong className="text-purple-600">{(data.nodes || []).filter(n => n.pep_status).length}</strong> PEP</span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 ml-auto text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Network Graph */}
            <div className="xl:col-span-2">
              <NetworkGraph
                nodes={data.nodes || []}
                edges={data.edges || []}
                center={data.center}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
            </div>

            {/* Details panel */}
            <div className="space-y-4">
              {/* Selected node details */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {selectedNode ? 'Entity Details' : 'Select a Node'}
                </h3>
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: selectedNode.id === data.center?.id ? '#3b82f6' : riskColor(selectedNode.risk_score || 0) }}>
                        {nodeInitials(selectedNode)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{nodeName(selectedNode)}</p>
                        <p className="text-xs text-slate-400 capitalize">{(selectedNode.customer_type || selectedNode.type || '').replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {[
                      ['CIF', selectedNode.customer_number || selectedNode.id.slice(0, 8)],
                      ['Risk Score', selectedNode.risk_score ?? '-'],
                      ['Risk Category', selectedNode.risk_category],
                      ['PEP Status', selectedNode.pep_status ? 'Yes' : 'No'],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between py-1 border-b border-slate-50 last:border-0">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-xs font-medium text-slate-700 capitalize">{(value ?? '-').toString().replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                    {selectedNode.risk_category && (
                      <Badge text={selectedNode.risk_category} colors={riskColors[selectedNode.risk_category] || 'bg-gray-100 text-gray-800'} />
                    )}

                    {/* Connections for this node */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Direct Connections</p>
                      <div className="space-y-1">
                        {(data.edges || []).filter(e => e.source === selectedNode.id || e.target === selectedNode.id).map((e, i) => {
                          const otherId = e.source === selectedNode.id ? e.target : e.source
                          const other = (data.nodes || []).find(n => n.id === otherId)
                          return (
                            <div key={i} className="flex items-center justify-between text-[10px] p-1.5 bg-slate-50 rounded">
                              <span className="text-slate-600">{other ? nodeName(other) : '?'}</span>
                              <span className="text-slate-400 capitalize">{edgeLabel(e)}</span>
                              {e.total_amount ? <span className="font-mono text-blue-600">{formatINR(e.total_amount)}</span> : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Click on a node in the graph to see details and connections</p>
                )}
              </div>

              {/* Relationships list */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">All Flows ({data.edges?.length || 0})</h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {(data.edges || []).map((edge, i) => {
                    const src = (data.nodes || []).find(n => n.id === edge.source)
                    const tgt = (data.nodes || []).find(n => n.id === edge.target)
                    return (
                      <div key={i} className="p-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-slate-700 truncate">{src ? nodeName(src) : '?'}</span>
                          <ArrowRight size={10} className="text-blue-500 flex-shrink-0" />
                          <span className="font-medium text-slate-700 truncate">{tgt ? nodeName(tgt) : '?'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                          <span className="capitalize">{edgeLabel(edge)}</span>
                          {edge.transaction_count != null && <span>{edge.transaction_count} txns</span>}
                          {edge.total_amount != null && <span className="font-mono text-blue-600">{formatINR(edge.total_amount)}</span>}
                        </div>
                      </div>
                    )
                  })}
                  {(!data.edges || data.edges.length === 0) && (
                    <p className="text-xs text-slate-400 text-center py-4">No relationships found</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* NxN Flow Matrix */}
          <FlowMatrix nodes={data.nodes || []} edges={data.edges || []} center={data.center} />
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Network Analysis</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Search for a customer to visualize their network graph with fund flow analysis, risk connections, and NxN flow matrix.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-slate-400">
            <span>Try: <strong className="text-slate-600">Rajesh Mehta</strong></span>
            <span>or <strong className="text-slate-600">Hassan Trading</strong></span>
            <span>or <strong className="text-slate-600">CIF-1001</strong></span>
          </div>
        </div>
      )}
    </div>
  )
}
