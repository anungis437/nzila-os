'use client'

import { useState } from 'react'
import { trackClientEvent, WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'landing_newsletter' }),
    })
    const ok = response.ok
    setStatus(ok ? 'done' : 'error')
    if (ok) {
      void trackClientEvent({
        eventName: WEEKONE_ANALYTICS_EVENTS.NEWSLETTER_SUBMIT,
        context: { source: 'landing_newsletter' },
      })
      setEmail('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="text-sm font-semibold text-navy">Weekly founder memo</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="you@company.com"
        />
        <button type="submit" className="rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white">
          Subscribe
        </button>
      </div>
      {status === 'done' && <p className="text-xs text-emerald-700">Subscribed. Check your inbox.</p>}
      {status === 'error' && <p className="text-xs text-red-700">Could not subscribe right now.</p>}
    </form>
  )
}

export function WaitlistSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'landing_waitlist' }),
    })
    const ok = response.ok
    setStatus(ok ? 'done' : 'error')
    if (ok) {
      void trackClientEvent({
        eventName: WEEKONE_ANALYTICS_EVENTS.WAITLIST_SUBMIT,
        context: { source: 'landing_waitlist' },
      })
      setEmail('')
    }
  }

  return (
    <form id="waitlist" onSubmit={submit} className="rounded-2xl border border-electric/20 bg-electric/5 p-5">
      <p className="text-sm font-semibold text-navy">Waitlist mode is active.</p>
      <p className="mt-1 text-xs text-muted-foreground">Drop your email and we will invite you in launch order.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="founder@startup.com"
        />
        <button type="submit" className="rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white">
          Join waitlist
        </button>
      </div>
      {status === 'done' && <p className="mt-2 text-xs text-emerald-700">You are on the list.</p>}
      {status === 'error' && <p className="mt-2 text-xs text-red-700">Could not join waitlist.</p>}
    </form>
  )
}

export function TemplateDownloadCta() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const response = await fetch('/api/templates/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source: 'template_download_landing' }),
    })

    const json = (await response.json().catch(() => null)) as { downloadUrl?: string } | null
    if (response.ok && json?.downloadUrl) {
      setStatus('done')
      void trackClientEvent({
        eventName: WEEKONE_ANALYTICS_EVENTS.TEMPLATE_DOWNLOAD,
        context: { source: 'landing_template' },
      })
      window.location.assign(json.downloadUrl)
      return
    }

    setStatus('error')
  }

  return (
    <form id="template-download" onSubmit={submit} className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-navy">Free template: Founder Monday Reset</p>
      <p className="mt-1 text-xs text-muted-foreground">Get a one-page weekly planner and accountability rhythm template.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="you@company.com"
        />
        <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background">
          Download
        </button>
      </div>
      {status === 'done' && <p className="mt-2 text-xs text-emerald-700">Starting download...</p>}
      {status === 'error' && <p className="mt-2 text-xs text-red-700">Could not generate download link.</p>}
    </form>
  )
}
