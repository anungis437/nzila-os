export function fmtCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

export function fmtCompactCurrency(cents: number): string {
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`
  return `$${dollars.toFixed(0)}`
}

export function fmtPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

export function fmtRelativeDays(iso: string | null, now = new Date()): string {
  if (!iso) return '—'
  const target = new Date(iso).getTime()
  const diffMs = target - now.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
