/**
 * Zonga — Branded 404 page.
 */
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b1121] px-4 text-center">
      <span className="mb-6 text-7xl">🎵</span>
      <h1 className="text-4xl font-bold text-white">404 — Track Not Found</h1>
      <p className="mt-4 max-w-md text-lg text-gray-400">
        This page doesn&apos;t exist or the beat has moved. Let&apos;s get you
        back to the music.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-[#3b82f6] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3b82f6]/90"
        >
          Go Home
        </Link>
        <Link
          href="/en-CA/dashboard"
          className="rounded-lg border border-gray-600 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
        >
          Open Dashboard
        </Link>
      </div>
    </div>
  )
}
