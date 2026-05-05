/**
 * TrustCore — Action Center (Reminders)
 *
 * Displays grouped reminders: critical alerts, overdue, due soon, and
 * recommended actions. Auditor role can view but not act.
 */

'use client'

import { useState } from 'react'
import {
  ExclamationCircleIcon,
  ClockIcon,
  BellAlertIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import type { TrustcoreReminder } from '@nzila/db/queries/trustcore'

// ── Types ──────────────────────────────────────────────────────────────────

interface ActionCenterProps {
  reminders: TrustcoreReminder[]
  canAct: boolean
  /** Current timestamp snapshot (ms). Avoids Date.now() calls in render. */
  nowMs: number
}

// ── Severity helpers ───────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  high: 'bg-orange-50 border-orange-200 text-orange-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
}

function formatDueDate(dueAt: Date, now: number): string {
  const diff = dueAt.getTime() - now
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days}d`
}

// ── Reminder card ──────────────────────────────────────────────────────────

function ReminderCard({
  reminder,
  canAct,
  nowMs,
  onAction,
}: {
  reminder: TrustcoreReminder
  canAct: boolean
  nowMs: number
  onAction: (id: string, action: 'complete' | 'dismiss') => void
}) {
  const [loading, setLoading] = useState(false)
  const dueText = reminder.dueAt ? formatDueDate(reminder.dueAt, nowMs) : null
  const isOverdue = reminder.dueAt !== null && reminder.dueAt.getTime() < nowMs
  const colorClass = SEVERITY_COLORS[reminder.severity] ?? SEVERITY_COLORS.medium!
  const badgeClass = SEVERITY_BADGE[reminder.severity] ?? SEVERITY_BADGE.medium!

  function handleAction(action: 'complete' | 'dismiss') {
    setLoading(true)
    onAction(reminder.id, action)
    setLoading(false)
  }

  return (
    <div className={`border rounded-lg p-4 ${colorClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${badgeClass}`}>
              {reminder.severity}
            </span>
            {dueText && (
              <span className={`text-xs font-medium ${isOverdue ? 'text-red-700' : 'text-gray-600'}`}>
                {isOverdue && '⚠️ '}{dueText}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">{reminder.title}</p>
          {reminder.description && (
            <p className="text-xs text-gray-600 leading-relaxed">{reminder.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {reminder.actionUrl && (
            <a
              href={reminder.actionUrl}
              className="p-1.5 rounded text-gray-500 hover:text-teal-700 hover:bg-white transition"
              title="Go to action"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          )}
          {canAct && !loading && (
            <>
              <button
                type="button"
                onClick={() => handleAction('complete')}
                className="p-1.5 rounded text-gray-500 hover:text-green-700 hover:bg-white transition"
                title="Mark complete"
              >
                <CheckCircleIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAction('dismiss')}
                className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-white transition"
                title="Dismiss"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {loading && (
            <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconClass,
  reminders,
  canAct,
  nowMs,
  onAction,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  reminders: TrustcoreReminder[]
  canAct: boolean
  nowMs: number
  onAction: (id: string, action: 'complete' | 'dismiss') => void
}) {
  if (reminders.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {title} <span className="text-gray-400 font-normal">({reminders.length})</span>
        </h3>
      </div>
      <div className="space-y-2">
        {reminders.map((r) => (
          <ReminderCard key={r.id} reminder={r} canAct={canAct} nowMs={nowMs} onAction={onAction} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function ActionCenter({ reminders: initial, canAct, nowMs }: ActionCenterProps) {
  const [reminders, setReminders] = useState(initial)

  function handleAction(id: string, action: 'complete' | 'dismiss') {
    // Optimistic update
    setReminders((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: action === 'complete' ? ('completed' as const) : ('dismissed' as const) } : r,
      ),
    )

    fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {
      // Revert on failure
      setReminders(initial)
    })
  }

  const active = reminders.filter((r) => r.status === 'open' || r.status === 'overdue')

  if (active.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
        <InformationCircleIcon className="h-8 w-8 text-green-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">No active reminders</p>
          <p className="text-xs text-green-600 mt-0.5">
            Your current obligations are under control.
          </p>
        </div>
      </div>
    )
  }

  const critical = active.filter((r) => r.severity === 'critical')
  const overdue = active.filter(
    (r) => r.dueAt !== null && r.dueAt.getTime() < nowMs && r.severity !== 'critical',
  )
  const dueSoon = active.filter((r) => {
    if (!r.dueAt) return false
    const days = Math.ceil((r.dueAt.getTime() - nowMs) / (24 * 60 * 60 * 1000))
    return days >= 0 && days <= 7 && r.severity !== 'critical'
  })
  const other = active.filter(
    (r) => !critical.includes(r) && !overdue.includes(r) && !dueSoon.includes(r),
  )

  return (
    <div className="space-y-5">
      {!canAct && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <InformationCircleIcon className="h-4 w-4 shrink-0" />
          Auditor view — you can see but not complete or dismiss reminders.
        </div>
      )}

      <Section
        title="Critical alerts"
        icon={ExclamationCircleIcon}
        iconClass="text-red-500"
        reminders={critical}
        canAct={canAct}
        nowMs={nowMs}
        onAction={handleAction}
      />
      <Section
        title="Overdue"
        icon={BellAlertIcon}
        iconClass="text-orange-500"
        reminders={overdue}
        canAct={canAct}
        nowMs={nowMs}
        onAction={handleAction}
      />
      <Section
        title="Due soon"
        icon={ClockIcon}
        iconClass="text-yellow-500"
        reminders={dueSoon}
        canAct={canAct}
        nowMs={nowMs}
        onAction={handleAction}
      />
      <Section
        title="Recommended actions"
        icon={InformationCircleIcon}
        iconClass="text-blue-500"
        reminders={other}
        canAct={canAct}
        nowMs={nowMs}
        onAction={handleAction}
      />
    </div>
  )
}
