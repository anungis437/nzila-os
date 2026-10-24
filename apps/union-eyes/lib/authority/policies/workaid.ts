/**
 * Authority Kernel — WorkAid information-sharing boundary.
 *
 * The union does not hold, and the kernel does not assume, counsel-side
 * authority. WorkAid professional material, clinical/medical information and
 * filing control remain under independent professional control.
 *
 *  - `workaid:read_counsel_material` is ALWAYS denied to union principals.
 *    No mandate, delegation, emergency grant or seniority overrides it.
 *  - `workaid:refer` (union → WorkAid) needs: an active membership, a handler
 *    capacity, a live owner/assignee relationship to the underlying case, and a
 *    live MEMBER-issued consent covering every requested category. Consent is
 *    category-explicit; there is no wildcard.
 *  - `workaid:receive_disclosure` (WorkAid → union) needs a live disclosure
 *    record ISSUED BY COUNSEL, naming this principal and covering the requested
 *    categories. A union-issued record can never open counsel material.
 *
 * Neither path is delegable and neither can be reached by emergency access.
 */
import { activeMembership, activeRecusal, build, deny, hasCapacity, isLive } from '../common'
import type {
  AuthorityFacts,
  AuthorityRequest,
  Capacity,
  Decision,
  DisclosureConsent,
  WorkAidMatterFacts,
} from '../ontology'

const HANDLER: readonly Capacity[] = ['steward', 'chief_steward', 'officer']

const consentLive = (c: DisclosureConsent, now: Date): boolean =>
  isLive({ status: 'active', effectiveAt: c.grantedAt, expiresAt: c.expiresAt, revokedAt: c.revokedAt }, now)

export function decideWorkAid(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  matter: WorkAidMatterFacts,
  now: Date,
): Decision {
  if (req.action === 'workaid:read_counsel_material') {
    return deny(req, now, {
      code: 'COUNSEL_CONTROLLED',
      detail: 'counsel-controlled material is not accessible to union principals; authority rests with counsel',
    })
  }
  if (req.action !== 'workaid:refer' && req.action !== 'workaid:receive_disclosure') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} does not apply to a WorkAid matter` })
  }
  if (req.delegationId) return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'WorkAid exchange is not delegable' })

  const orgId = req.organizationId
  const me = req.principalUserId
  const membership = activeMembership(facts, orgId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const recusal = activeRecusal(facts.recusals, me, req.resource, orgId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })

  const categories = req.categories ?? []
  if (categories.length === 0 || categories.includes('*')) {
    return deny(req, now, { code: 'CONSENT_SCOPE_EXCEEDED', detail: 'explicit information categories are required; wildcards are not accepted' })
  }

  if (req.action === 'workaid:refer') {
    if (!hasCapacity(membership, HANDLER)) {
      return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'a representation capacity is required to refer a matter' })
    }
    const rel = facts.relationships.find(
      (r) =>
        r.principalUserId === me &&
        r.organizationId === orgId &&
        r.resource.type === 'case' &&
        r.resource.id === matter.caseId &&
        (r.relation === 'owner' || r.relation === 'assignee') &&
        isLive(r, now),
    )
    if (!rel) {
      return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: 'no live owner/assignee relationship to the underlying case' })
    }
    const consents = facts.consents.filter(
      (c) =>
        c.organizationId === orgId &&
        c.memberUserId === matter.memberUserId &&
        c.matterId === matter.id &&
        c.direction === 'union_to_workaid',
    )
    if (consents.length === 0) return deny(req, now, { code: 'CONSENT_REQUIRED', detail: 'no member consent on record' })
    const live = consents.filter((c) => c.issuer === 'member' && consentLive(c, now))
    if (live.length === 0) return deny(req, now, { code: 'CONSENT_REQUIRED', detail: 'member consent is revoked, expired or not member-issued' })
    const covering = live.find((c) => categories.every((cat) => c.categories.includes(cat)))
    if (!covering) {
      return deny(req, now, { code: 'CONSENT_SCOPE_EXCEEDED', detail: 'requested categories exceed the member consent' })
    }
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [
        { code: 'ALLOWED_BY_RELATIONSHIP', ref: rel.id },
        { code: 'ALLOWED_BY_CONSENT', ref: covering.id },
      ],
      authority: [
        { kind: 'relationship', id: rel.id, instrument: `${rel.relation} of case ${matter.caseId}` },
        { kind: 'consent', id: covering.id, instrument: `member consent ${covering.id}: ${covering.purpose}` },
      ],
      scope: { categories },
      obligations: ['acknowledgement_expected'],
    })
  }

  // workaid:receive_disclosure
  const d = facts.consents.find((c) => c.id === req.disclosureId)
  if (!d || d.organizationId !== orgId || d.matterId !== matter.id || d.direction !== 'workaid_to_union') {
    return deny(req, now, { code: 'CONSENT_REQUIRED', detail: 'no counsel disclosure record for this matter' })
  }
  if (d.issuer !== 'counsel') {
    return deny(req, now, { code: 'DISCLOSURE_NOT_ISSUED_BY_COUNSEL', detail: 'only counsel can release counsel-controlled material', ref: d.id })
  }
  if (!consentLive(d, now)) return deny(req, now, { code: 'INSTRUMENT_EXPIRED_OR_REVOKED', ref: d.id })
  if (d.recipientUserId !== me) return deny(req, now, { code: 'NOT_ELIGIBLE_APPROVER', detail: 'disclosure names a different recipient', ref: d.id })
  if (!categories.every((cat) => d.categories.includes(cat))) {
    return deny(req, now, { code: 'CONSENT_SCOPE_EXCEEDED', detail: 'requested categories exceed the disclosure', ref: d.id })
  }
  return build({
    req,
    now,
    effect: 'allow',
    reasons: [{ code: 'ALLOWED_BY_CONSENT', ref: d.id }],
    authority: [{ kind: 'consent', id: d.id, instrument: `counsel disclosure ${d.id}: ${d.purpose}` }],
    scope: { categories },
    obligations: ['read_only'],
  })
}
