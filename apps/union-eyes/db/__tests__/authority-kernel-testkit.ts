import { PGlite } from '@electric-sql/pglite'
import { afterAll } from 'vitest'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres'
import { openCaseDomainDb, type CaseDomainDb } from './case-primary-domain-testkit'
import { ORG, U, installAuthoritySchema, newUuid, seedCast, type Db } from './authority-kernel-harness'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import type { EnforcementDeps } from '../../lib/authority/store/enforce'
import type { MembershipSource } from '../../lib/authority/store/facts'
import {
  acceptInstrument,
  activateIssuanceRule,
  draftDefaultIssuanceRules,
  issueMandate,
  requestIssuanceApproval,
  requestRuleAdoption,
} from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'
import type { MandateKind, MandateScope } from '../../lib/authority/ontology'

export const DAY = 86_400_000
export const minutesAgo = (m = 1) => new Date(Date.now() - m * 60_000)
export const daysAhead = (d: number) => new Date(Date.now() + d * DAY)

// UE_AUTHORITY_KERNEL_NATIVE=1 runs the kernel storage suites on an owned disposable PostgreSQL 16 container (the native CI job
// does, through *.native.test.ts entry points); otherwise PGlite. Every native database is removed after its file.
const nativeKernel = process.env.UE_AUTHORITY_KERNEL_NATIVE === '1'
const nativeOpened: CaseDomainDb[] = []
if (nativeKernel) afterAll(async () => { await Promise.allSettled(nativeOpened.splice(0).map((db) => db.close())) })

/**
 * The application's Drizzle handle over a test database: the PGlite driver for PGlite, the node-postgres driver for an owned
 * native container (UE_AUTHORITY_KERNEL_NATIVE). Suites use this instead of drizzle(pg) so the same assertions run on both.
 */
export function appDrizzle(db: PGlite): ReturnType<typeof drizzlePglite> {
  const native = (db as unknown as Partial<CaseDomainDb>).client
  return (native ? drizzleNodePostgres(native) : drizzlePglite(db)) as unknown as ReturnType<typeof drizzlePglite>
}

export async function freshDb(): Promise<PGlite> {
  const db = nativeKernel
    ? await openCaseDomainDb(true).then((opened) => { nativeOpened.push(opened); return opened as unknown as PGlite })
    : new PGlite()
  await installAuthoritySchema(db)
  await seedCast(db)
  await db.exec('SET ROLE union_eyes_runtime')
  return db
}

export type AuthorityActorRunner = <T>(userId: string, organizationId: string,
  operation: (executor: SqlExecutor) => Promise<T>) => Promise<T>

