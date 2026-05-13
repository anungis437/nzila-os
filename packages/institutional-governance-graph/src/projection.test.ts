/**
 * Phase 2 — IGG projection tests.
 *
 * Pure-function coverage. No DB, no IO, no side-effects.
 */
import { describe, expect, it } from 'vitest'
import type {
  CongressMembershipSource,
  InstitutionalGovernanceSourceAdapter,
  MotionSource,
  NegotiationSource,
  OrganizationSource,
  RepresentationProtocolSource,
  ReservedMatterVoteSource,
  VotingEligibilitySource,
} from './adapters/source-adapter.js'
import { mapInstitutionalDecision } from './decisions/mapper.js'
import {
  resolveDelegationChains,
  type DelegationEdgeInput,
} from './delegation/resolver.js'
import {
  LifecycleStatuses,
  normalizeLifecycleStatus,
} from './lifecycle/normalize.js'
import { IggEntityKinds, IggRelationshipKinds } from './ontology/kinds.js'
import { projectAffiliationEdges } from './projection/affiliations.js'
import { buildGovernanceGraphProjection } from './projection/build.js'
import {
  projectOrganizationHierarchyEdges,
  projectOrganizationNodes,
} from './projection/organizations.js'
import {
  projectDelegationEdges,
  projectVotingEligibilityEdges,
} from './projection/voting.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

const orgRows: readonly OrganizationSource[] = [
  {
    id: 'org-clc',
    tenantId: 'tenant-1',
    name: 'Canadian Labour Congress',
    slug: 'clc',
    organizationType: 'congress',
    parentId: null,
    hierarchyPath: ['org-clc'],
    hierarchyLevel: 0,
    status: 'active',
  },
  {
    id: 'org-cupe',
    tenantId: 'tenant-1',
    name: 'CUPE National',
    slug: 'cupe',
    organizationType: 'union',
    parentId: 'org-clc',
    hierarchyPath: ['org-clc', 'org-cupe'],
    hierarchyLevel: 1,
    status: 'active',
  },
  {
    id: 'org-cupe-1500',
    tenantId: 'tenant-1',
    name: 'CUPE Local 1500',
    slug: 'cupe-1500',
    organizationType: 'local',
    parentId: 'org-cupe',
    hierarchyPath: ['org-clc', 'org-cupe', 'org-cupe-1500'],
    hierarchyLevel: 2,
    status: 'inactive', // alias → dormant
  },
]

// ── Tests ───────────────────────────────────────────────────────────────────

describe('1. Organization node projection', () => {
  it('projects each org row to one EntityNode preserving id and tenant', () => {
    const nodes = projectOrganizationNodes(orgRows)
    expect(nodes).toHaveLength(3)
    const clc = nodes.find((n) => n.entityId === 'org-clc')!
    expect(clc.entityType).toBe('Organization')
    expect(clc.tenantId).toBe('tenant-1')
    expect(clc.canonicalName).toBe('Canadian Labour Congress')
    expect(clc.metadata.iggKind).toBe(IggEntityKinds.CONGRESS)
    expect(clc.metadata.organizationType).toBe('congress')
    expect(clc.status).toBe(LifecycleStatuses.ACTIVE)
  })

  it('preserves hierarchy metadata', () => {
    const nodes = projectOrganizationNodes(orgRows)
    const local = nodes.find((n) => n.entityId === 'org-cupe-1500')!
    expect(local.metadata.hierarchyLevel).toBe(2)
    expect(local.metadata.hierarchyPath).toEqual([
      'org-clc',
      'org-cupe',
      'org-cupe-1500',
    ])
  })
})

describe('2. Parent-child edge projection', () => {
  it('emits one parent_of edge per row with a parent', () => {
    const edges = projectOrganizationHierarchyEdges(orgRows)
    expect(edges).toHaveLength(2)
    const e = edges.find((e) => e.targetEntityId === 'org-cupe-1500')!
    expect(e.sourceEntityId).toBe('org-cupe')
    expect(e.relationshipType).toBe('PARENT_OF')
    expect(e.metadata.iggKind).toBe(IggRelationshipKinds.PARENT_OF)
  })

  it('emits no edge for root orgs', () => {
    const edges = projectOrganizationHierarchyEdges([orgRows[0]!])
    expect(edges).toHaveLength(0)
  })
})

