/**
 * /actions — ExecutiveOS unified approval queue
 *
 * Lists every pending action emitted by any ExecutiveOS agent
 * (Chief of Staff, CFO, RevOps, Platform Reliability, …).
 * Founder approves or rejects with a reason; downstream domain
 * runners (Phases 2–6) execute approved actions.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentUser } from '@nzila/platform-auth/entra/server'
import {
  approveAction,
  getExecutiveOrgId,
  listPendingActions,
  rejectAction,
} from '../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const RISK_BADGE: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  high: 'bg-orange-50 text-orange-800 border-orange-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
}

const CLASS_BADGE: Record<string, string> = {
  insight: 'bg-slate-100 text-slate-700',
  recommendation: 'bg-blue-50 text-blue-800',
  draft_action: 'bg-violet-50 text-violet-800',
}

export default async function ActionsPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()
  const actions = orgId ? await listPendingActions(orgId) : []

  async function handleApprove(formData: FormData) {
    'use server'
    const id = String(formData.get('actionId') ?? '')
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o || !id) return
    await approveAction(o, id, u.id)
    revalidatePath('/actions')
  }

  async function handleReject(formData: FormData) {
    'use server'
    const id = String(formData.get('actionId') ?? '')
    const reason = String(formData.get('reason') ?? '') || undefined
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o || !id) return
    await rejectAction(o, id, u.id, reason)
    revalidatePath('/actions')
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Actions</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pending approvals and recommendations from every ExecutiveOS agent.
          Approve to dispatch; reject to record the rationale.
        </p>
      </header>

      {!orgId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No executive org resolved. Seed a Nzila org to begin.
        </div>
      )}

      {orgId && actions.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-base font-medium text-slate-700">Inbox zero.</p>
          <p className="mt-1 text-sm text-slate-500">
            No pending actions. Run an agent (e.g.{' '}
            <a className="underline" href="/chief-of-staff">
              Chief of Staff
            </a>
            ) to surface new ones.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {actions.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASS_BADGE[a.actionClass] ?? ''}`}>
                    {a.actionClass.replace('_', ' ')}
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-xs font-medium ${RISK_BADGE[a.riskLevel] ?? ''}`}>
                    {a.riskLevel} risk
                  </span>
                  <span className="text-xs text-slate-500">
                    by <code className="rounded bg-slate-100 px-1">{a.agentKey}</code>
                  </span>
                  <span className="text-xs text-slate-500">
                    confidence {Math.round(a.confidence * 100)}%
                  </span>
                  {a.dueDate && (
                    <span className="text-xs text-rose-600">due {a.dueDate}</span>
                  )}
                </div>
                <h2 className="mt-2 text-base font-semibold text-slate-900">{a.title}</h2>
                {a.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.description}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Surfaced {new Date(a.createdAt).toLocaleString('en-CA')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <form action={handleApprove}>
                  <input type="hidden" name="actionId" value={a.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                </form>
                <form action={handleReject} className="flex flex-col gap-1">
                  <input type="hidden" name="actionId" value={a.id} />
                  <input
                    name="reason"
                    placeholder="Reason (optional)"
                    className="w-48 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
