import { CivicKernel, type Seed, type Principal, type Evidence, type Authority } from './kernel'

export function syntheticScenario(institution: 'A' | 'B' = 'A') {
  const prefix = `SYN-${institution}`
  const orgId = `${prefix}-ORG`
  const itemId = `${prefix}-ITEM`
  const ownerId = `${prefix}-OWNER`
  const positionId = `${prefix}-POSITION`
  const issuedAt = '2026-01-01T00:00:00Z'
  const expiresAt = '2026-12-31T00:00:00Z'
  const labels =
    institution === 'A'
      ? [
          'Gap note',
          'Engagement reference',
          'Receipt reference',
          'Outcome target',
          'Outcome observation',
          'Final deliverable',
          'Actual spend',
        ]
      : [
          'Reason for work',
          'Resource undertaking',
          'Work received',
          'Service expectation',
          'Service result',
          'Outstanding work',
          'Expenditure evidence',
        ]
  const evidence = (
    suffix: string,
    requirement: number,
    category: Evidence['category'],
    mode: Evidence['mode'],
    statement: string,
    claimKey = suffix,
    derivedFrom: string[] = [],
  ): Evidence => ({
    syntheticOnly: true,
    id: `${prefix}-${suffix}`,
    orgId,
    resourceId: itemId,
    requirement: labels[requirement],
    category,
    mode,
    sourceSystem: 'synthetic:fictional-register',
    recordId: `${prefix}-RECORD-${suffix}`,
    version: '1',
    sourceOwner: orgId,
    occurredAt: '2026-09-30T00:00:00Z',
    derivedFrom,
    statement,
    claimKey,
  })
  const seed: Seed = {
    syntheticOnly: true,
    institution: {
      id: orgId,
      name: `Fictional ${institution} Service Office`,
      slug: `fictional-${institution.toLowerCase()}`,
      status: 'active',
      createdAt: issuedAt,
    },
    config: {
      syntheticOnly: true,
      id: `${prefix}-CONFIG`,
      orgId,
      version: 1,
      itemLabel: institution === 'A' ? 'Service improvement' : 'Assurance undertaking',
      ownerLabel: institution === 'A' ? 'Responsible director' : 'Accountable lead',
      operatorRole: institution === 'A' ? 'service_operator' : 'assurance_coordinator',
      requiredEvidence: labels,
      stages:
        institution === 'A'
          ? {
              collecting: 'Gather what is needed',
              decisionRequired: 'Human review needed',
              decided: 'Human response recorded',
            }
          : {
              collecting: 'Prepare the record',
              decisionRequired: 'Decision awaits a person',
              decided: 'Disposition on file',
            },
      materialVarianceDays: institution === 'A' ? 2 : 3,
    },
    positions: [
      { syntheticOnly: true, orgId, id: positionId, label: 'Fictional Service Assurance Director' },
      {
        syntheticOnly: true,
        orgId,
        id: `${prefix}-OBSERVER-POSITION`,
        label: 'Fictional Observer',
      },
    ],
    actors: [
      {
        id: ownerId,
        kind: 'human' as const,
        positionId,
        label: 'Fictional Director',
        email: 'director',
      },
      {
        id: `${prefix}-OBSERVER`,
        kind: 'human' as const,
        positionId: `${prefix}-OBSERVER-POSITION`,
        label: 'Fictional Observer',
        email: 'observer',
      },
      {
        id: `${prefix}-MACHINE`,
        kind: 'system' as const,
        positionId: `${prefix}-OBSERVER-POSITION`,
        label: 'Fictional Automation',
        email: 'automation',
      },
    ].map((actor) => ({
      syntheticOnly: true as const,
      orgId,
      id: actor.id,
      kind: actor.kind,
      positionId: actor.positionId,
      session: {
        sessionId: `${actor.id}-SESSION`,
        activeOrgId: orgId,
        issuedAt,
        expiresAt,
        user: {
          userId: actor.id,
          email: `${actor.email}@example.invalid`,
          displayName: actor.label,
          onboarded: true,
        },
      },
    })),
    instruments: [
      {
        syntheticOnly: true,
        orgId,
        id: `${prefix}-INSTRUMENT`,
        category: 'authoritative_record',
        sourceSystem: 'synthetic:authority-register',
        recordId: `${prefix}-AUTHORITY-RECORD`,
        version: '1',
      },
    ],
    memberships: [ownerId, `${prefix}-OBSERVER`, `${prefix}-MACHINE`].map((userId) => ({
      userId,
      orgId,
      role: institution === 'A' ? 'service_operator' : 'assurance_coordinator',
      status: 'active' as const,
      joinedAt: issuedAt,
    })),
    authorities: [
      {
        syntheticOnly: true,
        orgId,
        id: `${prefix}-AUTHORITY`,
        actorId: ownerId,
        positionId,
        instrumentId: `${prefix}-INSTRUMENT`,
        resourceId: itemId,
        actions: ['grant_authority', 'authorize_intervention', 'record_evidence', 'decide'],
        effectiveAt: issuedAt,
        expiresAt,
        revokedAt: null,
      },
    ],
    items: [
      {
        syntheticOnly: true,
        id: itemId,
        orgId,
        ownerId,
        objective:
          'Fictional staff should complete assurance reviews without recurring outside help',
        intervention: 'Fictional time-limited professional-services knowledge transfer',
        reviewDue: '2026-10-15T00:00:00Z',
        commitment: null,
        execution: null,
        observed: null,
        expected: {
          value: 10,
          unit: 'working_days',
          window: 'synthetic:2026-Q3',
          evidenceId: `${prefix}-TARGET`,
        },
      },
    ],
    evidence: [
      evidence(
        'GAP',
        0,
        'institutional_interpretation',
        'manual',
        'Fictional capability gap identified',
      ),
      evidence(
        'TARGET',
        3,
        'decision_artifact',
        'manual',
        'Fictional approved target is ten working days',
      ),
    ],
    interpretations: [],
  }
  const principal: Principal = { orgId, actorId: ownerId, sessionId: `${ownerId}-SESSION` }
  const observer: Principal = {
    orgId,
    actorId: `${prefix}-OBSERVER`,
    sessionId: `${prefix}-OBSERVER-SESSION`,
  }
  const machine: Principal = {
    orgId,
    actorId: `${prefix}-MACHINE`,
    sessionId: `${prefix}-MACHINE-SESSION`,
  }
  const engagement = evidence(
    'ENGAGEMENT',
    1,
    'referenced_authoritative_record',
    'reference',
    'Fictional engagement ceiling CAD 80000',
  )
  const receipts = evidence(
    'RECEIPTS',
    2,
    'referenced_authoritative_record',
    'reference',
    'Three fictional deliverables received',
    'receipt-count',
  )
  const contraryReceipts = evidence(
    'CONTRARY-RECEIPTS',
    2,
    'referenced_authoritative_record',
    'reference',
    'Four fictional deliverables claimed',
    'receipt-count',
  )
  const observation = evidence(
    'OBSERVATION',
    4,
    'authoritative_record',
    'manual',
    'Fictional turnaround is fourteen working days',
  )
  const derived = evidence(
    'DERIVED',
    4,
    'derived_evidence',
    'manual',
    'Fictional derived difference is four working days',
    'derived-variance',
    [seed.items[0].expected.evidenceId, observation.id],
  )
  return {
    seed,
    principal,
    observer,
    machine,
    itemId,
    prefix,
    evidence,
    engagement,
    receipts,
    contraryReceipts,
    observation,
    derived,
  }
}

