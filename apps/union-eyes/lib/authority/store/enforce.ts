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
import { loadApprovalRequestFacts, loadAuthorityFacts, loadRelationships, type MembershipSource } from './facts'
import { canonicalResourceLoader, loadDocument, type ResourceLoader } from './resources'

export interface EnforcementDeps {
  memberships: MembershipSource
  /** Defaults to the canonical loaders. Inject for tests or for a resource this store does not own. */
  resources?: ResourceLoader
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
}

/**
 * Counsel-attributed acts (accepting a referral, issuing a counsel disclosure) need
 * counsel's OWN authenticated session AND an independent verifier's confirmation.
 * A union principal can never satisfy this, whatever actor id it supplies.
 */
export async function requireCounselSession(
  exec: SqlExecutor,
  deps: Pick<EnforcementDeps, 'counsel'>,
  input: { organizationId: string; matterId: string; claimedUserId: string },
): Promise<string> {
  const userId = await bindSessionActor(exec, input.claimedUserId, 'counsel')
  if (!deps.counsel) throw new AuthorityStoreError('DENIED', 'COUNSEL_NOT_VERIFIABLE: no counsel-side identity verifier is configured')
  const ok = await deps.counsel.isCounselFor(exec, { organizationId: input.organizationId, matterId: input.matterId, userId })
  if (ok !== true) throw new AuthorityStoreError('DENIED', 'COUNSEL_NOT_VERIFIED: the session principal is not verified counsel for this matter')
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
      const loaded = await (deps.resources ?? canonicalResourceLoader)(exec, req, now)
      if (loaded) {
        resource = loaded.resource
        const related: ResourceRelationship[] = [...(loaded.relationships ?? [])]
        // A WorkAid referral is authorised by the principal's relationship to the UNDERLYING CASE.
        if (loaded.resource.kind === 'workaid_matter') {
          related.push(...(await loadRelationships(exec, req.organizationId, req.principalUserId, 'case', loaded.resource.caseId)))
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
 * Document access follows the case the document belongs to; it never follows
 * uploader identity or role seniority, and creating a case never opens every document
 * later attached to it. Information classes, from the document's own columns:
 *   - privileged (legal privilege / privileged / highly_sensitive): `case:read_privileged`;
 *   - the requesting principal's OWN non-privileged submission, as creator or represented
 *     member: `case:read_own_submission` (survives a privileged case classification);
 *   - `public_internal`: `case:read` (anyone with live case access, including the member);
 *   - everything else (team_confidential, lro_confidential, case_restricted, unknown or
 *     absent label): `case:read_internal` (representation handlers only; never the member
 *     merely because they created the case).
 * A document with no single, authoritative grievance link has no basis for access at all.
 */
export async function enforceDocumentRead(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: { principalUserId: string; organizationId: string; documentId: string; authenticated: boolean },
): Promise<Decision> {
  const now = (deps.now ?? (() => new Date()))()
  const base: AuthorityRequest = {
    principalUserId: input.principalUserId,
    organizationId: input.organizationId,
    action: 'case:read',
    resource: { type: 'case', id: input.documentId, organizationId: input.organizationId },
  }
  try {
    const doc = await loadDocument(exec, input.organizationId, input.documentId)
    if (!doc) return deny(base, now, { code: 'RESOURCE_FACTS_MISSING', detail: 'document not found in this organization' })
    if (doc.caseIds.length !== 1) {
      return deny(base, now, {
        code: 'NO_SOURCE_OF_AUTHORITY',
        detail: doc.caseIds.length === 0 ? 'document has no authoritative case link' : 'document links to more than one case',
      })
    }
    const resource = { type: 'case' as const, id: doc.caseIds[0], organizationId: input.organizationId }
    if (!doc.privileged && doc.uploadedBy === input.principalUserId) {
      const own = await enforceAuthority(
        exec,
        deps,
        { ...base, action: 'case:read_own_submission', resource, documentId: doc.id },
        { authenticated: input.authenticated },
      )
      if (own.effect === 'allow') return own
    }
    const action: AuthorityRequest['action'] = doc.privileged ? 'case:read_privileged' : doc.label === 'public_internal' ? 'case:read' : 'case:read_internal'
    return await enforceAuthority(exec, deps, { ...base, action, resource }, { authenticated: input.authenticated })
  } catch (error) {
    return deny(base, now, { code: 'FACTS_CONTRADICTORY', detail: `document facts could not be loaded: ${error instanceof Error ? error.message : 'unknown'}` })
  }
}
