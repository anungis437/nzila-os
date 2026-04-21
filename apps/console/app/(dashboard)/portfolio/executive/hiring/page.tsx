/**
 * /portfolio/executive/hiring — Hiring agent surface.
 *
 * Live vs `job_postings` + `job_applications`. These tables use `organization_id`
 * (public organizations axis). Queries return empty when the platform orgId
 * isn't mirrored there yet.
 */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq, desc, inArray } from 'drizzle-orm'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import {
  jobPostings,
  jobApplications,
  executiveAgentRuns,
  executiveAgentInsights,
} from '@nzila/db/schema'
import {
  hiringAgent,
  type HiringSignal,
  type OpenRole,
  type ApplicationBacklog,
} from '@nzila/executive-os'
import { getExecutiveOrgId, runAndPersist } from '../../../../../lib/executive-os'

export const dynamic = 'force-dynamic'

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-50 text-amber-800',
  critical: 'bg-red-50 text-red-800',
}

async function loadSignal(orgId: string): Promise<HiringSignal> {
  const now = new Date()
  const postings = await platformDb
    .select()
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.organizationId, orgId),
        inArray(jobPostings.status, ['active', 'filled', 'closed']),
      ),
    )
    .limit(500)

  const activePostings = postings.filter((p) => p.status === 'active')

  const openRoles: OpenRole[] = activePostings.map((p) => {
    const posted = new Date(p.postedDate)
    const postedDaysAgo = Math.max(0, Math.floor((now.getTime() - posted.getTime()) / 86_400_000))
    const closingInDays = p.closingDate
      ? Math.floor((new Date(p.closingDate).getTime() - now.getTime()) / 86_400_000)
      : null
    return {
      id: p.id,
      title: p.title,
      postedDaysAgo,
      applicationsCount: p.applicationsCount ?? 0,
      closingInDays,
    }
  })

  const openIds = openRoles.map((r) => r.id)
  const apps: Array<typeof jobApplications.$inferSelect> =
    openIds.length > 0
      ? await platformDb
          .select()
          .from(jobApplications)
          .where(
            and(
              eq(jobApplications.organizationId, orgId),
              inArray(jobApplications.jobPostingId, openIds),
            ),
          )
          .limit(2000)
      : []

  const titleByRole = new Map(activePostings.map((p) => [p.id, p.title]))

  const VALID: ReadonlyArray<ApplicationBacklog['status']> = [
    'new',
    'reviewing',
    'interview',
    'offer',
    'rejected',
    'hired',
  ]
  const statusOrNew = (s: string): ApplicationBacklog['status'] =>
    (VALID as readonly string[]).includes(s) ? (s as ApplicationBacklog['status']) : 'new'

  const applications: ApplicationBacklog[] = apps.map((a) => {
    const applied = a.appliedAt ? new Date(a.appliedAt) : now
    const updated = a.updatedAt ? new Date(a.updatedAt) : applied
    return {
      applicationId: a.id,
      roleTitle: titleByRole.get(a.jobPostingId) ?? 'Unknown role',
      status: statusOrNew(a.applicationStatus),
      daysInStatus: Math.max(0, Math.floor((now.getTime() - updated.getTime()) / 86_400_000)),
    }
  })

  return {
    openRoles,
    applications,
    targetDaysToFill: 45,
    newApplicationSlaDays: 5,
  }
}

async function lastInsights(orgId: string) {
  const [run] = await platformDb
    .select()
    .from(executiveAgentRuns)
    .where(and(eq(executiveAgentRuns.orgId, orgId), eq(executiveAgentRuns.agentKey, 'hiring')))
    .orderBy(desc(executiveAgentRuns.startedAt))
    .limit(1)
  if (!run) return { run: null, insights: [] as Array<typeof executiveAgentInsights.$inferSelect> }
  const insights = await platformDb
    .select()
    .from(executiveAgentInsights)
    .where(eq(executiveAgentInsights.runId, run.id))
  return { run, insights }
}

export default async function HiringPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  async function run() {
    'use server'
    const u = await currentUser()
    const o = await getExecutiveOrgId()
    if (!u || !o) return
    const signal = await loadSignal(o)
    await runAndPersist(hiringAgent, { orgId: o, actorId: u.id, triggeredBy: 'manual', input: signal })
    revalidatePath('/portfolio/executive/hiring')
    revalidatePath('/actions')
  }

  const data = orgId ? await lastInsights(orgId) : { run: null, insights: [] }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">Hiring</h1>
        <p className="mt-2 text-sm text-slate-600">Pipeline health. Live vs <code>job_postings</code> + <code>job_applications</code>.</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/portfolio/executive" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">← Portfolio</Link>
      </nav>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hiring agent</h2>
            <p className="text-xs text-slate-500">Every open role has a pipeline.</p>
          </div>
          <form action={run}>
            <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">Run</button>
          </form>
        </div>
        {data.run ? (
          <p className="mt-2 text-xs text-slate-500">Last run {new Date(data.run.startedAt).toLocaleString('en-CA')} · {data.run.durationMs}ms · {data.run.status}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No runs yet.</p>
        )}
        <ul className="mt-4 space-y-3">
          {data.insights.length === 0 && data.run && <li className="text-sm text-slate-500">No insights from last run.</li>}
          {data.insights.map((i) => (
            <li key={i.id} className="rounded border border-slate-100 bg-slate-50/40 p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[i.severity] ?? ''}`}>{i.severity}</span>
                <span className="text-xs text-slate-400">· confidence {Math.round((i.confidence ?? 0) * 100)}%</span>
              </div>
              <h3 className="mt-1 text-sm font-medium text-slate-900">{i.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{i.body}</p>
              {i.recommendedNextStep && <p className="mt-2 text-xs text-slate-500"><span className="font-medium">Next:</span> {i.recommendedNextStep}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
