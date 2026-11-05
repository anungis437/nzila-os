/**
 * Authority store — enforcement wrapper.
 *
 * `enforceAuthority` loads authoritative facts, evaluates the pure kernel and
 * returns its Decision. It never throws a permissive result: any load failure,
 * missing resource or thrown error is converted into a deny Decision. Resource
 * facts come from the injected loader (the canonical one by default), and
 * relationships DERIVED from source records are merged with the kernel-owned ones.
 */
import { deny } from '../common'
import { decide } from '../kernel'
import type { AuthorityFacts, AuthorityRequest, Decision, ResourceFacts, ResourceRelationship } from '../ontology'
import { AuthorityStoreError, bindSessionActor, sessionActor, type SqlExecutor } from './executor'
import { loadApprovalRequestFacts, loadAuthorityFacts, loadHolderMandates, loadRelationships, type MembershipSource } from './facts'
import { actionForClass, classifyDocument, DEFAULT_DOCUMENT_CLASS_POLICY, type DocumentClassPolicy } from '../document-class'
import { evaluateCounselCapacity, type CounselEngagement } from '../counsel-boundary'
import { createCanonicalResourceLoader, loadCase, loadDocument, type ResourceLoader } from './resources'

export interface EnforcementDeps {
  memberships: MembershipSource
  /** Defaults to the canonical loaders. Inject for tests or for a resource this store does not own. */
  resources?: ResourceLoader
  /**
   * Institution-approved document classification. Defaults to the PROVISIONAL, unapproved policy, which is
   * conservative: nothing but a member's own submission is released to a member.
   */
  documentPolicy?: DocumentClassPolicy
  /**
   * Counsel-side identity port. This branch ships NO implementation (WorkAid counsel
   * authentication is not built here), so every counsel-attributed act is refused
   * unless a deployment supplies a verifier that vouches for the session principal.
   */
  counsel?: CounselIdentityVerifier
  now?: () => Date
}

export interface CounselIdentityVerifier {
  /** True only if `userId` is the separately authenticated counsel for this matter. */
  isCounselFor(exec: SqlExecutor, input: { organizationId: string; matterId: string; userId: string }): Promise<boolean>
  /**
   * The institution-recorded engagement that establishes counsel's capacity for this matter. Needed when the person
   * is also a member of this organization; absent for external counsel.
   */
  engagement?(exec: SqlExecutor, input: { organizationId: string; matterId: string; userId: string }): Promise<CounselEngagement | null>
}

/**
 * Counsel-attributed acts (accepting a referral, issuing a counsel disclosure) need
 * counsel's OWN authenticated session AND an independent verifier's confirmation.
 *
 * A union member is not excluded by status alone, but union authority can never stand in for counsel's: a member
 * acts as counsel only under a live, matter-bound member-counsel engagement with an information barrier, and never
 * while a party, adverse, holding a conflicting union capacity or mandate, or related to the underlying case.
 */
