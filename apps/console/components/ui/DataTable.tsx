'use client'

/**
 * Console DataTable — elite operator-grade table.
 *
 * Features (all optional, all opt-in):
 *   - sticky column header with subtle shadow on scroll
 *   - debounced search across configurable fields
 *   - column visibility toggles (persisted to localStorage if `storageKey`)
 *   - sortable columns
 *   - keyboard row navigation (j/k or ↑/↓ to move, Enter to invoke onRowClick)
 *   - CSV export of the current filtered/sorted view
 *   - row click handler (also fires on Enter when keyboard-focused)
 *   - empty state slot
 *
 * Deliberately framework-only — no virtualization library. For tables with
 * >2000 rows, prefer server-side pagination (Console's data is bounded).
 *
 * Server pages pass plain serializable rows; this client component owns
 * all interactivity. Columns are typed via the generic `T`.
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { cn } from './cn'
import { EmptyState } from './EmptyState'

export interface DataTableColumn<T> {
  /** Stable key — also used for sort + visibility persistence. */
  key: string
  /** Header label. */
  header: string
  /** Cell renderer. */
  render: (row: T) => React.ReactNode
  /** Optional sort accessor — return number, string, or Date. */
  sortValue?: (row: T) => number | string | Date | null | undefined
  /** Used for CSV + free-text search. Falls back to JSON.stringify of render output is NOT used (would be unstable). */
  toText?: (row: T) => string
  /** Tailwind width hint — e.g. 'w-32', 'w-48'. */
  width?: string
  /** Right-align numeric columns. */
  align?: 'left' | 'right' | 'center'
  /** Hide by default — user can toggle on. */
  hiddenByDefault?: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  /** Stable per-row id. */
  rowId: (row: T) => string
  /** Fires on click or Enter. */
  onRowClick?: (row: T) => void
  /** Show search box (debounced 200ms). */
  searchable?: boolean
  /** Fields to search across. Defaults to all column `toText` outputs. */
  searchPlaceholder?: string
  /** localStorage key for column visibility persistence. */
  storageKey?: string
  /** CSV export filename (without extension). */
  exportFilename?: string
  /** Empty-state slot. */
  empty?: React.ReactNode
  /** Visual density. */
  density?: 'compact' | 'normal'
  className?: string
  /** aria-label for the table. */
  caption?: string
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function escapeCsv(s: string): string {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, headerRow: string[], dataRows: string[][]): void {
  const lines = [
    headerRow.map(escapeCsv).join(','),
    ...dataRows.map(r => r.map(escapeCsv).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search…',
  storageKey,
  exportFilename = 'export',
  empty,
  density = 'normal',
  className,
  caption,
}: DataTableProps<T>) {
  const tableId = useId()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 200)
  const [sort, setSort] = useState<SortState>(null)
  const [showColPicker, setShowColPicker] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)

  // ── Column visibility ─────────────────────────────────────────────────────
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const c of columns) if (c.hiddenByDefault) initial.add(c.key)
    return initial
  })
  // Hydrate from storage after mount (avoids SSR mismatch). Reading from
  // localStorage and seeding state is the canonical sync-from-external-store
  // pattern; the rule fires but the behavior is intentional.
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = window.localStorage.getItem(`console:datatable:${storageKey}:hidden`)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHiddenCols(new Set(JSON.parse(raw)))
    } catch {
      /* ignore */
    }
  }, [storageKey])
  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(
        `console:datatable:${storageKey}:hidden`,
        JSON.stringify([...hiddenCols]),
      )
    } catch {
      /* ignore */
    }
  }, [hiddenCols, storageKey])

  const visibleCols = useMemo(
    () => columns.filter(c => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  )

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return rows
    const q = debouncedQuery.toLowerCase()
    return rows.filter(r =>
      columns.some(c => {
        const text = c.toText?.(r)
        return text ? text.toLowerCase().includes(q) : false
      }),
    )
  }, [rows, columns, debouncedQuery])

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find(c => c.key === sort.key)
    if (!col?.sortValue) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      const cmp = compareValues(av, bv)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, columns, sort])

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const onKey = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      setFocusedIndex(i => Math.min(sorted.length - 1, i + 1))
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      setFocusedIndex(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && focusedIndex >= 0 && onRowClick) {
      e.preventDefault()
      onRowClick(sorted[focusedIndex])
    }
  }

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex < 0 || !tbodyRef.current) return
    const row = tbodyRef.current.querySelector(`tr[data-row-index="${focusedIndex}"]`)
    if (row && 'scrollIntoView' in row) {
      ;(row as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex])

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const toggleSort = (key: string) => {
    setSort(s => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const onExport = () => {
    const header = visibleCols.map(c => c.header)
    const data = sorted.map(r => visibleCols.map(c => c.toText?.(r) ?? ''))
    downloadCsv(exportFilename, header, data)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {searchable ? (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className="w-full h-9 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <span className="text-xs text-gray-500 tabular-nums">
          {sorted.length === rows.length
            ? `${rows.length} rows`
            : `${sorted.length} of ${rows.length}`}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColPicker(s => !s)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
            aria-haspopup="menu"
            aria-expanded={showColPicker}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Columns
          </button>
          {showColPicker ? (
            <div
              className="absolute right-0 top-10 z-20 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
              role="menu"
            >
              {columns.map(c => {
                const hidden = hiddenCols.has(c.key)
                return (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() =>
                        setHiddenCols(s => {
                          const next = new Set(s)
                          if (hidden) next.delete(c.key)
                          else next.add(c.key)
                          return next
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    {c.header}
                  </label>
                )
              })}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={sorted.length === 0}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table
            id={tableId}
            aria-label={caption}
            className="w-full text-sm"
          >
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/75">
              <tr>
                {visibleCols.map(c => {
                  const isSorted = sort?.key === c.key
                  const sortable = !!c.sortValue
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn(
                        'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 border-b border-gray-200',
                        c.width,
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className="inline-flex items-center gap-1 hover:text-gray-900"
                        >
                          {c.header}
                          {isSorted ? (
                            sort!.dir === 'asc' ? (
                              <ChevronUpIcon className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDownIcon className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody
              ref={tbodyRef}
              tabIndex={onRowClick ? 0 : -1}
              onKeyDown={onRowClick ? onKey : undefined}
              className="focus:outline-none"
            >
              {sorted.map((row, idx) => {
                const id = rowId(row)
                const isFocused = idx === focusedIndex
                return (
                  <tr
                    key={id}
                    data-row-index={idx}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-gray-100 last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-gray-50',
                      isFocused && 'bg-blue-50/50',
                    )}
                  >
                    {visibleCols.map(c => (
                      <td
                        key={c.key}
                        className={cn(
                          density === 'compact' ? 'px-4 py-1.5' : 'px-4 py-2.5',
                          'text-gray-700 align-middle',
                          c.align === 'right' && 'text-right tabular-nums',
                          c.align === 'center' && 'text-center',
                        )}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sorted.length === 0 ? (
            <div className="p-8">
              {empty ?? (
                <EmptyState
                  title={query ? 'No matches' : 'No rows yet'}
                  description={query ? 'Try a different search term.' : 'When data lands here, it will appear in this table.'}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
