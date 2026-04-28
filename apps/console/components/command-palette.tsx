'use client'

/**
 * Console Command Palette (⌘K / Ctrl+K).
 *
 * Pure React + native portal — no cmdk/kbar dep.
 *
 * Capabilities:
 *   - navigate to any nav-config route
 *   - open external app launcher links
 *   - simple fuzzy filter (substring + word-boundary boost)
 *   - keyboard navigation (↑ ↓ Enter Esc)
 *   - mouse hover & click
 *   - opens via ⌘K / Ctrl+K from anywhere in the dashboard
 *
 * Mounted once by the dashboard layout. Receives navGroups + appLinks
 * as plain serializable data.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

export interface PaletteItem {
  id: string
  /** What the user types to find this. Lowercase already. */
  searchText: string
  /** Display label. */
  label: string
  /** Group label rendered above. */
  group: string
  /** Optional secondary line. */
  hint?: string
  /** External? Renders external icon. */
  external?: boolean
  /** Action: either an href or a callback. */
  href?: string
  onSelect?: () => void
}

const RECENTS_KEY = 'console:palette:recents'
const RECENTS_MAX = 6

function loadRecents(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string').slice(0, RECENTS_MAX) : []
  } catch {
    return []
  }
}

function pushRecent(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const cur = loadRecents().filter(x => x !== id)
    cur.unshift(id)
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, RECENTS_MAX)))
  } catch {
    /* storage may be disabled */
  }
}

/**
 * Subsequence + substring scorer. Higher is better. Returns -1 for no match.
 * Combines:
 *  - exact substring (fastest path)
 *  - prefix bonus
 *  - word-boundary bonus
 *  - subsequence fallback (typing 'cmpl' matches 'compliance')
 */
function scoreItem(text: string, q: string): number {
  if (!q) return 1
  const idx = text.indexOf(q)
  if (idx >= 0) {
    let score = 1000 - idx
    if (idx === 0) score += 500
    if (idx > 0 && text[idx - 1] === ' ') score += 250
    return score
  }
  // Subsequence
  let ti = 0
  let qi = 0
  let gaps = 0
  while (ti < text.length && qi < q.length) {
    if (text[ti] === q[qi]) { qi += 1 } else { gaps += 1 }
    ti += 1
  }
  if (qi === q.length) return Math.max(1, 200 - gaps)
  return -1
}

export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  // ── Open/close hotkeys ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ── Reset on open ─────────────────────────────────────────────────────────
  // Legit external-state sync: when the palette opens, clear transient UI.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('')
    setActiveIdx(0)
    // Hydrate recents from localStorage on open (avoids SSR mismatch).
    setRecents(loadRecents())
    // focus next tick so input is in DOM
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  // ── Filter + score ────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Default view: pinned recents on top, then everything else.
      const byId = new Map(items.map(i => [i.id, i]))
      const recentItems = recents
        .map(id => byId.get(id))
        .filter((x): x is PaletteItem => !!x)
        .map(it => ({ ...it, group: 'Recent' }))
      const recentIds = new Set(recentItems.map(r => r.id))
      const rest = items.filter(i => !recentIds.has(i.id)).slice(0, 50 - recentItems.length)
      return [...recentItems, ...rest]
    }
    const scored: Array<{ item: PaletteItem; score: number }> = []
    for (const it of items) {
      const s = scoreItem(it.searchText, q)
      if (s < 0) continue
      const recentBonus = recents.includes(it.id) ? 100 : 0
      const labelBonus = it.label.toLowerCase().includes(q) ? 50 : 0
      scored.push({ item: it, score: s + recentBonus + labelBonus })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 50).map(s => s.item)
  }, [query, items, recents])

  // Reset active when filter changes — derived state reset is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0)
  }, [query])

  const select = useCallback(
    (item: PaletteItem) => {
      setOpen(false)
      pushRecent(item.id)
      if (item.onSelect) {
        item.onSelect()
      } else if (item.href) {
        if (item.external) {
          window.open(item.href, '_blank', 'noopener,noreferrer')
        } else {
          router.push(item.href)
        }
      }
    },
    [router],
  )

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIdx]
      if (item) select(item)
    }
  }

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`)
    if (el && 'scrollIntoView' in el) {
      ;(el as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  // Group results visually
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>()
    for (const it of results) {
      const arr = map.get(it.group) ?? []
      arr.push(it)
      map.set(it.group, arr)
    }
    return [...map.entries()]
  }, [results])

  if (!open) {
    // Render a hidden trigger hint for screen readers + announce hotkey
    return (
      <span className="sr-only">
        Press Control K or Command K to open the command palette.
      </span>
    )
  }

  // SSR guard
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm motion-safe:animate-[fadeIn_120ms_ease-out]" />
      {/* Panel */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search routes, accounts, actions…"
            aria-label="Command palette search"
            className="flex-1 h-12 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500">
            ESC
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">
              No matches
            </li>
          ) : (
            grouped.map(([group, list]) => (
              <li key={group}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {group}
                </div>
                <ul>
                  {list.map(item => {
                    const idx = results.indexOf(item)
                    const active = idx === activeIdx
                    return (
                      <li key={item.id} data-idx={idx} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => select(item)}
                          className={
                            'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition ' +
                            (active ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50')
                          }
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.label}</div>
                            {item.hint ? (
                              <div className="truncate text-xs text-gray-500">{item.hint}</div>
                            ) : null}
                          </div>
                          {item.external ? (
                            <ArrowTopRightOnSquareIcon className="h-4 w-4 flex-none text-gray-400" />
                          ) : (
                            <ArrowRightIcon className="h-4 w-4 flex-none text-gray-400" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>

        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-3">
            <span><kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
          </span>
          <span><kbd className="font-mono">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