export async function requireCounselSession(
  exec: SqlExecutor,
  deps: Pick<EnforcementDeps, 'counsel' | 'memberships'> & { now?: () => Date },
  input: { organizationId: string; matterId: string; claimedUserId: string },
): Promise<string> {
  const userId = await bindSessionActor(exec, input.claimedUserId, 'counsel')
  if (!deps.counsel || typeof deps.memberships !== 'function') {
    throw new AuthorityStoreError('DENIED', 'COUNSEL_NOT_VERIFIABLE: no counsel-side identity verifier is configured')
  }
  const ok = await deps.counsel.isCounselFor(exec, { organizationId: input.organizationId, matterId: input.matterId, userId })
  if (ok !== true) throw new AuthorityStoreError('DENIED', 'COUNSEL_NOT_VERIFIED: the session principal is not verified counsel for this matter')
  const now = (deps.now ?? (() => new Date()))()
  const union = (await deps.memberships(exec, input.organizationId, [userId])).filter((m) => m.userId === userId && m.organizationId === input.organizationId)
  // An engagement is an institutional appointment, not a membership: a suspended, deactivated or removed member (or an
  // ambiguous membership) cannot keep acting as counsel under an engagement that is still live.
  if (union.length > 1 || union.some((m) => m.status !== 'active')) {
    throw new AuthorityStoreError('DENIED', 'COUNSEL_MEMBERSHIP_NOT_ACTIVE: a union member acts as counsel only while an active member of this organization')
  }
  const matter = (
    await exec.query<{ member_user_id: string; referred_by: string; case_id: string }>(
      `SELECT member_user_id, referred_by, case_id::text AS case_id FROM ue_authority_workaid_matters WHERE organization_id = $1 AND id = $2`,
      [input.organizationId, input.matterId],
    )
  ).rows[0]
  if (!matter) {
    if (union.length > 0 || deps.counsel.engagement) throw new AuthorityStoreError('DENIED', 'COUNSEL_CONFLICT_UNVERIFIABLE: the matter is unknown, so counsel cannot be cleared')
    return userId
  }
  const caseRef = { type: 'case' as const, id: matter.case_id, organizationId: input.organizationId }
  const loaded = union.length > 0
    ? await createCanonicalResourceLoader(DEFAULT_DOCUMENT_CLASS_POLICY)(exec, { principalUserId: userId, organizationId: input.organizationId, action: 'case:read', resource: caseRef }, now)
    : null
  if (union.length > 0 && !loaded) throw new AuthorityStoreError('DENIED', 'COUNSEL_CONFLICT_UNVERIFIABLE: the underlying case could not be loaded')
  const adverse = loaded && loaded.resource.kind === 'case' ? [...loaded.resource.adverseUserIds] : []
  // When an engagement register is wired in, EVERY counsel (external included) needs a live engagement for this matter.
  const engagement = deps.counsel.engagement ? await deps.counsel.engagement(exec, { organizationId: input.organizationId, matterId: input.matterId, userId }) : null
  if (deps.counsel.engagement && union.length === 0 && !engagement) {
    throw new AuthorityStoreError('DENIED', 'COUNSEL_ENGAGEMENT_REQUIRED: no engagement is recorded for this counsel on this matter')
  }
  const result = evaluateCounselCapacity(
    {
      userId,
      memberUserId: String(matter.member_user_id),
      referrerUserId: String(matter.referred_by),
      adverseUserIds: adverse,
      unionCapacities: union.flatMap((m) => [...m.capacities]),
      holdsLiveMandate: union.length > 0 && (await loadHolderMandates(exec, input.organizationId, userId)).length > 0,
      hasCaseRelationship: union.length > 0 && (await loadRelationships(exec, input.organizationId, userId, 'case', matter.case_id)).length > 0,
    },
    engagement,
    input.organizationId,
    input.matterId,
    now,
  )
  if (!result.ok) throw new AuthorityStoreError('DENIED', `${result.code}: ${result.reason}`)
  return userId
}

