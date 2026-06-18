'use client'

interface PaginationControlsProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

export function PaginationControls({
  page,
  pageCount,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (pageCount <= 1) return null

  return (
    <div className={className ?? 'flex items-center justify-between gap-3 pt-3'}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        Previous
      </button>
      <span className="text-xs text-gray-500 tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        Next
      </button>
    </div>
  )
}
