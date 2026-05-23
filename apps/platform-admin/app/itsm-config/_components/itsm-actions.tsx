'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SlaTargets } from '@nzila/itsm-core'

interface SlaProfileOption {
  id: string
  name: string
}

interface NewQueueDialogProps {
  orgId: string
  slaProfiles: SlaProfileOption[]
}

export function NewQueueDialog({ orgId, slaProfiles }: NewQueueDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultSlaId, setDefaultSlaId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/itsm-config/queues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          defaultSlaId: defaultSlaId || null,
          memberIds: [],
          active: true,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed to create queue (${res.status})`)
        return
      }
      setOpen(false)
      setName('')
      setDescription('')
      setDefaultSlaId('')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + New Queue
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">New queue</h2>
            <div>
              <label className="text-xs font-medium text-gray-600">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Default SLA profile</label>
              <select
                value={defaultSlaId}
                onChange={(e) => setDefaultSlaId(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Platform default</option>
                {slaProfiles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create queue'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export function DeleteQueueButton({ orgId, queueId }: { orgId: string; queueId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function onDelete() {
    if (!confirm('Delete this queue? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/itsm-config/queues/${queueId}`, {
        method: 'DELETE',
        headers: { 'x-org-id': orgId },
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        alert(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  )
}

const PRIORITY_KEYS = ['p1_critical', 'p2_high', 'p3_medium', 'p4_low'] as const

interface NewSlaProfileDialogProps {
  orgId: string
  defaults: SlaTargets
}

export function NewSlaProfileDialog({ orgId, defaults }: NewSlaProfileDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [targets, setTargets] = useState<SlaTargets>(defaults)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateTarget(
    priority: (typeof PRIORITY_KEYS)[number],
    field: 'responseMinutes' | 'resolutionMinutes',
    value: number,
  ) {
    setTargets((prev) => ({
      ...prev,
      [priority]: { ...prev[priority], [field]: value },
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/itsm-config/sla-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          targets,
          active: true,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed to create profile (${res.status})`)
        return
      }
      setOpen(false)
      setName('')
      setDescription('')
      setTargets(defaults)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + New Profile
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <form
            onSubmit={submit}
            className="w-full max-w-xl space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">New SLA profile</h2>
            <div>
              <label className="text-xs font-medium text-gray-600">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left">Priority</th>
                  <th className="text-right">Response (min)</th>
                  <th className="text-right">Resolution (min)</th>
                </tr>
              </thead>
              <tbody>
                {PRIORITY_KEYS.map((p) => (
                  <tr key={p}>
                    <td className="py-1.5 font-medium">{p.replace('_', ' ')}</td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={targets[p].responseMinutes}
                        onChange={(e) =>
                          updateTarget(p, 'responseMinutes', Number(e.target.value))
                        }
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={targets[p].resolutionMinutes}
                        onChange={(e) =>
                          updateTarget(p, 'resolutionMinutes', Number(e.target.value))
                        }
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export function DeleteSlaProfileButton({
  orgId,
  slaId,
}: {
  orgId: string
  slaId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function onDelete() {
    if (!confirm('Delete this SLA profile? Queues referencing it will block the delete.'))
      return
    setBusy(true)
    try {
      const res = await fetch(`/api/itsm-config/sla-profiles/${slaId}`, {
        method: 'DELETE',
        headers: { 'x-org-id': orgId },
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        alert(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  )
}

export function ApprovalDecisionButtons({
  orgId,
  approvalId,
  canDecide,
}: {
  orgId: string
  approvalId: string
  canDecide: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: 'approved' | 'rejected') {
    setError(null)
    setBusy(decision === 'approved' ? 'approve' : 'reject')
    try {
      const note = decision === 'rejected' ? prompt('Reason for rejection?') ?? undefined : undefined
      const res = await fetch(`/api/itsm-config/approvals/${approvalId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ decision, decisionNote: note }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (!canDecide) {
    return <span className="text-xs text-gray-400">Not approver</span>
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => decide('approved')}
        disabled={busy !== null}
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => decide('rejected')}
        disabled={busy !== null}
        className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {busy === 'reject' ? '…' : 'Reject'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