export async function enforceAuthority(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  req: AuthorityRequest,
  options: { authenticated: boolean },
): Promise<Decision> {
  const now = (deps.now ?? (() => new Date()))()
  try {
    // The principal being decided MUST be the authenticated principal of this transaction;
    // the caller's own `authenticated` claim is never sufficient.
    const session = await sessionActor(exec)
    if (!options.authenticated || !session) {
      return deny(req, now, { code: 'PRINCIPAL_NOT_AUTHENTICATED', detail: 'no authenticated session is bound to this transaction' })
    }
    if (session !== req.principalUserId) {
      return deny(req, now, { code: 'PRINCIPAL_MISMATCH', detail: 'the decided principal is not the authenticated principal of this transaction' })
    }
    let facts: AuthorityFacts = await loadAuthorityFacts(exec, deps.memberships, {
      organizationId: req.organizationId,
      principalUserId: req.principalUserId,
      authenticated: options.authenticated,
      resource: req.resource,
      delegationId: req.delegationId,
      now,
    })
    let resource: ResourceFacts | null = null
    if (req.resource.type === 'approval_request') {
      resource = await loadApprovalRequestFacts(exec, req.resource.organizationId, req.resource.id)
    } else {
      const loader = deps.resources ?? createCanonicalResourceLoader(deps.documentPolicy ?? DEFAULT_DOCUMENT_CLASS_POLICY)
      const loaded = await loader(exec, req, now)
      if (loaded) {
        resource = loaded.resource
        const related: ResourceRelationship[] = [...(loaded.relationships ?? [])]
        // A WorkAid referral is authorised by the principal's relationship to the UNDERLYING CASE.
        if (loaded.resource.kind === 'workaid_matter') {
          related.push(...(await loadRelationships(exec, req.organizationId, req.principalUserId, 'case', loaded.resource.caseId)))
          // The member's own creator relationship is derived from the case row; it authorises their self-referral.
          const underlying = await loadCase(exec, { ...req, action: 'case:read', resource: { type: 'case', id: loaded.resource.caseId, organizationId: req.organizationId } }, now)
          related.push(...(underlying?.relationships ?? []))
        }
        if (related.length) {
          // Only relationships of THIS principal on the case or resource at hand are meaningful to the kernel.
          const mine = related.filter((r) => r.principalUserId === req.principalUserId)
          facts = { ...facts, relationships: [...facts.relationships, ...mine] }
        }
      }
    }
    return decide(req, facts, resource, now)
  } catch (error) {
    return deny(req, now, {
      code: 'FACTS_CONTRADICTORY',
      detail: `authority facts could not be loaded: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
}

export function assertAllowed(decision: Decision): Decision {
  if (decision.effect !== 'allow') {
    throw new AuthorityStoreError('DENIED', `${decision.action} denied: ${decision.reasons.map((r) => r.code).join(', ') || 'no reason recorded'}`)
  }
  return decision
}

/**
 * Document access follows the case the document belongs to AND the kind of information it is. It never follows
 * uploader identity or role seniority, and creating a case never opens every document later attached to it. The
 * information classes (see document-class.ts) map to distinct actions:
 *   - the reader's OWN non-privileged submission: `case:read_own_submission` (survives a privileged case);
 *   - formally released member-disclosable records: `case:read`;
 *   - the union's working or restricted file: `case:read_internal` (representation handlers with an explicit scope);
 *   - third-party restricted information: `case:read_third_party_restricted` (primary handlers, or an explicit named grant);
 *   - privileged material: `case:read_privileged`; counsel-controlled material is not reachable at all.
 * A document with no single, authoritative grievance link has no basis for access.
 */
export async function enforceDocumentRead(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: { principalUserId: string; organizationId: string; documentId: string; authenticated: boolean },
): Promise<Decision> {
  const now = (deps.now ?? (() => new Date()))()
  const policy = deps.documentPolicy ?? DEFAULT_DOCUMENT_CLASS_POLICY
  const base: AuthorityRequest = {
    principalUserId: input.principalUserId,
    organizationId: input.organizationId,
    action: 'case:read',
    resource: { type: 'case', id: input.documentId, organizationId: input.organizationId },
  }
  try {
    const doc = await loadDocument(exec, input.organizationId, input.documentId, policy)
    if (!doc) return deny(base, now, { code: 'RESOURCE_FACTS_MISSING', detail: 'document not found in this organization' })
    if (doc.caseIds.length !== 1) {
      return deny(base, now, {
        code: 'NO_SOURCE_OF_AUTHORITY',
        detail: doc.caseIds.length === 0 ? 'document has no authoritative case link' : 'document links to more than one case',
      })
    }
    const resource = { type: 'case' as const, id: doc.caseIds[0], organizationId: input.organizationId }
    const classify = (reader: string) =>
      classifyDocument({ uploadedBy: doc.uploadedBy, label: doc.label, containsLegalPrivilege: doc.containsLegalPrivilege || doc.privileged, thirdPartySensitive: doc.thirdPartySensitive }, reader, policy)
    if (classify(input.principalUserId) === 'member_submission') {
      const own = await enforceAuthority(
        exec,
        deps,
        { ...base, action: 'case:read_own_submission', resource, documentId: doc.id },
        { authenticated: input.authenticated },
      )
      if (own.effect === 'allow') return own
    }
    // Uploader identity is not an access source: for everything else the document is judged as the union's record.
    const action = actionForClass(classify(''))
    if (!action) return deny(base, now, { code: 'COUNSEL_CONTROLLED', detail: 'counsel-controlled material is not reachable' })
    return await enforceAuthority(exec, deps, { ...base, action, resource }, { authenticated: input.authenticated })
  } catch (error) {
    return deny(base, now, { code: 'FACTS_CONTRADICTORY', detail: `document facts could not be loaded: ${error instanceof Error ? error.message : 'unknown'}` })
  }
}