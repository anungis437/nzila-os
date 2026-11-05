/**
 * Authority Kernel — certified council-election supersession.
 *
 * A governance role does not supersede a certified result. The principal needs a live
 * governance_review mandate whose power is `supersede_certified_result`, whose scope names
 * this election, and whose approver is a third person. The action is not delegable.
 * Until that mandate is issued, the decision is a denial and nothing is written.
 */
import { activeMembership, activeRecusal, assessMandate, build, deny, hasCapacity, instrumentOf } from '../common'
import type { AuthorityFacts, AuthorityRequest, CouncilElectionFacts, Decision, Reason } from '../ontology'

export const SUPERSESSION_POWER = 'supersede_certified_result'
const ELIGIBLE = ['governance_reviewer', 'executive', 'officer'] as const

export function decideCertifiedSupersession(
  req: AuthorityRequest,
  facts: AuthorityFacts,
  election: CouncilElectionFacts,
  now: Date,
): Decision {
  if (req.action !== 'governance:supersede_certified_result') {
    return deny(req, now, { code: 'ACTION_NOT_COVERED', detail: `${req.action} does not supersede a certified election` })
  }
  if (req.delegationId) {
    return deny(req, now, { code: 'DELEGATION_INVALID', detail: 'certified-result supersession is not delegable' })
  }
  if (!election.certified) {
    return deny(req, now, { code: 'STATE_NOT_ELIGIBLE', detail: 'an uncertified election is corrected through the ordinary update' })
  }
  const membership = activeMembership(facts, req.organizationId)
  if (!membership) return deny(req, now, { code: 'NOT_AN_ACTIVE_MEMBER' })
  const me = req.principalUserId
  if (election.namedUserIds.includes(me)) {
    return deny(req, now, { code: 'ADVERSE_PARTY', detail: 'a person named on the certified result cannot supersede it' })
  }
  const recusal = activeRecusal(facts.recusals, me, req.resource, req.organizationId)
  if (recusal) return deny(req, now, { code: 'RECUSED', ref: recusal.id })
  if (!hasCapacity(membership, ELIGIBLE)) {
    return deny(req, now, { code: 'CAPACITY_NOT_ELIGIBLE', detail: 'a governance capacity is eligibility only and does not issue this power' })
  }

  const misses: Reason[] = []
  for (const mandate of facts.mandates) {
    if (mandate.principalUserId !== me || mandate.kind !== 'governance_review') continue
    const verdict = assessMandate(mandate, req.organizationId, now)
    if (!verdict.effective) {
      misses.push(...verdict.reasons)
      continue
    }
    if (!mandate.scope.resourceIds?.includes(election.id)) {
      misses.push({ code: 'OUT_OF_SCOPE', ref: mandate.id, detail: 'the mandate names a different election' })
      continue
    }
    if (!mandate.powers.includes(SUPERSESSION_POWER)) {
      misses.push({ code: 'ACTION_NOT_COVERED', ref: mandate.id, detail: 'the mandate does not include certified-result supersession' })
      continue
    }
    if (!mandate.approvedBy || mandate.approvedBy === me || mandate.approvedBy === mandate.grantedBy) {
      misses.push({ code: 'SEGREGATION_OF_DUTIES', ref: mandate.id, detail: 'the reviewer must be distinct from the issuer and the holder' })
      continue
    }
    const reference = mandate.sourceInstrument.trim()
    if (reference.length === 0 || reference.length > 200) {
      misses.push({ code: 'INSTRUMENT_INVALID', ref: mandate.id, detail: 'the decision reference must be 1 to 200 characters' })
      continue
    }
    return build({
      req,
      now,
      effect: 'allow',
      reasons: [{ code: 'ALLOWED_BY_MANDATE', ref: mandate.id }],
      authority: [{ kind: 'mandate', id: mandate.id, instrument: instrumentOf(mandate) }],
    })
  }
  return deny(req, now, { code: 'NO_SOURCE_OF_AUTHORITY', detail: 'no live mandate supersedes this certified result' }, ...misses)
}
