import { describe, expect, it, vi } from 'vitest'
import { CivicKernel, type Authority, type Configuration } from '../src/kernel'
import { runSyntheticProof, syntheticScenario, syntheticDelegation } from '../src/scenario'

const clock = () => new Date('2026-10-10T17:00:00Z')
function start() {
  const scenario = syntheticScenario()
  const kernel = new CivicKernel(scenario.seed, clock)
  return { scenario, kernel }
}
function active() {
  const result = start()
  result.kernel.authorizeIntervention(result.scenario.principal, result.scenario.itemId)
  return result
}

describe('R-GATE: scoped institutional authority and source integrity', () => {
  it('rejects production execution even in the approved worktree', () => {
    const { scenario: s, kernel: k } = active()
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(() => k.brief(s.principal, s.itemId)).toThrow('CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED')
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('stops an existing kernel exactly when runtime authorization expires', () => {
    const { scenario: s, kernel: k } = active()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-17T16:17:50Z'))
      expect(() => k.brief(s.principal, s.itemId)).toThrow('CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED')
      expect(() => k.decide(s.principal, s.itemId, 'change', 'Fictional expired attempt')).toThrow(
        'CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED',
      )
    } finally {
      vi.useRealTimers()
    }
    expect(k.auditTrail(s.principal, s.itemId)).toHaveLength(1)
  })
  it('keeps authentication, application membership and institutional authority separate', () => {
    const { scenario: s, kernel: k } = active()
    expect(k.operator(s.observer, s.itemId).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MISSING_AUTHORITY' }),
    )
    expect(() => k.decide(s.observer, s.itemId, 'change', 'Fictional review')).toThrow(
      'MISSING_AUTHORITY',
    )
    expect(k.brief(s.observer, s.itemId).humanDecision).toBeNull()
    expect(k.auditTrail(s.principal, s.itemId)).toHaveLength(1)
  })
  it('does not infer application membership from authentication', () => {
    const s = syntheticScenario()
    s.seed.memberships = s.seed.memberships.filter((member) => member.userId !== s.observer.actorId)
    const k = new CivicKernel(s.seed, clock)
    expect(() => k.brief(s.observer, s.itemId)).toThrow('NOT_FOUND')
  })
  it('allows explicit human delegation only inside its resource/action/period scope', () => {
    const { scenario: s, kernel: k } = active()
    k.grantAuthority(s.principal, s.itemId, syntheticDelegation(s))
    expect(
      k.decide(s.observer, s.itemId, 'request_evidence', 'Fictional missing-evidence follow-up')
        .authorityId,
    ).toBe('SYN-A-OBSERVER-AUTHORITY')
  })
  it.each([
    { resourceId: 'SYN-MISSING-ITEM' },
    { actorId: 'SYN-MISSING-ACTOR' },
    { instrumentId: 'SYN-MISSING-INSTRUMENT' },
    { positionId: 'SYN-MISSING-POSITION' },
    { orgId: 'SYN-B-ORG' },
  ])('rejects invalid authority binding %j', (override) => {
    const s = syntheticScenario()
    s.seed.authorities[0] = { ...s.seed.authorities[0], ...override }
    expect(() => new CivicKernel(s.seed, clock)).toThrow()
  })
  it.each([
    { revokedAt: '2026-10-10T16:59:00Z' },
    { expiresAt: '2026-10-10T17:00:00Z' },
    { effectiveAt: '2026-10-10T17:00:01Z' },
    { actions: ['record_evidence'] as Authority['actions'] },
  ])('denies ineffective or action-inappropriate delegation %j', (override) => {
    const s = syntheticScenario()
    s.seed.authorities[0] = { ...s.seed.authorities[0], ...override }
    const k = new CivicKernel(s.seed, clock)
    expect(() => k.authorizeIntervention(s.principal, s.itemId)).toThrow('MISSING_AUTHORITY')
    expect(k.auditTrail(s.principal, s.itemId)).toHaveLength(0)
  })
  it('rejects authentication expiry without converting it into delegated authority', () => {
    const s = syntheticScenario()
    s.seed.actors[0].session.expiresAt = '2026-10-10T17:00:00Z'
    const k = new CivicKernel(s.seed, clock)
    expect(() => k.brief(s.principal, s.itemId)).toThrow('AUTHENTICATION_REQUIRED')
  })
  it('rejects institution and resource access across otherwise valid principals', () => {
    const { scenario: s, kernel: k } = active()
    const other = syntheticScenario('B')
    for (const read of [
      () => k.brief(other.principal, s.itemId),
      () => k.operator(other.principal, s.itemId),
      () => k.auditTrail(other.principal, s.itemId),
      () => k.brief(s.principal, other.itemId),
    ]) {
      expect(read).toThrow('NOT_FOUND')
    }
    expect(() => k.decide(other.principal, s.itemId, 'change', 'Fictional review')).toThrow(
      'NOT_FOUND',
    )
    expect(() => k.submitEvidence(s.principal, s.itemId, other.engagement)).toThrow(
      'INVALID_EVIDENCE',
    )
  })
  it('never lets machine actors approve, delegate or decide', () => {
    const { scenario: s, kernel: k } = active()
    for (const act of [
      () => k.authorizeIntervention(s.machine, s.itemId),
      () => k.grantAuthority(s.machine, s.itemId, syntheticDelegation(s)),
      () => k.decide(s.machine, s.itemId, 'change', 'Fictional automated proposal'),
    ])
      expect(act).toThrow('HUMAN_REQUIRED')
    expect(k.auditTrail(s.principal, s.itemId)).toHaveLength(1)
  })
  it('does not grant machine authority even if it is included in seed data', () => {
    const s = syntheticScenario()
    s.seed.authorities[0].actorId = s.machine.actorId
    s.seed.authorities[0].positionId = 'SYN-A-OBSERVER-POSITION'
    expect(() => new CivicKernel(s.seed, clock)).toThrow('INVALID_AUTHORITY')
  })
  it('prevents delegation beyond the grantor scope', () => {
    const { scenario: s, kernel: k } = active()
    const grant = { ...syntheticDelegation(s), expiresAt: '2027-01-01T00:00:00Z' }
    expect(() => k.grantAuthority(s.principal, s.itemId, grant)).toThrow('INVALID_AUTHORITY')
  })
  it('preserves every source category and exact provenance without promoting derived evidence', () => {
    const proof = runSyntheticProof()
    expect(new Set(proof.executiveBrief.evidence.map((entry) => entry.category))).toEqual(
      new Set([
        'institutional_interpretation',
        'decision_artifact',
        'referenced_authoritative_record',
        'authoritative_record',
        'derived_evidence',
      ]),
    )
    expect(
      proof.executiveBrief.evidence.find((entry) => entry.id === proof.scenario.derived.id),
    ).toEqual(proof.scenario.derived)
    expect(proof.executiveBrief.authorityInstrument?.category).toBe('authoritative_record')
    expect(
      proof.finalBrief.evidence.find((entry) => entry.id === proof.scenario.derived.id)?.category,
    ).toBe('derived_evidence')
  })
  it('rejects stripped/mismatched or cyclic derived provenance', () => {
    const { scenario: s, kernel: k } = active()
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, { ...s.derived, derivedFrom: [] }),
    ).toThrow('PROVENANCE_REQUIRED')
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, { ...s.derived, derivedFrom: ['SYN-B-ITEM'] }),
    ).toThrow('PROVENANCE_REQUIRED')
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, { ...s.derived, derivedFrom: [s.derived.id] }),
    ).toThrow('PROVENANCE_REQUIRED')
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, { ...s.derived, category: 'authoritative_record' }),
    ).toThrow('SOURCE_AUTHORITY_INVALID')
  })
  it('rejects reference copies and reclassification of an existing record version', () => {
    const { scenario: s, kernel: k } = active()
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, {
        ...s.engagement,
        content: 'Fictional duplicate bytes',
      }),
    ).toThrow('CANONICAL_DUPLICATION')
    k.submitEvidence(s.principal, s.itemId, s.engagement)
    expect(() =>
      k.submitEvidence(s.principal, s.itemId, {
        ...s.engagement,
        id: 'SYN-NEW',
        category: 'authoritative_record',
      }),
    ).toThrow('SOURCE_AUTHORITY_INVALID')
  })
  it('retains conflicting evidence, interpretations and unresolved status after accountable disposition', () => {
    const proof = runSyntheticProof()
    expect(proof.executiveBrief.competingEvidence).toHaveLength(2)
    expect(proof.executiveBrief.interpretations).toHaveLength(2)
    expect(proof.executiveBrief.conflictStatus).toBe('UNRESOLVED')
    expect(proof.decision.unresolvedConflict).toBe(true)
    expect(proof.finalBrief.competingEvidence).toEqual(proof.executiveBrief.competingEvidence)
    expect(proof.finalBrief.interpretations).toEqual(proof.executiveBrief.interpretations)
    expect(proof.finalBrief.conflictStatus).toBe('UNRESOLVED')
  })
})

