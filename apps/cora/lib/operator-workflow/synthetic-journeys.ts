import { buildSyntheticWorkflowRuntime } from '../institutional-workflow/fixtures/synthetic-runtime'
import type { WorkflowState } from '../institutional-workflow/contracts'
import { assertionCandidateDigest } from '../evidence-reuse/authority'
import { candidateFromAssertion } from '../evidence-reuse/resolve-use'
import type { OperatorInstitutionalWorkflowView } from './view'

export type SyntheticJourneyName =
  | 'matched'
  | 'partial-reuse'
  | 'revoked'
  | 'superseded'
  | 'conflict'
  | 'denied'
  | 'stale'
  | 'expired'
  | 'pseudo-reuse'

export function createSyntheticOperatorRuntime() {
  const runtime = buildSyntheticWorkflowRuntime()
  runtime.ports.authorizeOperatorView = async (context, run) => ({
    allowed: context.orgId === run.orgId && context.actorId === run.actorId,
    authorizationRef: 'synthetic-operator-historical-view-grant',
    historical: true,
  })
  return runtime
}
type Runtime = ReturnType<typeof createSyntheticOperatorRuntime>
export async function finishSyntheticRun(
  runtime: Runtime,
  runId: string,
  target: WorkflowState = 'AWAITING_RECIPIENT_DISPOSITION',
) {
  for (let step = 0; step < 6; step++) {
    const run = await runtime.service.advance(runId)
    if (run.state === target) return run
    if (['FAILED', 'REVOKED', 'SUPERSEDED'].includes(run.state))
      throw new Error(`Synthetic journey stopped: ${run.state}`)
  }
  throw new Error('Synthetic journey did not reach its target')
}
export interface SyntheticOperatorJourney {
  name: string
  view: OperatorInstitutionalWorkflowView
}
export async function buildSyntheticOperatorJourney(
  name: SyntheticJourneyName,
): Promise<SyntheticOperatorJourney[]> {
  const runtime = createSyntheticOperatorRuntime()
  const evidence = runtime.evidence.values().next().value!
  if (name === 'stale') evidence.assertion.evidence.freshness = 'STALE'
  if (name === 'conflict') {
    const conflict = structuredClone(evidence.assertion)
    conflict.evidence.evidenceId = 'synthetic-conflicting-assertion'
    conflict.evidence.sourceAuthorityId = 'synthetic-second-issuer'
    conflict.support.sourceAuthorityId = 'synthetic-second-issuer'
    conflict.support.sourceRef.providerId = 'synthetic-second-source'
    conflict.support.sourceRef.objectId = 'synthetic-second-record'
    conflict.support.claims = [{ conceptRef: 'certification.status', value: 'NOT_CERTIFIED' }]
    conflict.authorityBindingRef = 'synthetic-second-binding'
    conflict.authorityBinding = {
      ...conflict.authorityBinding,
      bindingRef: conflict.authorityBindingRef,
      issuerAuthorityId: conflict.evidence.sourceAuthorityId,
      candidateSha256: assertionCandidateDigest(candidateFromAssertion(conflict)),
    }
    evidence.supplementalAssertions = [conflict]
    const originalAuthority = runtime.ports.authority.resolveBinding
    runtime.ports.authority.resolveBinding = (ref) =>
      ref === conflict.authorityBindingRef ? conflict.authorityBinding : originalAuthority(ref)
  }
  const a = await runtime.service.request(runtime.requestFor(0))
  if (name === 'denied') {
    runtime.recipientRights.get(a.recipientId)!.disclosure = 'UNKNOWN'
    return [{ name: 'Access unavailable', view: await runtime.service.inspectOperator(a.runId) }]
  }
  if (name === 'conflict' || name === 'stale') {
    await runtime.service.advance(a.runId)
    return [
      {
        name: name === 'conflict' ? 'Conflicting assertions' : 'Stale evidence',
        view: await runtime.service.inspectOperator(a.runId),
      },
    ]
  }
  await finishSyntheticRun(runtime, a.runId)
  if (name === 'partial-reuse' || name === 'pseudo-reuse') {
    const b = await runtime.service.request(runtime.requestFor(1, a.runId))
    if (name === 'pseudo-reuse') {
      runtime.actions.set('synthetic-reconstruction', {
        eventId: 'synthetic-reconstruction',
        runId: b.runId,
        orgId: b.orgId,
        actorId: b.actorId,
        at: b.requestedAt,
        step: 'evidenceReconstruction',
        auditRef: 'synthetic-reconstruction-audit',
      })
      await runtime.service.recordFrictionAction(b.runId, 'synthetic-reconstruction')
    }
    await finishSyntheticRun(runtime, b.runId)
    return [
      {
        name:
          name === 'partial-reuse'
            ? 'Additional evidence needed with governed reuse'
            : 'Reconstruction is not qualified reuse',
        view: await runtime.service.inspectOperator(b.runId),
      },
    ]
  }
  if (name === 'revoked') {
    runtime.recipientRights.get(a.recipientId)!.revokedAt = runtime.journey.attempt.at
  }
  if (name === 'expired') runtime.setTime('2027-03-01T00:00:00.000Z')
  if (name === 'superseded') {
    const request = runtime.requestFor(0)
    const original = runtime.definitions.get(
      `${request.requirement.id}@${request.requirement.version}`,
    )!
    const next = structuredClone(original)
    next.use.requirement.requirementVersion = '2'
    runtime.definitions.set(`${request.requirement.id}@2`, next)
    const b = await runtime.service.request({
      ...request,
      requirement: { ...request.requirement, version: '2' },
    })
    original.superseded = true
    await finishSyntheticRun(runtime, b.runId)
    return [
      {
        name: 'Superseded historical workflow',
        view: await runtime.service.inspectOperator(a.runId),
      },
      { name: 'Successor workflow', view: await runtime.service.inspectOperator(b.runId) },
    ]
  }
  return [
    {
      name:
        name === 'revoked'
          ? 'Revoked historical result'
          : name === 'expired'
            ? 'Expired historical context'
            : 'Technical match without recipient decision',
      view: await runtime.service.inspectOperator(a.runId),
    },
  ]
}
export async function buildSyntheticOperatorCollection() {
  const results: SyntheticOperatorJourney[] = []
  for (const name of [
    'matched',
    'partial-reuse',
    'revoked',
    'superseded',
    'conflict',
    'denied',
    'stale',
    'expired',
    'pseudo-reuse',
  ] as const) {
    results.push(...(await buildSyntheticOperatorJourney(name)))
  }
  return results
}
