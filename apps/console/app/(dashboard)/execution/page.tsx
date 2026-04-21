/**
 * Nzila OS — Execution Tracker
 *
 * Zone 5: EXECUTION — Weekly initiatives, approval queue, ops cadence.
 * Answers: What is actually being built this sprint?
 *          Who is waiting on a decision? What is blocked?
 *
 * Data sources:
 *   - approvals      → pending, approved, rejected counts + recent list
 *   - auditEvents    → recent execution actions
 *   - product-catalog.json → per-venture delivery status
 */
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { approvals, auditEvents, executionInitiatives, orgs } from '@nzila/db/schema'
import { count, eq, desc, and, sql } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApprovalRow {
  id: string
  status: string
  type?: string | null
  createdAt: Date | null
}

interface AuditRow {
  id: string
  action: string
  targetType?: string | null
  createdAt: Date | null
}

interface CatalogProduct {
  name: string
  status: string
  commercial_priority?: number
  code_presence?: string
  evidence_status?: string
}

interface ExecutionData {
  executiveOrgId: string | null
  pendingApprovals: number
  approvedApprovals: number
  rejectedApprovals: number
  initiatives: InitiativeRow[]
  recentApprovals: ApprovalRow[]
  recentAuditEvents: AuditRow[]
  approvalsAvailable: boolean
  auditAvailable: boolean
  topVentures: CatalogProduct[]
}

interface InitiativeRow {
  id: string
  title: string
  venture: string | null
  zone: string | null
  owner: string | null
  dueDate: string | null
  status: string
  urgent: boolean
}

const DEFAULT_INITIATIVES = [
  {
    title: 'Close UnionEyes CUPE pilot — final proposal review',
    venture: 'union-eyes',
    zone: 'REVENUE',
    status: 'in-progress',
    owner: 'Aubert',
    dueDaysFromNow: 2,
    urgent: true,
  },
  {
    title: 'Schedule Flow demo calls — 2 prospect orgs',
    venture: 'flow',
    zone: 'REVENUE',
    status: 'not-started',
    owner: 'Aubert',
    dueDaysFromNow: 3,
    urgent: true,
  },
  {
    title: 'Review 30-day burn vs. budget baseline — cut or allocate',
    venture: 'platform',
    zone: 'CAPITAL',
    status: 'not-started',
    owner: 'Aubert',
    dueDaysFromNow: 4,
    urgent: false,
  },
  {
    title: 'Complete evidence pack for union-eyes',
    venture: 'union-eyes',
    zone: 'GOVERNANCE',
    status: 'not-started',
    owner: 'Aubert',
    dueDaysFromNow: 7,
    urgent: false,
  },
  {
    title: 'Set up CFO pilot org — scope and timeline',
    venture: 'cfo',
    zone: 'REVENUE',
    status: 'not-started',
    owner: 'Aubert',
    dueDaysFromNow: 9,
    urgent: false,
  },
]

async function getExecutiveOrgId(): Promise<string | null> {
  try {
    const rows = await platformDb
      .select({ id: orgs.id, legalName: orgs.legalName })
      .from(orgs)
      .orderBy(orgs.createdAt)

    const nzilaOrg = rows.find((row) => row.legalName.toLowerCase().includes('nzila'))
    return nzilaOrg?.id ?? rows[0]?.id ?? null
  } catch {
    return null
  }
}

async function updateInitiativeStatus(formData: FormData) {
  'use server'

  const { userId } = await auth()
  if (!userId) return

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!id || !status) return

  await platformDb
    .update(executionInitiatives)
    .set({ status, updatedAt: new Date() })
    .where(eq(executionInitiatives.id, id))

  revalidatePath('/execution')
  revalidatePath('/today')
  revalidatePath('/briefing')
}

async function seedDefaultInitiatives(formData: FormData) {
  'use server'

  const { userId } = await auth()
  if (!userId) return

  const orgId = String(formData.get('orgId') ?? '')
  if (!orgId) return

  const now = new Date()

  await platformDb.insert(executionInitiatives).values(
    DEFAULT_INITIATIVES.map((item) => {
      const dueDate = new Date(now)
      dueDate.setDate(now.getDate() + item.dueDaysFromNow)
      return {
        orgId,
        title: item.title,
        venture: item.venture,
        zone: item.zone,
        owner: item.owner,
        dueDate: dueDate.toISOString().slice(0, 10),
        status: item.status,
        urgent: item.urgent,
      }
    }),
  )

  revalidatePath('/execution')
  revalidatePath('/today')
  revalidatePath('/briefing')
}

