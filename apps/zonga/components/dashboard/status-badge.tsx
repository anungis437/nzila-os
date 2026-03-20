/**
 * Unified status badge for Zonga dashboard pages.
 *
 * Renders a pill with a coloured dot + label. Accepts any entity's
 * status string and normalises it to a human-readable label.
 */

const PALETTE: Record<string, { dot: string; bg: string; text: string }> = {
  // ── Creator ──────────────────────────────────────────────
  active:             { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  pending:            { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  suspended:          { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  inactive:           { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },
  onboarding:         { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },

  // ── Content Asset ────────────────────────────────────────
  draft:              { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-700' },
  published:          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  unpublished:        { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },
  archived:           { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },
  processing:         { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  encoding:           { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  ready:              { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },

  // ── Release ──────────────────────────────────────────────
  scheduled:          { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  released:           { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  takedown:           { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },

  // ── Payout ───────────────────────────────────────────────
  preview:            { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-700' },
  approved:           { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  disbursed:          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  failed:             { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  on_hold:            { dot: 'bg-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700' },

  // ── Moderation ───────────────────────────────────────────
  open:               { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  under_review:       { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  resolved:           { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  escalated:          { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  dismissed:          { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },

  // ── Events & Tickets ─────────────────────────────────────
  upcoming:           { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  live:               { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  completed:          { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-600' },
  cancelled:          { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  sold_out:           { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700' },
  purchased:          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  refunded:           { dot: 'bg-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700' },

  // ── Revenue ──────────────────────────────────────────────
  stream:             { dot: 'bg-cyan-400',    bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  download:           { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  sale:               { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  sync_license:       { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700' },
  tip:                { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
}

const FALLBACK = { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }

function humanise(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: string
  className?: string
}) {
  const key = status.toLowerCase()
  const palette = PALETTE[key] ?? FALLBACK

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${palette.bg} ${palette.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
      {humanise(key)}
    </span>
  )
}