export function kit(db: Db, memberships: MembershipSource = canonicalMembershipSource, actorRunner?: AuthorityActorRunner) {
  const deps: EnforcementDeps = { memberships }
  const as = (user: string, org = ORG) => <T>(fn: (t: SqlExecutor) => Promise<T>): Promise<T> =>
    actorRunner ? actorRunner(user, org, fn) : runAuthorityTransaction(db as unknown as SqlExecutor, { organizationId: org, userId: user }, fn)

  /** The real adoption ceremony: the drafter requests, two other executives vote in their own sessions, then a third activates. */
  async function adoptRule(ruleId: string, instrument: string, org = ORG, drafter = U.president): Promise<void> {
    const req = await as(drafter, org)((t) => requestRuleAdoption(t, deps, { organizationId: org, ruleId, actorUserId: drafter, sourceInstrument: instrument, namedApproverIds: [U.vp, U.treasurer] }))
    for (const a of [U.vp, U.treasurer]) {
      await as(a, org)((t) => recordApprovalDecision(t, deps, { organizationId: org, approvalRequestId: req, approverUserId: a, decision: 'approved' }))
    }
    await as(U.vp, org)((t) => activateIssuanceRule(t, deps, { organizationId: org, ruleId, actorUserId: U.vp, approvalRequestId: req }))
  }

  /** Drafts every default rule as the president, then activates them with two other executives and a real instrument. */
  async function adoptDefaultRules(org = ORG, only?: (d: string, o: string) => boolean): Promise<void> {
    await as(U.president, org)((t) => draftDefaultIssuanceRules(t, deps, org, U.president))
    const drafts = await as(U.president, org)((t) => t.query<{ id: string; domain: string; operation: string }>(
      `SELECT id::text id, domain, operation FROM ue_authority_issuance_rules WHERE organization_id = $1 AND status = 'draft'
         AND NOT EXISTS (SELECT 1 FROM ue_authority_approval_requests r WHERE r.organization_id = $1 AND r.subject_type = 'rule_adoption' AND r.subject_id = ue_authority_issuance_rules.id)`, [org]))
    let n = 0
    for (const d of drafts.rows) {
      if (only && !only(d.domain, d.operation)) continue
      await adoptRule(d.id, `Bylaw 12.${++n} (${d.domain}/${d.operation})`, org)
    }
  }

  /** Issues an executive-office mandate (approval + acceptance), the way a real office is installed. */
  async function grantOffice(holder: string, issuer = U.president, approver = U.treasurer, org = ORG): Promise<string> {
    const id = newUuid()
    const input = {
      organizationId: org, issuerUserId: issuer, holderUserId: holder, kind: 'executive_office' as MandateKind, powers: ['approve'],
      sourceInstrument: `Constitution art. 9 office of ${holder}`, effectiveAt: minutesAgo(5), expiresAt: daysAhead(365),
    }
    const req = await as(issuer, org)((t) => requestIssuanceApproval(t, deps, { ...input, instrumentId: id, namedApproverIds: [approver] }))
    await as(approver, org)((t) => recordApprovalDecision(t, deps, { organizationId: org, approvalRequestId: req, approverUserId: approver, decision: 'approved' }))
    const { mandateId } = await as(issuer, org)((t) => issueMandate(t, deps, { ...input, id, approvalRequestId: req }))
    await as(holder, org)((t) => acceptInstrument(t, { organizationId: org, instrumentType: 'mandate', instrumentId: mandateId, holderUserId: holder }))
    return mandateId
  }

  /** Issues any approval-gated mandate with a named independent approver, then (when required) the holder accepts. */
  async function grantMandate(
    kind: MandateKind,
    holder: string,
    powers: string[],
    extra: { scope?: MandateScope; monetaryLimitMinor?: number; currency?: string; justification?: string; issuer?: string; approver?: string; expiresAt?: Date; effectiveAt?: Date; accept?: boolean } = {},
    org = ORG,
  ): Promise<string> {
    const issuer = extra.issuer ?? U.president
    const approver = extra.approver ?? U.treasurer
    const id = newUuid()
    const input = {
      organizationId: org, issuerUserId: issuer, holderUserId: holder, kind, powers, scope: extra.scope,
      monetaryLimitMinor: extra.monetaryLimitMinor, currency: extra.currency, justification: extra.justification,
      sourceInstrument: `Resolution 2026-${kind}-${id.slice(-4)}`, effectiveAt: extra.effectiveAt ?? minutesAgo(5), expiresAt: extra.expiresAt ?? daysAhead(30),
    }
    const req = await as(issuer, org)((t) => requestIssuanceApproval(t, deps, { ...input, instrumentId: id, namedApproverIds: [approver] }))
    await as(approver, org)((t) => recordApprovalDecision(t, deps, { organizationId: org, approvalRequestId: req, approverUserId: approver, decision: 'approved' }))
    const { mandateId } = await as(issuer, org)((t) => issueMandate(t, deps, { ...input, id, approvalRequestId: req }))
    const needs = (await as(holder, org)((t) => t.query<{ r: boolean }>(`SELECT requires_acceptance r FROM ue_authority_mandates WHERE id = $1`, [mandateId]))).rows[0].r
    if (needs && extra.accept !== false) {
      await as(holder, org)((t) => acceptInstrument(t, { organizationId: org, instrumentType: 'mandate', instrumentId: mandateId, holderUserId: holder }))
    }
    return mandateId
  }

  /** Superuser access for fixtures and catalog assertions. */
  async function asAdmin<T>(fn: () => Promise<T>): Promise<T> {
    await db.exec('RESET ROLE')
    try {
      return await fn()
    } finally {
      await db.exec('SET ROLE union_eyes_runtime')
    }
  }

  return { deps, as, adoptRule, adoptDefaultRules, grantOffice, grantMandate, asAdmin }
}