describe('D-GATE: one configurable, reference-first operating kernel', () => {
  it('uses the same runtime for two governed institutional configurations', () => {
    const a = runSyntheticProof('A'),
      b = runSyntheticProof('B')
    expect(a.kernel.constructor).toBe(b.kernel.constructor)
    expect(a.operatorView.label).not.toBe(b.operatorView.label)
    expect(a.operatorView.stage).not.toBe(b.operatorView.stage)
    expect(a.executiveBrief.status).toBe('DECISION_REQUIRED')
    expect(b.executiveBrief.status).toBe('DECISION_REQUIRED')
    expect(a.scenario.seed.config.materialVarianceDays).not.toBe(
      b.scenario.seed.config.materialVarianceDays,
    )
  })
  it.each([
    { version: 0 },
    { materialVarianceDays: -1 },
    { materialVarianceDays: Number.NaN },
    { requiredEvidence: [] },
    { requiredEvidence: ['Duplicate', 'Duplicate'] },
    { stages: { collecting: 'Same', decisionRequired: 'Same', decided: 'Same' } },
  ])('safely diagnoses invalid configuration %j', (override) => {
    const s = syntheticScenario()
    s.seed.config = { ...s.seed.config, ...override }
    expect(() => new CivicKernel(s.seed, clock)).toThrow('INVALID_CONFIGURATION')
  })
  it('rejects unsupported configuration fields instead of weakening kernel rules', () => {
    const s = syntheticScenario()
    const config: Configuration & { autonomousApproval: boolean } = {
      ...s.seed.config,
      autonomousApproval: true,
    }
    s.seed.config = config
    expect(() => new CivicKernel(s.seed, clock)).toThrow('INVALID_CONFIGURATION')
  })
  it('completes the operator journey with why, responsibility, missing evidence and next action', () => {
    const proof = runSyntheticProof()
    expect(proof.initialOperatorView.why).toMatch(/assurance reviews/)
    expect(proof.initialOperatorView.responsibility).toMatch(/Fictional Director/)
    expect(proof.initialOperatorView.requiredEvidence).toHaveLength(7)
    expect(proof.initialOperatorView.missingEvidence).toContain('Engagement reference')
    expect(proof.initialOperatorView.nextAction).toMatch(/authorized human/)
    expect(proof.operatorView.missingEvidence).toEqual(['Final deliverable', 'Actual spend'])
    expect(proof.operatorView.nextAction).toMatch(/record the next decision/)
  })
  it('references source evidence without document copies and supports manual capture', () => {
    const proof = runSyntheticProof()
    const references = proof.executiveBrief.evidence.filter((entry) => entry.mode === 'reference')
    expect(references).toHaveLength(3)
    expect(references.every((entry) => entry.content === undefined)).toBe(true)
    expect(
      proof.executiveBrief.evidence.some((entry) => entry.mode === 'manual' && entry.statement),
    ).toBe(true)
    expect(proof.burden.realUserValidation).toBe('NOT_YET_VALIDATED_WITH_REAL_USERS')
  })
  it('diagnoses invalid workflow and incomplete evidence rather than pretending success', () => {
    const { scenario: s, kernel: k } = start()
    expect(() => k.submitEvidence(s.principal, s.itemId, s.engagement)).toThrow(
      'INVALID_WORKFLOW_STATE',
    )
    expect(() =>
      k.recordCommitment(s.principal, s.itemId, {
        sourceId: s.engagement.id,
        ceilingCad: 80000,
        expectedDeliverables: 4,
      }),
    ).toThrow('INVALID_WORKFLOW_STATE')
    expect(() => k.decide(s.principal, s.itemId, 'change', 'Fictional review')).toThrow(
      'INVALID_WORKFLOW_STATE',
    )
    expect(k.operator(s.principal, s.itemId).diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Required evidence missing' }),
    )
  })
  it('rejects non-synthetic institutions and external source locators', () => {
    const s = syntheticScenario()
    s.seed.institution.name = 'Real agency'
    expect(() => new CivicKernel(s.seed, clock)).toThrow('SYNTHETIC_SCOPE_INVALID')
    const { scenario: activeScenario, kernel } = active()
    expect(() =>
      kernel.submitEvidence(activeScenario.principal, activeScenario.itemId, {
        ...activeScenario.engagement,
        sourceSystem: 'https://example.invalid',
      }),
    ).toThrow('INVALID_EVIDENCE')
  })
  it('isolates stored state from caller and read-model mutation', () => {
    const { scenario: s, kernel: k } = active()
    const before = k.brief(s.principal, s.itemId)
    s.seed.authorities[0].actions = []
    before.evidence[0].statement = 'Mutated fictional statement'
    expect(k.brief(s.principal, s.itemId).evidence[0].statement).not.toBe(
      before.evidence[0].statement,
    )
    expect(k.decide(s.principal, s.itemId, 'request_evidence', 'Fictional review')).toBeTruthy()
  })
})