describe('3. Congress membership edge projection', () => {
  it('emits affiliated_with edges with lifecycle metadata', () => {
    const memberships: readonly CongressMembershipSource[] = [
      {
        id: 'memb-1',
        tenantId: 'tenant-1',
        congressId: 'org-clc',
        memberOrganizationId: 'org-cupe',
        status: 'active',
        validFrom: '2020-01-01T00:00:00Z',
        validTo: null,
      },
    ]
    const edges = projectAffiliationEdges(memberships)
    expect(edges).toHaveLength(1)
    expect(edges[0]!.sourceEntityId).toBe('org-cupe')
    expect(edges[0]!.targetEntityId).toBe('org-clc')
    expect(edges[0]!.metadata.iggKind).toBe(
      IggRelationshipKinds.AFFILIATED_WITH,
    )
    expect(edges[0]!.metadata.validFrom).toBe('2020-01-01T00:00:00Z')
    expect(edges[0]!.metadata.lifecycleStatus).toBe(LifecycleStatuses.ACTIVE)
  })
})

describe('4. Lifecycle normalization', () => {
  it('passes through known statuses', () => {
    expect(normalizeLifecycleStatus('active').status).toBe(
      LifecycleStatuses.ACTIVE,
    )
    expect(normalizeLifecycleStatus('VETOED').status).toBe(
      LifecycleStatuses.VETOED,
    )
  })

  it('maps known aliases', () => {
    expect(normalizeLifecycleStatus('inactive').status).toBe(
      LifecycleStatuses.DORMANT,
    )
    expect(normalizeLifecycleStatus('archived').status).toBe(
      LifecycleStatuses.EXPIRED,
    )
    expect(normalizeLifecycleStatus('passed').status).toBe(
      LifecycleStatuses.CARRIED,
    )
    expect(normalizeLifecycleStatus('ratified').status).toBe(
      LifecycleStatuses.APPROVED,
    )
  })
})

describe('5. Unknown lifecycle preservation', () => {
  it('does not throw on unknown values', () => {
    const r = normalizeLifecycleStatus('quantum_superposition')
    expect(r.status).toBe(LifecycleStatuses.UNKNOWN)
    expect(r.originalStatus).toBe('quantum_superposition')
    expect(r.warning).toContain('unrecognized')
  })

  it('does not throw on null / undefined / non-string', () => {
    expect(normalizeLifecycleStatus(null).status).toBe(LifecycleStatuses.UNKNOWN)
    expect(normalizeLifecycleStatus(undefined).status).toBe(
      LifecycleStatuses.UNKNOWN,
    )
    expect(normalizeLifecycleStatus(42 as unknown).status).toBe(
      LifecycleStatuses.UNKNOWN,
    )
    expect(normalizeLifecycleStatus('').status).toBe(LifecycleStatuses.UNKNOWN)
  })
})

describe('6. Voting eligibility edge projection', () => {
  const eligibility: readonly VotingEligibilitySource[] = [
    {
      id: 'elig-1',
      tenantId: 'tenant-1',
      votingSessionId: 'session-1',
      voterEntityType: 'member',
      voterEntityId: 'mbr-1',
      votingWeight: 1,
      status: 'active',
    },
  ]

  it('emits eligible_to_vote_in edges with weight metadata', () => {
    const edges = projectVotingEligibilityEdges(eligibility)
    expect(edges).toHaveLength(1)
    expect(edges[0]!.sourceEntityId).toBe('mbr-1')
    expect(edges[0]!.targetEntityId).toBe('session-1')
    expect(edges[0]!.relationshipType).toBe('LINKS_TO')
    expect(edges[0]!.metadata.iggKind).toBe(
      IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN,
    )
    expect(edges[0]!.metadata.votingWeight).toBe(1)
  })
})

