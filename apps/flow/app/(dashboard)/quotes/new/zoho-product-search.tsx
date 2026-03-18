'use client'

/**
 * Zoho Product Search — Inline typeahead for quote line items.
 *
 * Queries /api/zoho/products?q=... and shows a dropdown of matching
 * items from Zoho Inventory. Selecting one fills SKU, description, and unit cost.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MagnifyingGlassIcon,
  CubeIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface ZohoProduct {
  itemId: string
  name: string
  sku: string
  description: string
  rate: number
  unit: string
  stock: number
}

interface ZohoProductSearchProps {
  onSelect: (product: { sku: string; description: string; unitCost: number }) => void
  currentDescription: string
}

export function ZohoProductSearch({ onSelect, currentDescription }: ZohoProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ZohoProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/zoho/products?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (data.message === 'Zoho not configured' || data.message === 'Zoho connection unavailable') {
        setUnavailable(true)
      }
      setResults(data.items ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  function handleSelect(product: ZohoProduct) {
    onSelect({
      sku: product.sku,
      description: product.name,
      unitCost: product.rate,
    })
    setQuery('')
    setOpen(false)
  }

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open && currentDescription) {
            setQuery(currentDescription)
            search(currentDescription)
          }
        }}
        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-electric bg-electric/5 rounded hover:bg-electric/10 transition-colors"
        title="Search Zoho Inventory"
      >
        <MagnifyingGlassIcon className="h-3 w-3" />
        Zoho
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="Search products by name or SKU..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-electric/20 focus:border-electric transition"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {loading && (
              <div className="p-4 text-center text-xs text-gray-400">
                <div className="inline-block h-4 w-4 border-2 border-electric/30 border-t-electric rounded-full animate-spin mr-2" />
                Searching Zoho Inventory...
              </div>
            )}

            {unavailable && !loading && (
              <div className="p-4 flex items-start gap-2 text-xs text-amber-600">
                <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Zoho Inventory not connected</p>
                  <p className="text-amber-500 mt-0.5">Configure ZOHO_ORGANIZATION_ID to enable product search.</p>
                </div>
              </div>
            )}

            {!loading && !unavailable && results.length === 0 && query.length >= 2 && (
              <div className="p-4 text-center text-xs text-gray-400">
                No products found for &ldquo;{query}&rdquo;
              </div>
            )}

            {results.map((product) => (
              <button
                key={product.itemId}
                type="button"
                onClick={() => handleSelect(product)}
                className="w-full text-left px-4 py-3 hover:bg-electric/[0.03] transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="flex items-start gap-2.5">
                  <div className="rounded-lg bg-gray-50 p-1.5 mt-0.5 shrink-0">
                    <CubeIcon className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-gray-400">{product.sku}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-500">${product.rate.toFixed(2)}/{product.unit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        product.stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
