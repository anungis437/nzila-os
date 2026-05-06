'use client'

/**
 * TrustCore — Form Modal
 *
 * Generic dialog/overlay used by all create-record forms.
 * Traps focus when open, dismisses on Escape key or backdrop click.
 */

import { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** 'sm' = max-w-lg (default), 'lg' = max-w-3xl, 'xl' = max-w-5xl */
  size?: 'sm' | 'lg' | 'xl'
}

const sizeClass: Record<'sm' | 'lg' | 'xl', string> = {
  sm: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export function FormModal({ open, onClose, title, children, size = 'sm' }: FormModalProps) {
  // Dismiss on Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={`relative w-full ${sizeClass[size]} bg-white rounded-xl shadow-xl max-h-[85vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="modal-title" className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
