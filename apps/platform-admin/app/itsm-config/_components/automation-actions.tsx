'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types mirrored from automation-queries ───────────────────────────────────

type ConditionOperator = 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'older_than_minutes'

type ActionType =
  | 'change_status'
  | 'change_priority'
  | 'assign_queue'
  | 'send_notification'
  | 'escalate'
  | 'create_problem'
  | 'create_ticket'
  | 'webhook'

interface Condition {
  field: string
  operator: ConditionOperator
  value: string
}

interface Action {
  type: ActionType
  payload: string // JSON string
}

interface RuleTemplate {
  name: string
  enabled: boolean
  conditionLogic: 'all' | 'any'
  conditions: ReadonlyArray<{ field: string; operator: ConditionOperator; value: unknown }>
  actions: ReadonlyArray<{ type: ActionType; payload: Record<string, unknown> }>
  cooldownMinutes?: number
}

interface NewAutomationDialogProps {
  orgId: string
  /** Optional template to prefill the form with (e.g. "Use Template" button). */
  initial?: RuleTemplate
  label?: string
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

function parseValue(raw: string): unknown {
  if (raw.trim() === '') return ''
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function NewAutomationDialog({ orgId, initial, label }: NewAutomationDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [conditionLogic, setConditionLogic] = useState<'all' | 'any'>(
    initial?.conditionLogic ?? 'all',
  )
  const [cooldown, setCooldown] = useState<string>(
    initial?.cooldownMinutes != null ? String(initial.cooldownMinutes) : '',
  )
  const [conditions, setConditions] = useState<Condition[]>(
    (initial?.conditions ?? [{ field: '', operator: 'eq', value: '' }]).map((c) => ({
      field: c.field,
      operator: c.operator,
      value: stringifyValue(c.value),
    })),
  )
  const [actions, setActions] = useState<Action[]>(
    (initial?.actions ?? [{ type: 'send_notification', payload: {} }]).map((a) => ({
      type: a.type,
      payload: JSON.stringify(a.payload ?? {}, null, 2),
    })),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setDescription('')
    setEnabled(true)
    setConditionLogic('all')
    setCooldown('')
    setConditions([{ field: '', operator: 'eq', value: '' }])
    setActions([{ type: 'send_notification', payload: '{}' }])
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Parse action payloads — must be valid JSON.
    const parsedActions: Array<{ type: ActionType; payload: Record<string, unknown> }> = []
    for (const a of actions) {
      try {
        const parsed = a.payload.trim() === '' ? {} : JSON.parse(a.payload)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError(`Action payload for "${a.type}" must be a JSON object`)
          return
        }
        parsedActions.push({ type: a.type, payload: parsed as Record<string, unknown> })
      } catch {
        setError(`Action payload for "${a.type}" is not valid JSON`)
        return
      }
    }

    const parsedConditions = conditions
      .filter((c) => c.field.trim().length > 0)
      .map((c) => ({
        field: c.field.trim(),
        operator: c.operator,
        value: parseValue(c.value),
      }))

    if (parsedConditions.length === 0) {
      setError('At least one condition is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/itsm-config/automation-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          enabled,
          conditionLogic,
          conditions: parsedConditions,
          actions: parsedActions,
          cooldownMinutes: cooldown.trim() === '' ? null : Number(cooldown),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? `Failed to create rule (${res.status})`)
        return
      }
      reset()
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          label
            ? 'text-xs text-blue-600 hover:underline'
            : 'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
        }
      >
        {label ?? '+ New Rule'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">
              {initial ? `New rule from template: ${initial.name}` : 'New automation rule'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Condition logic
                </label>
                <select
                  value={conditionLogic}
                  onChange={(e) => setConditionLogic(e.target.value as 'all' | 'any')}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">All conditions (AND)</option>
                  <option value="any">Any condition (OR)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Cooldown (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cooldown}
                  onChange={(e) => setCooldown(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="No cooldown"
                />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Conditions</h3>
                <button
                  type="button"
                  onClick={() =>
                    setConditions([...conditions, { field: '', operator: 'eq', value: '' }])
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add condition
                </button>
              </div>
              <div className="space-y-2">
                {conditions.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      placeholder="field (e.g. priority)"
                      value={c.field}
                      onChange={(e) => {
                        const copy = [...conditions]
                        copy[idx] = { ...c, field: e.target.value }
                        setConditions(copy)
                      }}
                      className="col-span-4 rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <select
                      value={c.operator}
                      onChange={(e) => {
                        const copy = [...conditions]
                        copy[idx] = { ...c, operator: e.target.value as ConditionOperator }
                        setConditions(copy)
                      }}
                      className="col-span-3 rounded border border-gray-300 px-2 py-1.5 text-xs"
                    >
                      <option value="eq">equals</option>
                      <option value="neq">not equals</option>
                      <option value="gte">&ge;</option>
                      <option value="lte">&le;</option>
                      <option value="in">in</option>
                      <option value="older_than_minutes">older than (min)</option>
                    </select>
                    <input
                      placeholder='value (text or JSON, e.g. "p1_critical")'
                      value={c.value}
                      onChange={(e) => {
                        const copy = [...conditions]
                        copy[idx] = { ...c, value: e.target.value }
                        setConditions(copy)
                      }}
                      className="col-span-4 rounded border border-gray-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setConditions(conditions.filter((_, i) => i !== idx))
                      }
                      className="col-span-1 text-xs text-red-500 hover:underline"
                      disabled={conditions.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Actions</h3>
                <button
                  type="button"
                  onClick={() =>
                    setActions([
                      ...actions,
                      { type: 'send_notification', payload: '{}' },
                    ])
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add action
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((a, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={a.type}
                        onChange={(e) => {
                          const copy = [...actions]
                          copy[idx] = { ...a, type: e.target.value as ActionType }
                          setActions(copy)
                        }}
                        className="rounded border border-gray-300 px-2 py-1.5 text-xs"
                      >
                        <option value="change_status">change_status</option>
                        <option value="change_priority">change_priority</option>
                        <option value="assign_queue">assign_queue</option>
                        <option value="send_notification">send_notification</option>
                        <option value="escalate">escalate</option>
                        <option value="create_problem">create_problem</option>
                        <option value="create_ticket">create_ticket</option>
                        <option value="webhook">webhook</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                        className="text-xs text-red-500 hover:underline"
                        disabled={actions.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={a.payload}
                      onChange={(e) => {
                        const copy = [...actions]
                        copy[idx] = { ...a, payload: e.target.value }
                        setActions(copy)
                      }}
                      rows={3}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
                      placeholder='{"channel":"sms","template":"vip_p1_alert"}'
                    />
                  </div>
                ))}
              </div>
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
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Create rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

// ── Toggle / Delete ──────────────────────────────────────────────────────────

interface RuleActionsProps {
  orgId: string
  ruleId: string
  enabled: boolean
}

export function RuleActions({ orgId, ruleId, enabled }: RuleActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null)

  async function toggle() {
    setBusy('toggle')
    try {
      await fetch(`/api/itsm-config/automation-rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ enabled: !enabled }),
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!confirm('Delete this rule?')) return
    setBusy('delete')
    try {
      await fetch(`/api/itsm-config/automation-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy !== null}
        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        {enabled ? 'Disable' : 'Enable'}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="text-xs text-red-500 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}
