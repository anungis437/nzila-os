/**
 * Unified status badge used across all detail pages.
 *
 * Renders a pill with a coloured dot + label. Accepts any entity's
 * status string and normalises it to a human-readable label.
 */

const PALETTE: Record<string, { dot: string; bg: string; text: string }> = {
  // ── Order ────────────────────────────────────────────────
  created:            { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-700' },
  confirmed:          { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  fulfillment:        { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  shipped:            { dot: 'bg-cyan-400',    bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  delivered:          { dot: 'bg-green-400',   bg: 'bg-green-50',   text: 'text-green-700' },
  completed:          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelled:          { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  return_requested:   { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  needs_attention:    { dot: 'bg-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700' },

  // ── Quote (uppercase keys normalised) ────────────────────
  draft:              { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-700' },
  internal_review:    { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  sent_to_client:     { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700' },
  revision_requested: { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  accepted:           { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  deposit_required:   { dot: 'bg-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700' },
  ready_for_po:       { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  in_production:      { dot: 'bg-cyan-400',    bg: 'bg-cyan-50',    text: 'text-cyan-700' },
  closed:             { dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-600' },
  expired:            { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },
  pricing:            { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  ready:              { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  sent:               { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700' },
  reviewing:          { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  declined:           { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },

  // ── Purchase Order ───────────────────────────────────────
  pending_approval:    { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  approved:            { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  ordered:             { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  partially_received:  { dot: 'bg-electric',    bg: 'bg-electric/10',text: 'text-electric' },
  partial_received:    { dot: 'bg-electric',    bg: 'bg-electric/10',text: 'text-electric' },
  received:            { dot: 'bg-green-400',   bg: 'bg-green-50',   text: 'text-green-700' },
  acknowledged:        { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },

  // ── Invoice ──────────────────────────────────────────────
  unpaid:   { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  paid:     { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  overdue:  { dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-700' },
  void:     { dot: 'bg-gray-300',    bg: 'bg-gray-50',    text: 'text-gray-500' },

  // ── Production stages ────────────────────────────────────
  pending_proof:  { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  proof_sent:     { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  proof_approved: { dot: 'bg-violet-400',  bg: 'bg-violet-50',  text: 'text-violet-700' },
  quality_check:  { dot: 'bg-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  ready_to_ship:  { dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
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
