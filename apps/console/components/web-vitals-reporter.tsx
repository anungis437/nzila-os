'use client'

/**
 * Web Vitals reporter.
 *
 * Uses the native PerformanceObserver API — no `web-vitals` dependency.
 * Captures: LCP, FCP, CLS, TTFB, INP (first interaction).
 *
 * Sends batches to /api/_perf/vitals via `sendBeacon` on page unload
 * (with a fallback to fetch keepalive). This keeps the report off the
 * critical render path and survives navigations cleanly.
 *
 * Mounted once by the dashboard layout. Renders nothing.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface QueuedVital {
  name: string
  value: number
  route: string
}

export function WebVitalsReporter() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('PerformanceObserver' in window)) return

    const queue: QueuedVital[] = []
    const route = pathname || '/'

    const flush = () => {
      if (queue.length === 0) return
      const payload = JSON.stringify(queue.splice(0, queue.length))
      try {
        if ('sendBeacon' in navigator) {
          const blob = new Blob([payload], { type: 'application/json' })
          navigator.sendBeacon('/api/_perf/vitals', blob)
        } else {
          void fetch('/api/_perf/vitals', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: payload,
            keepalive: true,
          })
        }
      } catch {
        /* best-effort telemetry; never break the page */
      }
    }

    const observers: PerformanceObserver[] = []
    const safeObserve = (type: string, cb: (entries: PerformanceEntry[]) => void) => {
      try {
        const obs = new PerformanceObserver(list => cb(list.getEntries()))
        obs.observe({ type, buffered: true } as PerformanceObserverInit)
        observers.push(obs)
      } catch {
        /* type not supported in this browser */
      }
    }

    // LCP — last entry wins (largest contentful paint)
    let lcpValue = 0
    safeObserve('largest-contentful-paint', entries => {
      for (const e of entries) {
        const v = (e as PerformanceEntry & { renderTime?: number; loadTime?: number })
        const ts = v.renderTime ?? v.loadTime ?? e.startTime
        if (ts > lcpValue) lcpValue = ts
      }
    })

    // FCP
    safeObserve('paint', entries => {
      for (const e of entries) {
        if (e.name === 'first-contentful-paint') {
          queue.push({ name: 'FCP', value: e.startTime, route })
        }
      }
    })

    // CLS — accumulate session window
    let clsValue = 0
    safeObserve('layout-shift', entries => {
      for (const e of entries) {
        const v = e as PerformanceEntry & { value: number; hadRecentInput?: boolean }
        if (!v.hadRecentInput) clsValue += v.value
      }
    })

    // TTFB — derive from navigation timing
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav && nav.responseStart > 0) {
        queue.push({ name: 'TTFB', value: nav.responseStart, route })
      }
    } catch {
      /* ignore */
    }

    // INP — first interaction proxy via event timing
    let inpReported = false
    safeObserve('event', entries => {
      if (inpReported) return
      for (const e of entries) {
        const dur = (e as PerformanceEntry & { duration: number }).duration
        if (dur > 40) {
          queue.push({ name: 'INP', value: dur, route })
          inpReported = true
          break
        }
      }
    })

    const onHide = () => {
      if (lcpValue > 0) queue.push({ name: 'LCP', value: lcpValue, route })
      if (clsValue > 0) queue.push({ name: 'CLS', value: clsValue * 1000, route })
      flush()
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide()
    })
    window.addEventListener('pagehide', onHide, { once: false })

    return () => {
      onHide()
      for (const obs of observers) {
        try { obs.disconnect() } catch { /* ignore */ }
      }
    }
  }, [pathname])

  return null
}
