export function formatINR(paise: number): string {
  const ngultrum = paise / 100
  return 'Nu. ' + new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(ngultrum)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-amber-100 text-amber-800 border-amber-200',
  medium: 'bg-blue-100 text-blue-800 border-blue-200',
  low: 'bg-green-100 text-green-800 border-green-200',
}

export const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-purple-100 text-purple-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  under_investigation: 'bg-yellow-100 text-yellow-800',
  escalated: 'bg-orange-100 text-orange-800',
  closed_true_positive: 'bg-red-100 text-red-800',
  closed_false_positive: 'bg-green-100 text-green-800',
  closed_inconclusive: 'bg-gray-100 text-gray-800',
  open: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
  pending_regulatory: 'bg-purple-100 text-purple-800',
}

export const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  very_high: 'bg-red-100 text-red-800',
}
