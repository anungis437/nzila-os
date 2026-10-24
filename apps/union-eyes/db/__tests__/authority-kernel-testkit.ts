import { PGlite } from '@electric-sql/pglite'
import { ORG, U, installAuthoritySchema, newUuid, seedCast, type Db } from './authority-kernel-harness'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import type { EnforcementDeps } from '../../lib/authority/store/enforce'
import {
  acceptInstrument,
  activateIssuanceRule,
  draftDefaultIssuanceRules,
  issueMandate,
  requestIssuanceApproval,
} from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'
import type { MandateKind, MandateScope } from '../../lib/authority/ontology'

export const DAY = 86_400_000
export const minutesAgo = (m = 1) => new Date(Date.now() - m * 60_000)
export const daysAhead = (d: number) => new Date(Date.now() + d * DAY)

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite()
  await installAuthoritySchema(db)
  await seedCast(db)
  await db.exec('SET ROLE union_eyes_runtime')
  return db
}

export function kit(db: Db) {
  const deps: EnforcementDeps = { memberships: canonicalMembershipSource }
  const as = (user: string, org = ORG) => <T>(fn: (t: SqlExecutor) => Promise<T>): Promise<T> =>
    runAuthorityTransaction(db as unknown as SqlExecutor, { organizationId: org, userId: user }, fn)

  /** Drafts every default rule as the president, then activates them with two other executives and a real instrument. */
  async function adoptDefaultRules(org = ORG, only?: (d: string, o: string) => boolean): Promise<void> {
    await as(U.president, org)((t) => draftDefaultIssuanceRules(t, deps, org, U.president))
    const drafts = await as(U.president, org)((t) => t.query<{ id: string; domain: string; operation: string }>(
      `SELECT id::text id, domain, operation FROM ue_authority_issuance_rules WHERE organization_id = $1 AND status = 'draft'`, [org]))
    let n = 0
    for (const d of drafts.rows) {
      if (only && !only(d.domain, d.operation)) continue
      await as(U.vp, org)((t) => activateIssuanceRule(t, deps, {
        organizationId: org, ruleId: d.id, actorUserId: U.vp, approverUserIds: [U.vp, U.treasurer], sourceInstrument: `Bylaw 12.${++n} (${d.domain}/${d.operation})`,
      }))
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

  return { deps, as, adoptDefaultRules, grantOffice, grantMandate, asAdmin }
}
