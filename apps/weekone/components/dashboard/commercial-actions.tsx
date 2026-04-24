'use client'

import { useState } from 'react'

export function CommercialActions() {
  const [referralEmail, setReferralEmail] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  async function submitReferral() {
    setStatus(null)
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: referralEmail, source: 'dashboard-referral' }),
    })
    setStatus(res.ok ? 'Referral submitted.' : 'Could not submit referral.')
  }

  async function submitInvite() {
    setStatus(null)
    const res = await fetch('/api/collaborators/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: 'editor' }),
    })
    setStatus(res.ok ? 'Invite queued.' : 'Could not queue invite.')
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Growth & Team</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Send referral
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              value={referralEmail}
              onChange={(event) => setReferralEmail(event.target.value)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              placeholder="friend@company.com"
            />
            <button
              type="button"
              onClick={submitReferral}
              className="rounded-md bg-electric px-3 py-1.5 text-xs font-medium text-white"
            >
              Send
            </button>
          </div>
        </label>

        <label className="text-xs text-muted-foreground">
          Invite collaborator
          <div className="mt-1 flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              placeholder="teammate@company.com"
            />
            <button
              type="button"
              onClick={submitInvite}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
            >
              Invite
            </button>
          </div>
        </label>
      </div>

      {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
    </section>
  )
}