describe('T-GATE: executable professional-services accountability', () => {
  it.each(['A', 'B'] as const)(
    'executes the complete %s chain and records an authorized human disposition',
    (institution) => {
      const proof = runSyntheticProof(institution)
      const brief = proof.executiveBrief
      expect(brief.objective).toMatch(/Fictional/)
      expect(brief.owner.id).toBe(proof.scenario.principal.actorId)
      expect(brief.approval?.actorId).toBe(brief.owner.id)
      expect(brief.authority?.instrumentId).toBe(brief.authorityInstrument?.id)
      expect(brief.commitment).toEqual({
        sourceId: proof.scenario.engagement.id,
        ceilingCad: 80000,
        expectedDeliverables: 4,
      })
      expect(brief.execution?.receivedDeliverables).toBe(3)
      expect(brief.expectedOutcome.value).toBe(10)
      expect(brief.observedOutcome?.value).toBe(14)
      expect(brief.varianceDays).toBe(4)
      expect(brief.materialVariance).toBe(true)
      expect(brief.missingEvidence).toHaveLength(2)
      expect(brief.status).toBe('DECISION_REQUIRED')
      expect(proof.finalBrief.status).toBe('DECIDED')
      expect(proof.decision.actorId).toBe(proof.scenario.principal.actorId)
      expect(proof.decision.evidenceIds).toEqual(brief.evidence.map((entry) => entry.id))
      expect(proof.audit.map((entry) => entry.action)).toEqual([
        'intervention.authorized',
        'evidence.recorded',
        'commitment.recorded',
        'evidence.recorded',
        'evidence.recorded',
        'evidence.recorded',
        'evidence.recorded',
        'evidence.recorded',
        'execution.recorded',
        'outcome.observed',
        'interpretation.recorded',
        'interpretation.recorded',
        'human.disposition',
      ])
      expect(proof.audit.every((entry) => entry.evidenceGrade === false)).toBe(true)
      expect(
        proof.audit.every(
          (entry) => !('rationale' in entry.payload) && !('content' in entry.payload),
        ),
      ).toBe(true)
    },
  )
  it('replays the same final disposition with unauthorized/machine/foreign actors and denies all without mutation', () => {
    const proof = runSyntheticProof()
    const { principal, observer, machine, itemId } = proof.scenario
    const initialEvents = proof.kernel.auditTrail(principal, itemId)
    const other = syntheticScenario('B')
    for (const caller of [observer, machine, other.principal]) {
      expect(() =>
        proof.kernel.decide(caller, itemId, 'change', 'Fictional rejected replay'),
      ).toThrow()
    }
    expect(proof.kernel.auditTrail(principal, itemId)).toEqual(initialEvents)
    expect(proof.kernel.brief(principal, itemId)).toEqual(proof.finalBrief)
  })
  it('does not invent missing observations or variance', () => {
    const { scenario: s, kernel: k } = active()
    const brief = k.brief(s.principal, s.itemId)
    expect(brief.observedOutcome).toBeNull()
    expect(brief.varianceDays).toBeNull()
    expect(brief.materialVariance).toBe(false)
    expect(brief.risks).toContain('Observed outcome missing')
    expect(brief.missingEvidence).toContain('Actual spend')
  })
  it.each([Number.NaN, Infinity, -1])('rejects invalid observed outcome %s', (value) => {
    const { scenario: s, kernel: k } = active()
    k.submitEvidence(s.principal, s.itemId, s.observation)
    expect(() =>
      k.observeOutcome(s.principal, s.itemId, {
        value,
        unit: 'working_days',
        window: 'synthetic:2026-Q3',
        evidenceId: s.observation.id,
      }),
    ).toThrow('INVALID_OUTCOME')
  })
  it('rejects incomparable measurement windows explicitly', () => {
    const { scenario: s, kernel: k } = active()
    k.submitEvidence(s.principal, s.itemId, s.observation)
    expect(() =>
      k.observeOutcome(s.principal, s.itemId, {
        value: 14,
        unit: 'working_days',
        window: 'synthetic:2026-Q4',
        evidenceId: s.observation.id,
      }),
    ).toThrow('INCOMPARABLE_OUTCOME')
    expect(k.brief(s.principal, s.itemId).observedOutcome).toBeNull()
  })
  it.each([
    [12, false],
    [12.001, true],
    [10, false],
  ])('tests exact material threshold at %s days', (observed, material) => {
    const { scenario: s, kernel: k } = active()
    k.submitEvidence(s.principal, s.itemId, s.observation)
    k.observeOutcome(s.principal, s.itemId, {
      value: observed,
      unit: 'working_days',
      window: 'synthetic:2026-Q3',
      evidenceId: s.observation.id,
    })
    expect(k.brief(s.principal, s.itemId).materialVariance).toBe(material)
  })
  it('reaches a decision requirement from review due alone at the exact timestamp', () => {
    const s = syntheticScenario()
    s.seed.config.requiredEvidence = [
      s.seed.config.requiredEvidence[0],
      s.seed.config.requiredEvidence[3],
    ]
    s.seed.items[0].commitment = {
      sourceId: s.seed.evidence[0].id,
      ceilingCad: 1,
      expectedDeliverables: 1,
    }
    s.seed.items[0].execution = { sourceId: s.seed.evidence[0].id, receivedDeliverables: 1 }
    s.seed.evidence.push({ ...s.observation, requirement: s.seed.config.requiredEvidence[1] })
    s.seed.items[0].observed = { ...s.seed.items[0].expected, evidenceId: s.observation.id }
    let now = new Date('2026-10-14T23:59:59Z')
    const k = new CivicKernel(s.seed, () => now)
    k.authorizeIntervention(s.principal, s.itemId)
    expect(k.brief(s.principal, s.itemId).status).toBe('COLLECTING')
    now = new Date('2026-10-15T00:00:00Z')
    expect(k.brief(s.principal, s.itemId).risks).toEqual(['Review due'])
    expect(k.brief(s.principal, s.itemId).status).toBe('DECISION_REQUIRED')
  })
  it('keeps final human decisions and decided items immutable', () => {
    const proof = runSyntheticProof()
    const { principal, itemId } = proof.scenario
    expect(() =>
      proof.kernel.decide(principal, itemId, 'terminate', 'Fictional overwrite'),
    ).toThrow('INVALID_WORKFLOW_STATE')
    expect(() =>
      proof.kernel.submitEvidence(principal, itemId, {
        ...proof.scenario.engagement,
        id: 'SYN-NEW-ENGAGEMENT',
      }),
    ).toThrow('INVALID_WORKFLOW_STATE')
    expect(proof.kernel.brief(principal, itemId).humanDecision).toEqual(proof.decision)
  })
})