export function runSyntheticProof(institution: 'A' | 'B' = 'A') {
  const scenario = syntheticScenario(institution)
  const { principal, itemId } = scenario
  const kernel = new CivicKernel(scenario.seed, () => new Date('2026-10-10T17:00:00Z'))
  const initialOperatorView = kernel.operator(principal, itemId)
  kernel.authorizeIntervention(principal, itemId)
  const reference = (record: Evidence) => {
    kernel.referenceRecord(principal, itemId, {
      id: record.id,
      requirement: record.requirement,
      sourceSystem: record.sourceSystem,
      recordId: record.recordId,
      version: record.version,
      sourceOwner: record.sourceOwner,
      recordedAt: record.occurredAt,
      description: record.statement,
    })
  }
  reference(scenario.engagement)
  kernel.recordCommitment(principal, itemId, {
    sourceId: scenario.engagement.id,
    ceilingCad: 80000,
    expectedDeliverables: 4,
  })
  reference(scenario.receipts)
  reference(scenario.contraryReceipts)
  kernel.captureNote(principal, itemId, {
    id: `${scenario.prefix}-OPERATOR-NOTE`,
    requirement: scenario.seed.config.requiredEvidence[0],
    note: 'Fictional operator confirms the capability gap',
    recordedAt: '2026-10-10T17:00:00Z',
  })
  for (const record of [scenario.observation, scenario.derived])
    kernel.submitEvidence(principal, itemId, record)
  kernel.recordExecution(principal, itemId, {
    sourceId: scenario.receipts.id,
    receivedDeliverables: 3,
  })
  kernel.observeOutcome(principal, itemId, {
    value: 14,
    unit: 'working_days',
    window: 'synthetic:2026-Q3',
    evidenceId: scenario.observation.id,
  })
  for (const [index, statement] of [
    'Fictional staffing interruption may explain the result',
    'Fictional incomplete knowledge transfer may explain the result',
  ].entries()) {
    kernel.addInterpretation(principal, itemId, {
      syntheticOnly: true,
      orgId: principal.orgId,
      id: `${scenario.prefix}-INTERPRETATION-${index}`,
      resourceId: itemId,
      authorId: principal.actorId,
      evidenceIds: [scenario.receipts.id, scenario.observation.id],
      statement,
    })
  }
  const executiveBrief = kernel.brief(principal, itemId)
  const operatorView = kernel.operator(principal, itemId)
  const decision = kernel.decide(
    principal,
    itemId,
    'request_evidence',
    'Fictional human requests final deliverable and spend evidence; retain both competing explanations',
  )
  return {
    scenario,
    kernel,
    initialOperatorView,
    operatorView,
    executiveBrief,
    decision,
    finalBrief: kernel.brief(principal, itemId),
    audit: kernel.auditTrail(principal, itemId),
    burden: {
      sourceDocumentCopies: 0,
      referenceRecords: 3,
      realUserValidation: 'NOT_YET_VALIDATED_WITH_REAL_USERS',
    },
  }
}

export function syntheticDelegation(scenario: ReturnType<typeof syntheticScenario>): Authority {
  return {
    ...scenario.seed.authorities[0],
    id: `${scenario.prefix}-OBSERVER-AUTHORITY`,
    actorId: scenario.observer.actorId,
    positionId: `${scenario.prefix}-OBSERVER-POSITION`,
    actions: ['decide'],
  }
}