describe('7. Delegates-to edge projection', () => {
  it('emits delegates_to edges only when delegatedToEntityId is set', () => {
    const rows: readonly VotingEligibilitySource[] = [
      {
        id: 'elig-A',
        tenantId: 't',
        votingSessionId: 'session-1',
        voterEntityType: 'member',
        voterEntityId: 'mbr-A',
        votingWeight: 1,
        status: 'active',
        delegatedToEntityId: 'mbr-B',
        delegatedToEntityType: 'member',
      },
      {
        id: 'elig-X',
        tenantId: 't',
        votingSessionId: 'session-1',
        voterEntityType: 'member',
        voterEntityId: 'mbr-X',
        votingWeight: 1,
        status: 'active',
      },
    ]
    const edges = projectDelegationEdges(rows)
    expect(edges).toHaveLength(1)
    expect(edges[0]!.sourceEntityId).toBe('mbr-A')
    expect(edges[0]!.targetEntityId).toBe('mbr-B')
    expect(edges[0]!.metadata.iggKind).toBe(IggRelationshipKinds.DELEGATES_TO)
    expect(edges[0]!.metadata.votingWeight).toBe(1)
  })
})

describe('8. Delegation cycle detection', () => {
  it('detects A→B→C linear chain as resolved with accumulated weight', () => {
    const edges: readonly DelegationEdgeInput[] = [
      { fromEntityId: 'A', toEntityId: 'B', votingWeight: 1, votingSessionId: 's' },
      { fromEntityId: 'B', toEntityId: 'C', votingWeight: 2, votingSessionId: 's' },
    ]
    const resolutions = resolveDelegationChains(edges)
    const a = resolutions.find((r) => r.originatorEntityId === 'A')!
    expect(a.state).toBe('resolved')
    expect(a.terminalEntityId).toBe('C')
    expect(a.accumulatedWeight).toBe(3)
    expect(a.path).toEqual(['A', 'B', 'C'])
  })

  it('detects A→B→A cycle and marks cyclic without throwing', () => {
    const edges: readonly DelegationEdgeInput[] = [
      { fromEntityId: 'A', toEntityId: 'B', votingWeight: 1, votingSessionId: 's' },
      { fromEntityId: 'B', toEntityId: 'A', votingWeight: 1, votingSessionId: 's' },
    ]
    const resolutions = resolveDelegationChains(edges)
    const a = resolutions.find((r) => r.originatorEntityId === 'A')!
    expect(a.state).toBe('cyclic')
    expect(a.cycleDetectedAt).toBe('A')
    expect(a.terminalEntityId).toBeNull()
    expect(a.warning).toContain('cycle')
  })
})

describe('9. Decision skeleton mapping', () => {
  it('maps a class_b_veto into a REJECTION DecisionNode with terminal status', () => {
    const node = mapInstitutionalDecision({
      category: 'class_b_veto',
      tenantId: 'tenant-1',
      sourceRecordId: 'rmv-1',
      subjectEntityId: 'rm-1',
      summary: 'UMRC vetoes mission change',
      outcomeRaw: 'vetoed',
      actorEntityId: 'umrc-1',
      occurredAt: '2026-05-01T00:00:00Z',
      evidenceRefs: ['ev-1'],
      policyRefs: ['policy-mission-1'],
      reasoning: 'Mission change inconsistent with chartered purpose.',
    })
    expect(node.decisionType).toBe('rejection')
    expect(node.status).toBe('executed')
    expect(node.actorId).toBe('umrc-1')
    expect(node.outcome.iggCategory).toBe('class_b_veto')
    expect(node.policyRefs).toEqual(['policy-mission-1'])
    expect(node.evidenceRefs).toEqual(['ev-1'])
    expect(node.reasoning).toContain('chartered purpose')
  })

  it('does not invent fields the input does not provide', () => {
    const node = mapInstitutionalDecision({
      category: 'motion_outcome',
      tenantId: 'tenant-1',
      sourceRecordId: 'm-1',
      subjectEntityId: 'committee-1',
      summary: 'Motion to adjourn',
      outcomeRaw: 'carried',
      actorEntityId: 'mbr-1',
      occurredAt: '2026-05-01T00:00:00Z',
    })
    expect(node.policyRefs).toEqual([])
    expect(node.evidenceRefs).toEqual([])
    expect(node.knowledgeRefs).toEqual([])
    expect(node.reasoning).toBeUndefined()
    expect(node.confidence).toBeUndefined()
  })
})

