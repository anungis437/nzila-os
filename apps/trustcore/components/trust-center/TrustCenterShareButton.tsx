'use client'

/**
 * TrustCore — Trust Center Share Button
 *
 * Copies the current Trust Center URL to the clipboard.
 * Shows a brief "Copied!" confirmation.
 */

import { useState } from 'react'
import { LinkIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'

interface TrustCenterShareButtonProps {
  url: string
}

export function TrustCenterShareButton({ url }: TrustCenterShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const fullUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${url}`
        : url
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: silently ignore if clipboard unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
      title="Copy link to Trust Center"
    >
      {copied ? (
        <>
          <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-teal-500" />
          Copied!
        </>
      ) : (
        <>
          <LinkIcon className="h-3.5 w-3.5" />
          Copy link
        </>
      )}
    </button>
  )
}
