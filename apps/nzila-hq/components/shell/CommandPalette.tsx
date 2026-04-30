'use client'

/**
 * Nzila HQ command palette.
 *
 * - ⌘K / Ctrl+K toggles globally.
 * - Items are sourced from the navigation manifest, filtered by the current
 *   user's RBAC capability set (resolved server-side and passed in as props).
 * - Subsequence + substring scoring (no fuzzy library dep).
 * - Recents persisted in localStorage (max 6) and pinned to top of empty query.
 * - Renders into document.body via a portal-like fixed overlay (no portal dep).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

export interface PaletteItem {
  id: string
  label: string
  href: string
  group: string
  hint?: string
}

const RECENTS_KEY = 'nzila-hq:palette:recents'
const PINS_KEY = 'nzila-hq:palette:pins'
const MAX_RECENTS = 6
const MAX_PINS = 8

export function CommandPalette({ items }: { items: readonly PaletteItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const [pins, setPins] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Hydrate recents on mount — this is a legitimate external-store sync
  // (localStorage → React) and matches the documented exception for
  // syncing external systems on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time external store hydration
          setRecents(parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENTS))
        }
      }
    } catch {
      // localStorage unavailable / corrupt — ignore.
    }
    try {
      const raw = localStorage.getItem(PINS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
           
          setPins(parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_PINS))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Global hotkey.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Reset query/cursor when the palette opens; this is a one-shot
  // synchronization with the open/closed external state.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open transition
      setQuery('')
      setActive(0)
      // Small delay so the input has mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open])

  const ranked = useMemo(() => rankItems(items, query, recents, pins), [items, query, recents, pins])

  // Keep the active cursor in range when the result set shrinks.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp cursor to valid range
    if (active >= ranked.length) setActive(0)
  }, [ranked, active])

  const select = useCallback(
    (item: PaletteItem) => {
      try {
        const next = [item.id, ...recents.filter((id) => id !== item.id)].slice(0, MAX_RECENTS)
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      setOpen(false)
      router.push(item.href)
    },
    [recents, router],
  )

  const togglePin = useCallback((id: string) => {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, MAX_PINS)
      try {
        localStorage.setItem(PINS_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(0, ranked.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = ranked[active]
      if (item) select(item)
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Jump to
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search routes (try 'pipe', 'fin', 'dep')…"
            className="flex-1 border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {ranked.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-slate-500">No matches.</li>
          ) : (
            ranked.map((item, i) => (
              <li key={item.id}>
                <div
                  className={cn(
                    'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition',
                    i === active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  )}
                  onMouseEnter={() => setActive(i)}
                >
                  <button
                    type="button"
                    onClick={() => select(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    {item.hint && (
                      <span
                        className={cn(
                          'truncate text-[11px]',
                          i === active ? 'text-slate-300' : 'text-slate-400',
                        )}
                      >
                        {item.hint}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePin(item.id) }}
                    aria-label={pins.includes(item.id) ? 'Unpin' : 'Pin'}
                    title={pins.includes(item.id) ? 'Unpin' : 'Pin'}
                    className={cn(
                      'mr-2 shrink-0 rounded px-1.5 py-0.5 text-xs',
                      pins.includes(item.id)
                        ? 'text-amber-400'
                        : i === active ? 'text-slate-400 hover:text-amber-300' : 'text-slate-300 hover:text-amber-500',
                    )}
                  >
                    {pins.includes(item.id) ? '★' : '☆'}
                  </button>
                  <span
                    className={cn(
                      'ml-1 shrink-0 text-[10px] uppercase tracking-wider',
                      i === active ? 'text-slate-300' : 'text-slate-400',
                    )}
                  >
                    {item.group}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>↑ ↓ navigate · ↵ open · esc close</span>
          <span>
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
              ⌘
            </kbd>{' '}
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-slate-200">
              K
            </kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Scoring ────────────────────────────────────────────────────────────────

function rankItems(
  items: readonly PaletteItem[],
  query: string,
  recents: readonly string[],
  pins: readonly string[],
): PaletteItem[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    // Empty query — pinned first, then recents, then the rest.
    const pinItems = pins
      .map((id) => items.find((it) => it.id === id))
      .filter((it): it is PaletteItem => Boolean(it))
    const pinIds = new Set(pinItems.map((it) => it.id))
    const recentItems = recents
      .map((id) => items.find((it) => it.id === id))
      .filter((it): it is PaletteItem => Boolean(it))
      .filter((it) => !pinIds.has(it.id))
    const seen = new Set([...pinItems, ...recentItems].map((it) => it.id))
    const rest = items.filter((it) => !seen.has(it.id))
    return [...pinItems, ...recentItems, ...rest]
  }
  const scored = items
    .map((it) => ({ it, score: scoreItem(it, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map((x) => x.it)
}

/** Subsequence (10/char) + substring (50) + prefix bonus (40). */
function scoreItem(item: PaletteItem, q: string): number {
  const haystack = `${item.label} ${item.hint ?? ''} ${item.group}`.toLowerCase()
  let score = 0
  if (haystack.startsWith(q)) score += 40
  if (haystack.includes(q)) score += 50
  // Subsequence over label only, weighted higher.
  const label = item.label.toLowerCase()
  let qi = 0
  for (let i = 0; i < label.length && qi < q.length; i++) {
    if (label[i] === q[qi]) {
      score += 10
      qi++
    }
  }
  if (qi < q.length) {
    // Didn't match the full query as a subsequence of the label — only count
    // substring matches above.
    score = haystack.includes(q) ? score : 0
  }
  return score
}