// ── Data ─────────────────────────────────────────────────────────────────────

function loadTopVentures(): CatalogProduct[] {
  try {
    const p = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(p, 'utf-8')
    const catalog = JSON.parse(raw) as { products: CatalogProduct[] }
    return catalog.products
      .filter((p) => (p.commercial_priority ?? 99) <= 4)
      .sort((a, b) => (a.commercial_priority ?? 99) - (b.commercial_priority ?? 99))
  } catch {
    return []
  }
}

async function loadExecutionData(): Promise<ExecutionData> {
  const topVentures = loadTopVentures()
  const executiveOrgId = await getExecutiveOrgId()

  const [approvalCountsRes, initiativesRes, recentApprovalsRes, auditRes] = await Promise.allSettled([
    platformDb
      .select({
        status: approvals.status,
        cnt: count().as('cnt'),
      })
      .from(approvals)
      .groupBy(approvals.status),
    executiveOrgId
      ? platformDb
          .select({
            id: executionInitiatives.id,
            title: executionInitiatives.title,
            venture: executionInitiatives.venture,
            zone: executionInitiatives.zone,
            owner: executionInitiatives.owner,
            dueDate: executionInitiatives.dueDate,
            status: executionInitiatives.status,
            urgent: executionInitiatives.urgent,
          })
          .from(executionInitiatives)
          .where(and(eq(executionInitiatives.orgId, executiveOrgId), sql`${executionInitiatives.status} != 'done'`))
          .orderBy(desc(executionInitiatives.urgent), sql`${executionInitiatives.dueDate} ASC NULLS LAST`, desc(executionInitiatives.createdAt))
          .limit(12)
      : Promise.resolve([]),
    platformDb
      .select({
        id: approvals.id,
        status: approvals.status,
        createdAt: approvals.createdAt,
      })
      .from(approvals)
      .where(eq(approvals.status, 'pending'))
      .orderBy(desc(approvals.createdAt))
      .limit(8),
    platformDb
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        targetType: auditEvents.targetType,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(10),
  ])

  const approvalsAvailable = approvalCountsRes.status === 'fulfilled'
  const auditAvailable = auditRes.status === 'fulfilled'

  let pendingApprovals = 0
  let approvedApprovals = 0
  let rejectedApprovals = 0

  if (approvalsAvailable) {
    for (const row of approvalCountsRes.value) {
      if (row.status === 'pending') pendingApprovals = Number(row.cnt)
      if (row.status === 'approved') approvedApprovals = Number(row.cnt)
      if (row.status === 'rejected') rejectedApprovals = Number(row.cnt)
    }
  }

  const recentApprovals: ApprovalRow[] =
    recentApprovalsRes.status === 'fulfilled' ? (recentApprovalsRes.value as ApprovalRow[]) : []
  const recentAuditEvents: AuditRow[] = auditAvailable ? (auditRes.value as AuditRow[]) : []
  const initiatives: InitiativeRow[] = initiativesRes.status === 'fulfilled' ? (initiativesRes.value as InitiativeRow[]) : []

  return {
    executiveOrgId,
    pendingApprovals,
    approvedApprovals,
    rejectedApprovals,
    initiatives,
    recentApprovals,
    recentAuditEvents,
    approvalsAvailable,
    auditAvailable,
    topVentures,
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function initiativeStatusBadge(s: 'in-progress' | 'not-started' | 'done') {
  if (s === 'in-progress') return 'bg-blue-100 text-blue-700'
  if (s === 'done') return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-400'
}

function ventureBullet(p: CatalogProduct) {
  const priority = p.commercial_priority ?? 99
  if (priority <= 2) return 'bg-emerald-400'
  if (priority <= 4) return 'bg-blue-400'
  return 'bg-gray-300'
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

function formatDueLabel(date: string | null): string {
  if (!date) return 'No due date'
  const due = new Date(date)
  const diff = Math.ceil((due.getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Due today'
  if (diff <= 7) return `Due in ${diff}d`
  return `Due ${new Date(date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ExecutionPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await loadExecutionData()
  const freshnessStatus = !data.approvalsAvailable
    ? 'manual'
    : data.auditAvailable
      ? 'live'
      : 'daily sync'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BoltIcon className="h-8 w-8 text-gray-300" />
            Execution
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Weekly initiatives · Approval queue · Delivery cadence
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/business/approvals" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            All approvals <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link href="/business/queues" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Queues <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <span className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
            freshness: {freshnessStatus}
          </span>
        </div>
      </div>

      {/* Approval Strip */}
      {data.pendingApprovals > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            <strong>{data.pendingApprovals} approval{data.pendingApprovals === 1 ? '' : 's'}</strong> awaiting your decision
          </p>
          <Link href="/business/approvals" className="ml-auto text-xs text-amber-600 hover:underline flex items-center gap-1 shrink-0">
            Review now <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Metric Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pending</p>
          </div>
          <p className={`text-2xl font-bold ${data.pendingApprovals > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {data.approvalsAvailable ? data.pendingApprovals : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Approved</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.approvalsAvailable ? data.approvedApprovals : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircleIcon className="h-4 w-4 text-red-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rejected</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data.approvalsAvailable ? data.rejectedApprovals : '—'}
          </p>
        </div>
      </div>

      {/* Weekly Initiatives */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Weekly Initiatives</h2>
          </div>
          {data.initiatives.length === 0 && data.executiveOrgId && (
            <form action={seedDefaultInitiatives}>
              <input type="hidden" name="orgId" value={data.executiveOrgId} />
              <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                <ArrowPathIcon className="h-3 w-3" /> Seed starter initiatives
              </button>
            </form>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {data.initiatives.length > 0 ? data.initiatives.map((item, i) => (
            <div key={item.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition">
              <span className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${item.urgent ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">{item.zone ?? 'EXECUTION'}</span>
                  {item.venture && <span className="text-xs font-mono text-gray-400">{item.venture}</span>}
                  <span className={`text-xs ${item.dueDate && new Date(item.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                    {formatDueLabel(item.dueDate)}
                  </span>
                </div>
              </div>
              <form action={updateInitiativeStatus} className="shrink-0">
                <input type="hidden" name="id" value={item.id} />
                <select
                  name="status"
                  defaultValue={item.status}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${initiativeStatusBadge(item.status as 'in-progress' | 'not-started' | 'done')}`}
                >
                  <option value="not-started">not started</option>
                  <option value="in-progress">in progress</option>
                  <option value="done">done</option>
                </select>
              </form>
            </div>
          )) : (
            <div className="px-6 py-8 text-sm text-gray-400 italic">No initiatives yet. Seed starters or add via API.</div>
          )}
        </div>
      </div>

      {/* Venture Delivery Status */}
      {data.topVentures.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Venture Delivery Status</h2>
            </div>
            <Link href="/portfolio" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Full portfolio <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase text-left">
                <th className="px-4 py-3">Venture</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.topVentures.map((v) => {
                const _hasGap = v.evidence_status === 'none' || v.code_presence === 'scaffold'
                return (
                  <tr key={v.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${ventureBullet(v)}`} />
                        <span className="font-medium text-gray-900 capitalize">{v.name.replace(/-/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{v.status}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={v.code_presence === 'full' ? 'text-emerald-600' : v.code_presence === 'partial' ? 'text-amber-500' : 'text-gray-400'}>
                        {v.code_presence ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={v.evidence_status === 'complete' ? 'text-emerald-600' : v.evidence_status === 'partial' ? 'text-amber-500' : 'text-red-400'}>
                        {v.evidence_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.evidence_status === 'none'
                        ? 'Create evidence pack'
                        : v.evidence_status === 'partial'
                          ? 'Complete evidence'
                          : v.code_presence !== 'full'
                            ? 'Finish implementation'
                            : <span className="text-emerald-600">Ready to demo</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Pending Approvals */}
      {data.recentApprovals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-amber-400" />
              <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
            </div>
            <Link href="/business/approvals" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentApprovals.map((a) => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50">
                <span className="text-xs font-mono text-gray-400">{a.id.slice(0, 8)}</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{a.status}</span>
                <span className="text-xs text-gray-400 ml-auto">{formatDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Audit Activity */}
      {data.recentAuditEvents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Platform Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentAuditEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="px-6 py-2.5 flex items-center gap-4 hover:bg-gray-50">
                <span className="text-xs font-mono text-blue-600 truncate max-w-xs">{e.action}</span>
                {e.targetType && <span className="text-xs text-gray-400">{e.targetType}</span>}
                <span className="text-xs text-gray-300 ml-auto shrink-0">{formatDate(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-3">
        <Link href="/capital" className="text-sm text-gray-500 hover:text-gray-900">← Capital</Link>
        <Link href="/risk" className="text-sm text-blue-600 hover:text-blue-800">Risk →</Link>
      </div>
    </div>
  )
}
