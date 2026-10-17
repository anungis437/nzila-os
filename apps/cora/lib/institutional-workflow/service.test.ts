import { describe, expect, it } from 'vitest'
import { buildSyntheticWorkflowRuntime } from './fixtures/synthetic-runtime'
import { assertWorkflowTransition, type WorkflowState, type WorkflowPorts } from './contracts'
import { verifyWorkflowAudit, workflowDigest } from './ledger'
import { createInstitutionalWorkflowService } from './service'

type Fixture = ReturnType<typeof buildSyntheticWorkflowRuntime>
async function toState(f: Fixture, runId: string, state: WorkflowState) {
  let result = await f.service.advance(runId)
  for (let i = 0; i < 8 && result.state !== state; i++) result = await f.service.advance(runId)
  expect(result.state).toBe(state)
  return result
}
async function twoContexts(f: Fixture) {
  const a = await f.service.request(f.requestFor(0))
  await toState(f, a.runId, 'AWAITING_RECIPIENT_DISPOSITION')
  const b = await f.service.request(f.requestFor(1, a.runId))
  return { a, b }
}
describe('server-owned institutional workflow', () => {
  it('derives trusted actor/org and refuses client authority or final-result fields', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    expect(run).toMatchObject({
      orgId: f.journey.capsule.orgId,
      actorId: 'synthetic-operator',
      state: 'REQUESTED',
      revision: 1,
    })
    for (const field of [
      'orgId',
      'actorId',
      'sourceAuthority',
      'recipientAuthority',
      'resolution',
      'reuseClassification',
      'disposition',
    ]) {
      await expect(f.service.request({ ...f.requestFor(0), [field]: 'forged' })).rejects.toThrow()
    }
  })
  it('replays the same governed request including concurrent retry without duplicate workflow or audit', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const requests = await Promise.all(
      Array.from({ length: 5 }, () => f.service.request(f.requestFor(0))),
    )
    expect(new Set(requests.map((run) => run.runId)).size).toBe(1)
    const id = requests[0]!.runId
    await toState(f, id, 'AWAITING_RECIPIENT_DISPOSITION')
    const replay = await f.service.request(f.requestFor(0))
    expect(replay.state).toBe('AWAITING_RECIPIENT_DISPOSITION')
    const data = await f.storage.transaction(f.journey.capsule.orgId, async (state) => state)
    expect(data.runs).toHaveLength(1)
    expect(data.audit).toHaveLength(6)
  })
  it.each(['evidence', 'requirement', 'authorization', 'interpretation'] as const)(
    'creates a new identity when %s changes, preserving old binding',
    async (part) => {
      const f = buildSyntheticWorkflowRuntime()
      const request = f.requestFor(0)
      const first = await f.service.request(request)
      const old = workflowDigest(first)
      if (part === 'evidence') {
        const definition = structuredClone(f.evidence.values().next().value!)
        definition.assertion.evidence.version = 'v2'
        definition.assertion.authorityBindingRef = 'synthetic-binding-v2'
        request.evidence.version = 'v2'
        f.evidence.set(`${request.evidence.id}@v2`, definition)
      } else if (part === 'requirement') {
        const definition = structuredClone(
          f.definitions.get(`${request.requirement.id}@${request.requirement.version}`)!,
        )
        definition.use.requirement.requirementVersion = '2'
        request.requirement.version = '2'
        f.definitions.set(`${request.requirement.id}@2`, definition)
      } else if (part === 'authorization') {
        f.recipientRights.get(first.recipientId)!.decisionRef = 'new-authorization'
      } else {
        f.definitions.get(
          `${request.requirement.id}@${request.requirement.version}`,
        )!.use.interpretation.version = '2'
      }
      const second = await f.service.request(request)
      expect(second.runId).not.toBe(first.runId)
      expect(second.supersedesRunId).toBe(first.runId)
      const snapshots = await f.storage.transaction(first.orgId, async (data) => data.history)
      expect(workflowDigest(snapshots[0])).toBe(old)
    },
  )
  it.each(['request', 'resolution', 'reuse'] as const)(
    'revokes before the next boundary after %s, without rewriting history',
    async (stage) => {
      const f = buildSyntheticWorkflowRuntime()
      const { b } = await twoContexts(f)
      if (stage === 'resolution') await toState(f, b.runId, 'EVIDENCE_BOUND')
      if (stage === 'reuse') await toState(f, b.runId, 'RESOLVED')
      const before = await f.storage.transaction(b.orgId, async (data) =>
        structuredClone(data.history),
      )
      f.recipientRights.get(b.recipientId)!.revokedAt = f.journey.attempt.at
      const revoked = await f.service.advance(b.runId)
      expect(revoked.state).toBe('REVOKED')
      const data = await f.storage.transaction(b.orgId, async (state) => state)
      expect(data.history.slice(0, before.length)).toEqual(before)
      expect(data.audit.at(-1)!.rightsSnapshot.revokedAt).toBe(f.journey.attempt.at)
      expect(data.reuseLedger).toHaveLength(0)
      await expect(f.service.advance(b.runId)).rejects.toThrow('terminal')
    },
  )
  it('blocks disposition after revocation while retaining the previously lawful reuse event', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const { b } = await twoContexts(f)
    await toState(f, b.runId, 'AWAITING_RECIPIENT_DISPOSITION')
    f.recipientRights.get(b.recipientId)!.revokedAt = f.journey.attempt.at
    f.becomeRecipient()
    const result = await f.service.recordDisposition({
      runId: b.runId,
      externalDispositionRef: 'external-b',
    })
    expect(result.state).toBe('REVOKED')
    expect(result.disposition).toBeUndefined()
    const data = await f.storage.transaction(b.orgId, async (state) => state)
    expect(data.reuseLedger).toHaveLength(1)
    expect(data.history.some((run) => run.state === 'REUSE_EVALUATED')).toBe(true)
  })
  it('rechecks upstream source authorization during an open workflow', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    f.sourceRights.revokedAt = f.journey.attempt.at
    expect((await f.service.advance(run.runId)).state).toBe('REVOKED')
    const data = await f.storage.transaction(run.orgId, async (state) => state)
    expect(data.audit.at(-1)!.sourceRightsSnapshot.revokedAt).toBe(f.journey.attempt.at)
  })

  it('shows revoked current permissions separately from the initially allowed binding', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    f.recipientRights.get(run.recipientId)!.revokedAt = f.journey.attempt.at
    const view = await f.service.inspect(run.runId)
    expect(view.state).toBe('REVOKED')
    expect(view.permissions.revokedAt).toBe(f.journey.attempt.at)
    expect(view.boundPermissions.revokedAt).toBeUndefined()
    expect(view.permissionsEvaluatedAt).toBe(f.journey.attempt.at)
  })
  it('fails closed when evidence expires mid-run', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const assertion = f.evidence.values().next().value!.assertion
    assertion.evidence.validUntil = '2026-03-02T00:00:00.000Z'
    const run = await f.service.request(f.requestFor(0))
    await toState(f, run.runId, 'EVIDENCE_BOUND')
    f.setTime('2026-03-03T00:00:00.000Z')
    const result = await f.service.advance(run.runId)
    expect(result.state).toBe('FAILED')
    expect(result.resolution).toBeUndefined()
  })
  it('supersedes when requirement is superseded or mutated without a new version', async () => {
    for (const changed of ['superseded', 'edited']) {
      const f = buildSyntheticWorkflowRuntime()
      const run = await f.service.request(f.requestFor(0))
      const definition = f.definitions.get(
        `${run.requirement.reference.id}@${run.requirement.reference.version}`,
      )!
      if (changed === 'superseded') definition.superseded = true
      else definition.use.interpretation.rules[0]!.expectedValue = 'different'
      expect((await f.service.advance(run.runId)).state).toBe('SUPERSEDED')
    }
  })
  it.each(['org', 'actor', 'permission'] as const)(
    'denies wrong %s and records explicit denial',
    async (part) => {
      const f = buildSyntheticWorkflowRuntime()
      const run = await f.service.request(f.requestFor(0))
      if (part === 'org') f.setContext({ orgId: 'foreign-org' })
      if (part === 'actor') f.setContext({ actorId: 'foreign-actor' })
      if (part === 'permission') f.setContext({ permissions: [] })
      await expect(f.service.advance(run.runId)).rejects.toThrow()
      expect(f.denials.length).toBeGreaterThan(0)
    },
  )
  it('makes revision-bound step retries safe under concurrency', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    const replies = await Promise.all(
      Array.from({ length: 3 }, () => f.service.advance(run.runId, run.revision)),
    )
    expect(replies.map((reply) => reply.state)).toEqual(['AUTHORIZED', 'AUTHORIZED', 'AUTHORIZED'])
    const data = await f.storage.transaction(run.orgId, async (state) => state)
    expect(data.audit).toHaveLength(2)
    expect(data.frictionLedger).toHaveLength(1)
  })
  it('preserves the historical assertion when the catalog edits an immutable evidence version', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    const historical = workflowDigest(run.use.assertion)
    f.evidence.values().next().value!.assertion.support.claims[0]!.value = 'changed'
    const result = await f.service.advance(run.runId)
    expect(result.state).toBe('SUPERSEDED')
    expect(workflowDigest(result.use.assertion)).toBe(historical)
  })
  it('preserves an external disposition after later evidence expiration', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    await toState(f, run.runId, 'AWAITING_RECIPIENT_DISPOSITION')
    f.becomeRecipient()
    const recorded = await f.service.recordDisposition({
      runId: run.runId,
      externalDispositionRef: 'external-a',
    })
    f.becomeOperator()
    f.setTime('2027-03-01T00:00:00.000Z')
    const view = await f.service.inspect(run.runId)
    expect(view.state).toBe('SUPERSEDED')
    expect(view.externalDispositionRef).toBe(recorded.disposition!.externalDispositionRef)
  })
  it.each(['evidence', 'requirement'] as const)(
    'denies cross-tenant %s even if the loader returns a row',
    async (part) => {
      const f = buildSyntheticWorkflowRuntime()
      const ports: WorkflowPorts = { ...f.ports }
      if (part === 'evidence')
        ports.loadEvidence = async (_org, ref) => ({
          ...(await f.ports.loadEvidence(f.journey.capsule.orgId, ref)),
          orgId: 'foreign',
        })
      else
        ports.loadRequirement = async (_org, ref) => ({
          ...(await f.ports.loadRequirement(f.journey.capsule.orgId, ref)),
          orgId: 'foreign',
        })
      await expect(
        createInstitutionalWorkflowService(ports).request(f.requestFor(0)),
      ).rejects.toThrow()
    },
  )
  it.each(['missing', 'wrong-recipient', 'ambiguous-issuer'] as const)(
    'fails closed for %s authority',
    async (part) => {
      const f = buildSyntheticWorkflowRuntime()
      const recipient = f.journey.attempt.originating.requirement.recipientId
      if (part === 'missing') f.recipientRights.delete(recipient)
      if (part === 'wrong-recipient')
        f.recipientRights.get(recipient)!.permittedRecipients = ['other']
      if (part === 'ambiguous-issuer') {
        f.ports.authority.resolveBinding = () => undefined
        const run = await f.service.request(f.requestFor(0))
        expect((await f.service.advance(run.runId)).state).toBe('FAILED')
      } else await expect(f.service.request(f.requestFor(0))).rejects.toThrow()
    },
  )
  it('runs operator → A → B → external disposition → metrics and complete audit without capsule changes', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const original = JSON.stringify(f.journey.capsule)
    const { a, b } = await twoContexts(f)
    const evaluated = await toState(f, b.runId, 'AWAITING_RECIPIENT_DISPOSITION')
    expect(evaluated.resolution!.result.state).toBe('PARTIAL')
    expect(evaluated.reuse!.event.qualification).toBe('QUALIFIED_REUSE')
    expect(evaluated.reuse!.event.originatingResolution.state).toBe('MATCHED')
    await f.service.advance(b.runId)
    const replay = await f.service.request(f.requestFor(1, a.runId))
    expect(replay.runId).toBe(b.runId)
    f.becomeRecipient()
    const completed = await f.service.recordDisposition({
      runId: b.runId,
      externalDispositionRef: 'external-b',
    })
    expect(completed.state).toBe('DISPOSITION_RECORDED')
    expect(completed.disposition!.decisionAuthorityRef).toBe(
      f.journey.attempt.consuming.decisionAuthorityRef,
    )
    expect(completed.resolution).not.toHaveProperty('disposition')
    await f.service.recordDisposition({ runId: b.runId, externalDispositionRef: 'external-b' })
    f.becomeOperator()
    const view = await f.service.inspect(b.runId)
    expect(view.metrics.reuse).toMatchObject({ numerator: 1, denominator: 1, ratio: 1 })
    expect(view.metrics.friction.events).toEqual({
      sourceRetrieval: 0,
      manualReentry: 0,
      duplicateDocumentProduction: 0,
      semanticClarification: 1,
      permissionRemediation: 1,
      institutionalReverification: 1,
      evidenceReconstruction: 0,
    })
    expect(view.freshness).toBe('NOT_VERIFIED')
    expect(view).not.toHaveProperty('approval')
    expect(JSON.stringify(f.journey.capsule)).toBe(original)
    const data = await f.storage.transaction(b.orgId, async (state) => state)
    expect(data.reuseLedger).toHaveLength(1)
    expect(verifyWorkflowAudit(data.audit)).toBe(true)
    expect(data.audit.filter((entry) => entry.runId === b.runId)).toHaveLength(7)
    for (const entry of data.audit) {
      expect(entry).toEqual(
        expect.objectContaining({
          actorId: expect.any(String),
          orgId: b.orgId,
          evidence: b.evidence.reference,
          authorizationRef: expect.any(String),
          rightsSnapshot: expect.any(Object),
          at: expect.any(String),
          reason: expect.any(String),
          sha256: expect.any(String),
        }),
      )
    }
  })
  it('does not let an operator manufacture a recipient disposition or overwrite one', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const { b } = await twoContexts(f)
    await toState(f, b.runId, 'AWAITING_RECIPIENT_DISPOSITION')
    await expect(
      f.service.recordDisposition({ runId: b.runId, externalDispositionRef: 'approval' }),
    ).rejects.toThrow()
    f.becomeRecipient()
    f.ports.loadDisposition = async (_context, run, ref) => ({
      recipientId: 'other-recipient',
      decisionAuthorityRef: run.use.decisionAuthorityRef,
      externalDispositionRef: ref,
      recordedAt: f.journey.attempt.at,
      provenanceRef: 'p',
      auditRef: 'a',
    })
    await expect(
      f.service.recordDisposition({ runId: b.runId, externalDispositionRef: 'external' }),
    ).rejects.toThrow('authority')
  })
  it('derives all seven friction counts from verified server events and deduplicates event references', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    for (const step of [
      'sourceRetrieval',
      'manualReentry',
      'duplicateDocumentProduction',
      'semanticClarification',
      'permissionRemediation',
      'institutionalReverification',
      'evidenceReconstruction',
    ] as const) {
      const eventId = `server-action:${step}`
      f.actions.set(eventId, {
        eventId,
        runId: run.runId,
        orgId: run.orgId,
        actorId: run.actorId,
        at: run.requestedAt,
        step,
        auditRef: `external-audit:${step}`,
      })
      await f.service.recordFrictionAction(run.runId, eventId)
      await f.service.recordFrictionAction(run.runId, eventId)
    }
    const view = await f.service.inspect(run.runId)
    expect(Object.values(view.metrics.friction.events)).toEqual([1, 1, 1, 1, 1, 1, 1])
    await expect(f.service.recordFrictionAction(run.runId, 'caller-totals')).rejects.toThrow(
      'not found',
    )
  })
  it('rejects impossible lifecycle transitions and tampered append-only audit', async () => {
    expect(() => assertWorkflowTransition('REQUESTED', 'DISPOSITION_RECORDED')).toThrow()
    expect(() => assertWorkflowTransition('REVOKED', 'AUTHORIZED')).toThrow()
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    await expect(
      f.storage.transaction(run.orgId, async (data) => {
        data.audit[0]!.reason = 'tampered'
      }),
    ).rejects.toThrow('integrity')
    const data = await f.storage.transaction(run.orgId, async (state) => state)
    expect(data.audit[0]!.reason).toBe('SERVER_BOUND_REQUEST')
  })
  it('does not return success when atomic storage fails', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const ports: WorkflowPorts = {
      ...f.ports,
      storage: {
        transaction: async () => {
          throw new Error('Atomic audit commit failed')
        },
      },
    }
    await expect(
      createInstitutionalWorkflowService(ports).request(f.requestFor(0)),
    ).rejects.toThrow('Atomic audit commit failed')
  })

  it('does not qualify reuse when a recorded action reconstructs evidence', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const { b } = await twoContexts(f)
    f.actions.set('reconstructed', {
      eventId: 'reconstructed',
      runId: b.runId,
      orgId: b.orgId,
      actorId: b.actorId,
      at: b.requestedAt,
      step: 'evidenceReconstruction',
      auditRef: 'synthetic-action-audit',
    })
    await f.service.recordFrictionAction(b.runId, 'reconstructed')
    const result = await toState(f, b.runId, 'REUSE_EVALUATED')
    expect(result.reuse!.event.qualification).toBe('INELIGIBLE')
    const view = await f.service.inspect(b.runId)
    expect(view.metrics.reuse).toMatchObject({ numerator: 0, denominator: 1, ratio: 0 })
    expect(view.metrics.friction.events.evidenceReconstruction).toBe(1)
  })

  it('keeps a new authorization opportunity distinct in the reuse ledger', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const { a, b } = await twoContexts(f)
    await toState(f, b.runId, 'REUSE_EVALUATED')
    f.recipientRights.get(b.recipientId)!.decisionRef = 'synthetic-b-auth-v2'
    const second = await f.service.request(f.requestFor(1, a.runId))
    await toState(f, second.runId, 'REUSE_EVALUATED')
    const data = await f.storage.transaction(b.orgId, async (state) => state)
    expect(data.reuseLedger).toHaveLength(2)
    expect(new Set(data.reuseLedger.map((item) => item.event.opportunityKey)).size).toBe(2)
  })

  it('rejects unaudited current-only mutation and rolls back a failed transaction', async () => {
    const f = buildSyntheticWorkflowRuntime()
    const run = await f.service.request(f.requestFor(0))
    await expect(
      f.storage.transaction(run.orgId, async (data) => {
        data.runs[0]!.state = 'RESOLVED'
      }),
    ).rejects.toThrow('immutable snapshot')
    await expect(
      f.storage.transaction(run.orgId, async (data) => {
        data.runs[0]!.state = 'FAILED'
        throw new Error('simulated storage interruption')
      }),
    ).rejects.toThrow('interruption')
    const data = await f.storage.transaction(run.orgId, async (state) => state)
    expect(data.runs[0]!.state).toBe('REQUESTED')
    expect(data.history).toHaveLength(1)
  })
})
