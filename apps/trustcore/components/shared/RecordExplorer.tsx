'use client'

import React, { useState, useMemo } from 'react'

export interface FilterOption {
  value: string
  label: string
}

export interface Filter<T> {
  id: string
  label: string
  options: FilterOption[]
  matches: (record: T, value: string) => boolean
}

export interface Column<T> {
  id: string
  label: string
  sortValue?: (record: T) => string | number | boolean | Date
  render: (record: T) => React.ReactNode
}

export interface RecordExplorerProps<T> {
  records: T[]
  rowKey: (record: T) => string
  searchPlaceholder?: string
  searchText?: (record: T) => string
  filters?: Filter<T>[]
  columns: Column<T>[]
  drillDownTitle?: (record: T) => string
  renderDrillDown?: (record: T) => React.ReactNode
}

export function RecordExplorer<T>({
  records,
  rowKey,
  searchPlaceholder = 'Search…',
  searchText,
  filters = [],
  columns,
  drillDownTitle,
  renderDrillDown,
}: RecordExplorerProps<T>) {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState<T | null>(null)

  const filtered = useMemo(() => {
    let rows = records

    if (query && searchText) {
      const q = query.toLowerCase()
      rows = rows.filter((r) => searchText(r).toLowerCase().includes(q))
    }

    for (const filter of filters) {
      const val = activeFilters[filter.id]
      if (val) {
        rows = rows.filter((r) => filter.matches(r, val))
      }
    }

    if (sortCol) {
      const col = columns.find((c) => c.id === sortCol)
      if (col?.sortValue) {
        rows = [...rows].sort((a, b) => {
          const av = col.sortValue!(a)
          const bv = col.sortValue!(b)
          if (av < bv) return sortAsc ? -1 : 1
          if (av > bv) return sortAsc ? 1 : -1
          return 0
        })
      }
    }

    return rows
  }, [records, query, searchText, filters, activeFilters, sortCol, sortAsc, columns])

  function handleSort(colId: string) {
    if (sortCol === colId) {
      setSortAsc((prev) => !prev)
    } else {
      setSortCol(colId)
      setSortAsc(true)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {searchText && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        {filters.map((filter) => (
          <select
            key={filter.id}
            value={activeFilters[filter.id] ?? ''}
            onChange={(e) =>
              setActiveFilters((prev) => ({ ...prev, [filter.id]: e.target.value }))
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  onClick={() => col.sortValue && handleSort(col.id)}
                  className={`px-4 py-2 text-left font-medium text-gray-600 ${
                    col.sortValue ? 'cursor-pointer select-none hover:text-gray-900' : ''
                  }`}
                >
                  {col.label}
                  {sortCol === col.id && (
                    <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              {renderDrillDown && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.map((record) => (
              <tr
                key={rowKey(record)}
                className={`transition-colors hover:bg-gray-50 ${
                  selected && rowKey(selected) === rowKey(record) ? 'bg-blue-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.id} className="px-4 py-2 text-gray-700">
                    {col.render(record)}
                  </td>
                ))}
                {renderDrillDown && (
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() =>
                        setSelected(
                          selected && rowKey(selected) === rowKey(record) ? null : record,
                        )
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {selected && rowKey(selected) === rowKey(record) ? 'Close' : 'View'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (renderDrillDown ? 1 : 0)}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && renderDrillDown && (
        <div className="rounded border border-gray-200 bg-white p-4">
          {drillDownTitle && (
            <h3 className="mb-3 text-base font-semibold text-gray-800">
              {drillDownTitle(selected)}
            </h3>
          )}
          {renderDrillDown(selected)}
        </div>
      )}
    </div>
  )
}