describe('10. Build full projection from a mock adapter', () => {
  const motions: readonly MotionSource[] = [
    {
      id: 'mot-1',
      tenantId: 'tenant-1',
      committeeId: 'cmte-1',
      title: 'Motion to ratify CBA terms',
      outcome: 'carried',
      decidedAt: '2026-04-01T00:00:00Z',
      proposerEntityId: 'mbr-1',
    },
  ]
  const reservedMatterVotes: readonly ReservedMatterVoteSource[] = [
    {
      id: 'rmv-1',
      tenantId: 'tenant-1',
      reservedMatterId: 'rm-1',
      classBHolderEntityId: 'umrc-1',
      outcome: 'approved',
      castAt: '2026-04-15T00:00:00Z',
    },
  ]
  const negotiations: readonly NegotiationSource[] = [
    {
      id: 'neg-1',
      tenantId: 'tenant-1',
      bargainingUnitId: 'bu-1',
      employerOrganizationId: 'emp-1',
      status: 'completed',
      cbaRatifiedAt: '2026-04-20T00:00:00Z',
    },
  ]
  const protocols: readonly RepresentationProtocolSource[] = [
    {
      id: 'rp-1',
      tenantId: 'tenant-1',
      representativeEntityType: 'lro',
      representativeEntityId: 'lro-1',
      representedEntityType: 'member',
      representedEntityId: 'mbr-1',
      protocolVersion: '1.0',
      status: 'active',
      validFrom: '2025-01-01T00:00:00Z',
      validTo: null,
    },
  ]
  const eligibility: readonly VotingEligibilitySource[] = [
    {
      id: 'elig-1',
      tenantId: 'tenant-1',
      votingSessionId: 'session-1',
      voterEntityType: 'member',
      voterEntityId: 'mbr-1',
      votingWeight: 1,
      status: 'active',
      delegatedToEntityId: 'mbr-2',
      delegatedToEntityType: 'member',
    },
  ]

  const adapter: InstitutionalGovernanceSourceAdapter = {
    listOrganizations: () => Promise.resolve(orgRows),
    listCongressMemberships: () =>
      Promise.resolve([
        {
          id: 'memb-1',
          tenantId: 'tenant-1',
          congressId: 'org-clc',
          memberOrganizationId: 'org-cupe',
          status: 'active',
          validFrom: null,
          validTo: null,
        },
      ]),
    listVotingEligibility: () => Promise.resolve(eligibility),
    listRepresentationProtocols: () => Promise.resolve(protocols),
    listReservedMatterVotes: () => Promise.resolve(reservedMatterVotes),
    listMotions: () => Promise.resolve(motions),
    listNegotiations: () => Promise.resolve(negotiations),
  }

  it('builds a coherent projection with stable counts', async () => {
    const proj = await buildGovernanceGraphProjection(adapter)
    expect(proj.stats.organizationCount).toBe(3)
    expect(proj.stats.hierarchyEdgeCount).toBe(2)
    expect(proj.stats.affiliationEdgeCount).toBe(1)
    expect(proj.stats.eligibilityEdgeCount).toBe(1)
    expect(proj.stats.delegationEdgeCount).toBe(1)
    expect(proj.stats.representationEdgeCount).toBe(1)
    // 1 motion + 1 RMV + 1 CBA ratification + 1 protocol amendment
    expect(proj.stats.decisionCount).toBe(4)
    expect(proj.delegationResolutions).toHaveLength(1)
    expect(proj.delegationResolutions[0]!.state).toBe('resolved')
  })

  it('is deterministic under repeated invocation', async () => {
    const a = await buildGovernanceGraphProjection(adapter)
    const b = await buildGovernanceGraphProjection(adapter)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
