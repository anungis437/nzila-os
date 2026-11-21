/**
 * CFO — Compose Message Form (Client Component).
 */
'use client'

import { useState, useTransition } from 'react'
import { Loader2, CheckCircle2, X } from 'lucide-react'
import { sendMessage } from '@/lib/actions/misc-actions'

interface Props {
  onClose: () => void
}

export function ComposeMessageForm({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const to = fd.get('to') as string
    const subject = fd.get('subject') as string
    const body = fd.get('body') as string

    if (!to.trim() || !subject.trim() || !body.trim()) return

    startTransition(async () => {
      const result = await sendMessage({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      })
      if (result.success) {
        setSuccess(true)
        setTimeout(onClose, 1200)
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500" />
        <p className="text-sm font-medium text-foreground">Message recorded</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-poppins text-sm font-semibold text-foreground">Compose Message</h3>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-secondary">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <input
        name="to"
        placeholder="To (active member user ID)"
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
      />
      <input
        name="subject"
        placeholder="Subject"
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
      />
      <textarea
        name="body"
        placeholder="Message…"
        rows={4}
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
