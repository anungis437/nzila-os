/**
 * Authority store — enforcement wrapper.
 *
 * `enforceAuthority` loads authoritative facts, evaluates the pure kernel and
 * returns its Decision. It never throws a permissive result: any load failure,
 * missing resource or thrown error is converted into a deny Decision. Resource
 * facts for domains the kernel store does not own (cases, finance, reviews,
 * WorkAid matters) arrive through the injected `ResourceFactsLoader`.
 */
import { deny } from '../common'
import { decide } from '../kernel'
import type { AuthorityRequest, Decision, ResourceFacts } from '../ontology'
import { AuthorityStoreError, type SqlExecutor } from './executor'
import { loadApprovalRequestFacts, loadAuthorityFacts, type MembershipSource } from './facts'

export type ResourceFactsLoader = (exec: SqlExecutor, req: AuthorityRequest) => Promise<ResourceFacts | null>

export interface EnforcementDeps {
  memberships: MembershipSource
  /** Loader for resources outside the authority store. Absent = those resources deny. */
  resources?: ResourceFactsLoader
  now?: () => Date
}

export async function enforceAuthority(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  req: AuthorityRequest,
  options: { authenticated: boolean },
): Promise<Decision> {
  const now = (deps.now ?? (() => new Date()))()
  try {
    const facts = await loadAuthorityFacts(exec, deps.memberships, {
      organizationId: req.organizationId,
      principalUserId: req.principalUserId,
      authenticated: options.authenticated,
      resource: req.resource,
      delegationId: req.delegationId,
    })
    let resource: ResourceFacts | null = null
    if (req.resource.type === 'approval_request') {
      resource = await loadApprovalRequestFacts(exec, req.resource.organizationId, req.resource.id)
    } else if (deps.resources) {
      resource = await deps.resources(exec, req)
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
