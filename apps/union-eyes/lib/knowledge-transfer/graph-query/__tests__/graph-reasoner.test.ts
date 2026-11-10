/**
 * Organizational Graph Reasoner — Unit Tests
 *
 * Mocks buildDependencyPropagationMap with a rich PropagationMap and runs
 * executeGraphQuery for all 9 query types, exercising every query handler and
 * its inline closures plus calculateConfidenceScore branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphQuery, QueryType } from '../query-models';

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), listVerifiedDependencies: vi.fn(), listActiveNodeAliases: vi.fn(async () => []) }));

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  listVerifiedDependencies: mocks.listVerifiedDependencies,
}));
vi.mock('@/lib/knowledge-transfer/propagation/node-alias-store', () => ({
  listActiveNodeAliases: mocks.listActiveNodeAliases,
}));

import { executeGraphQuery } from '../graph-reasoner';
import { currentVerifiedRecord } from '@/lib/knowledge-transfer/propagation/__tests__/verified-record-fixture';

function richMap() {
  return {
    organizationId: 'org-1',
    generatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'gov_sole', label: 'Governance Sole', nodeType: 'governance', category: 'governance',
        frequency: 1, associatedRoles: ['President'], isSingleSource: true,
        continuitySensitivity: 'critical', sensitivityReason: 'sole governance expert',
      },
      {
        id: 'compliance_x', label: 'Compliance X', nodeType: 'governance', category: 'compliance',
        frequency: 2, associatedRoles: ['Officer', 'VP'], isSingleSource: false,
        continuitySensitivity: 'high', sensitivityReason: 'limited redundancy',
      },
      {
        id: 'vendor_a', label: 'Vendor A', nodeType: 'vendor', category: 'vendor',
        frequency: 1, associatedRoles: ['Treasurer'], isSingleSource: true,
        continuitySensitivity: 'high', sensitivityReason: 'sole vendor',
      },
      {
        id: 'system_b', label: 'System B', nodeType: 'system', category: 'system',
        frequency: 4, associatedRoles: ['IT', 'Admin', 'Ops', 'Sup'], isSingleSource: false,
        continuitySensitivity: 'medium', sensitivityReason: 'distributed',
      },
      {
        id: 'common_c', label: 'Common C', nodeType: 'expertise', category: 'general',
        frequency: 6, associatedRoles: ['Many'], isSingleSource: false,
        continuitySensitivity: 'low', sensitivityReason: 'widely held',
      },
    ],
    edges: [
      { dependentId: 'compliance_x', dependsOnId: 'gov_sole', strength: 'critical', evidenceCount: 5, rationale: 'r' },
    ],
    downstreamImpacts: [
      {
        nodeId: 'gov_sole', directDependents: ['compliance_x'], allAffectedNodes: ['compliance_x', 'system_b'],
        propagationPaths: [
          {
            originId: 'gov_sole', chainPath: ['gov_sole', 'compliance_x', 'system_b', 'common_c'],
            impactScore: 85, disruptionScope: 'critical', recoveryTimeWeeks: 8,
            affectedRoles: ['President', 'Officer'], chainDepth: 4,
          },
          {
            originId: 'gov_sole', chainPath: ['gov_sole', 'compliance_x'],
            impactScore: 50, disruptionScope: 'local', recoveryTimeWeeks: 2,
            affectedRoles: ['President'], chainDepth: 2,
          },
        ],
        totalExposureScore: 85, governanceExposure: ['Compliance X'], vendorDependencyExposure: ['Vendor A'],
        mitigation: { priority: 'critical', actions: ['Document gov_sole'] },
      },
      {
        nodeId: 'vendor_a', directDependents: [], allAffectedNodes: [],
        propagationPaths: [], totalExposureScore: 40, governanceExposure: [], vendorDependencyExposure: [],
        mitigation: { priority: 'medium', actions: [] },
      },
    ],
    upstreamDependencies: [],
    couplingAnalysis: [],
    bottlenecks: [
      { nodeId: 'gov_sole', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['President'] },
      { nodeId: 'vendor_a', reason: 'critical_vendor', riskLevel: 'high', affectedRoles: ['Treasurer'] },
    ],
    resilience: { recommendations: ['Document gov_sole'], priorityOrder: ['gov_sole'], estimatedEffort: { gov_sole: 'medium' } },
  };
}

function q(queryType: QueryType, filters?: GraphQuery['filters']): GraphQuery {
  return { organizationId: 'org-1', queryType, explanationLevel: 'detailed', filters };
}

describe('executeGraphQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildMap.mockResolvedValue(richMap());
    mocks.listVerifiedDependencies.mockResolvedValue([]);
  });

  const types: QueryType[] = [
    'isolated_knowledge',
    'continuity_bottlenecks',
    'governance_dependencies',
    'fragile_operations',
    'vendor_concentration',
    'undocumented_chains',
    'propagation_paths',
    'resilience_weaknesses',
    'knowledge_redundancy',
  ];

  for (const t of types) {
    it(`handles query type: ${t}`, async () => {
      const result = await executeGraphQuery('org-1', q(t));
      expect(result.organizationId).toBe('org-1');
      expect(result.query.queryType).toBe(t);
      expect(typeof result.summary).toBe('string');
      expect(typeof result.significance).toBe('string');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.evidenceCoverageScore).toBeGreaterThanOrEqual(0);
      expect(result.evidenceCoverageScore).toBeLessThanOrEqual(100);
      expect(typeof result.executedAt).toBe('string');
    });
  }

  it('isolated_knowledge surfaces single-source nodes', async () => {
    const result = await executeGraphQuery('org-1', q('isolated_knowledge'));
    const ids = result.findings.map((f) => f.entityId);
    expect(ids).toContain('gov_sole');
    expect(ids).toContain('vendor_a');
    expect(ids).not.toContain('common_c');
  });

  it('isolated_knowledge applies minimumRiskLevel filter', async () => {
    const result = await executeGraphQuery('org-1', q('isolated_knowledge', { minimumRiskLevel: 'critical' }));
    const ids = result.findings.map((f) => f.entityId);
    expect(ids).toContain('gov_sole'); // critical
    expect(ids).not.toContain('vendor_a'); // only 'high'
  });

  it('continuity_bottlenecks maps bottleneck impacts with vendor mitigation', async () => {
    const result = await executeGraphQuery('org-1', q('continuity_bottlenecks'));
    expect(result.findings).toHaveLength(2);
    const vendor = result.findings.find((f) => f.entityId === 'vendor_a');
    // vendor node not in nodes for bottleneck? vendor_a IS a node with category vendor
    expect(vendor?.mitigation).toBe('Establish alternative vendor relationships');
    const gov = result.findings.find((f) => f.entityId === 'gov_sole');
    expect(gov?.mitigation).toBe('Document and cross-train');
  });

  it('governance_dependencies returns governance + compliance nodes', async () => {
    const result = await executeGraphQuery('org-1', q('governance_dependencies'));
    const ids = result.findings.map((f) => f.entityId);
    expect(ids).toEqual(expect.arrayContaining(['gov_sole', 'compliance_x']));
    expect(ids).not.toContain('vendor_a');
  });

  it('fragile_operations returns critical + high nodes', async () => {
    const result = await executeGraphQuery('org-1', q('fragile_operations'));
    const ids = result.findings.map((f) => f.entityId);
    expect(ids).toEqual(expect.arrayContaining(['gov_sole', 'compliance_x', 'vendor_a']));
    expect(ids).not.toContain('common_c');
  });

  it('vendor_concentration uses downstream impact affected areas', async () => {
    const result = await executeGraphQuery('org-1', q('vendor_concentration'));
    const v = result.findings.find((f) => f.entityId === 'vendor_a');
    expect(v).toBeDefined();
    expect(v?.entityType).toBe('node');
  });

  it('undocumented_chains builds chains for single-source nodes', async () => {
    const result = await executeGraphQuery('org-1', q('undocumented_chains'));
    expect(result.findings.every((f) => f.entityType === 'path')).toBe(true);
    expect(result.findings.some((f) => f.entityId === 'chain_gov_sole')).toBe(true);
  });

  it('propagation_paths flattens downstream paths', async () => {
    const result = await executeGraphQuery('org-1', q('propagation_paths'));
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((f) => f.entityType === 'path')).toBe(true);
    // critical path -> riskLevel critical
    expect(result.findings.some((f) => f.riskLevel === 'critical')).toBe(true);
  });

  it('resilience_weaknesses maps bottlenecks', async () => {
    const result = await executeGraphQuery('org-1', q('resilience_weaknesses'));
    expect(result.findings).toHaveLength(2);
    expect(result.summary).toContain('1 critical');
  });

  it('knowledge_redundancy produces a single cluster summary', async () => {
    const result = await executeGraphQuery('org-1', q('knowledge_redundancy'));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].entityType).toBe('cluster');
    expect(result.findings[0].entityId).toBe('redundancy_summary');
  });

  it('evidence coverage score is derived from interview volume alone, not from how many findings or bottlenecks were surfaced', async () => {
    mocks.buildMap.mockResolvedValue({
      ...richMap(),
      nodes: [{
        id: 'x', label: 'X', nodeType: 'expertise', category: 'general', frequency: 1,
        associatedRoles: [], isSingleSource: false, continuitySensitivity: 'low', sensitivityReason: '',
      }],
      bottlenecks: [],
      downstreamImpacts: [],
    });
    const sparse = await executeGraphQuery('org-1', q('knowledge_redundancy'));
    // One interview total (frequency: 1) is below MIN_COHORT_SIZE, so coverage is the lowest non-zero tier (40),
    // regardless of how many findings or bottlenecks this particular query surfaced.
    expect(sparse.evidenceCoverageScore).toBe(40);

    mocks.buildMap.mockResolvedValue({
      ...richMap(),
      nodes: [{
        id: 'x', label: 'X', nodeType: 'expertise', category: 'general', frequency: 1,
        associatedRoles: [], isSingleSource: false, continuitySensitivity: 'low', sensitivityReason: '',
      }],
      // Many bottlenecks must NOT inflate the evidence-coverage score - interview volume is unchanged.
      bottlenecks: [
        { nodeId: 'x', reason: 'single_source', riskLevel: 'critical', affectedRoles: [] },
        { nodeId: 'x', reason: 'high_dependents', riskLevel: 'critical', affectedRoles: [] },
      ],
    });
    const manyBottlenecks = await executeGraphQuery('org-1', q('knowledge_redundancy'));
    expect(manyBottlenecks.evidenceCoverageScore).toBe(sparse.evidenceCoverageScore);
  });

  function richNode(id: string) {
    return richMap().nodes.find((n) => n.id === id)!;
  }
  /** A current verified record: `dependent` depends on `dependsOn`, fingerprinted over richMap()'s nodes. */
  function verified(dependent: string, dependsOn: string) {
    return currentVerifiedRecord(richNode(dependent), richNode(dependsOn));
  }

  it('tags every node finding exploratory, even when a current verified record names its node', async () => {
    mocks.listVerifiedDependencies.mockResolvedValue([]);
    const exploratoryOnly = await executeGraphQuery('org-1', q('isolated_knowledge'));
    expect(exploratoryOnly.findings.length).toBeGreaterThan(0);
    expect(exploratoryOnly.findings.every((f) => f.evidenceBasis === 'exploratory')).toBe(true);
    expect(exploratoryOnly.confirmedFindings).toEqual([]);

    // gov_sole participates in a current verified dependency (in both directions). A node finding about gov_sole
    // asserts no directed dependency, so the record confirms nothing about it.
    mocks.listVerifiedDependencies.mockResolvedValue([verified('compliance_x', 'gov_sole'), verified('gov_sole', 'vendor_a')]);
    const withVerified = await executeGraphQuery('org-1', q('isolated_knowledge'));
    const govFinding = withVerified.findings.find((f) => f.entityId === 'gov_sole');
    expect(govFinding).toBeDefined();
    expect(govFinding?.evidenceBasis).toBe('exploratory');
    expect(govFinding).not.toHaveProperty('verifiedBy');
    expect(withVerified.findings.every((f) => f.evidenceBasis === 'exploratory')).toBe(true);
    expect(withVerified.confirmedFindings).toEqual([]);
  });

  it('confirms a propagation_paths finding only when every edge of its chain is verified in the impact direction', async () => {
    // Paths: gov_sole -> compliance_x (2 nodes), and gov_sole -> compliance_x -> system_b -> common_c (4 nodes).
    // Only the first edge is verified: compliance_x depends on gov_sole.
    mocks.listVerifiedDependencies.mockResolvedValue([verified('compliance_x', 'gov_sole')]);
    const result = await executeGraphQuery('org-1', q('propagation_paths'));
    const short = result.findings.find((f) => f.entityId === 'path_gov_sole_compliance_x')!;
    const long = result.findings.find((f) => f.entityId === 'path_gov_sole_compliance_x_system_b_common_c')!;
    expect(short.evidenceBasis).toBe('verified');
    expect(short.verifiedBy?.map((e) => e.record.id)).toEqual(['vd-compliance_x-gov_sole']);
    expect(short.verifiedBy?.[0].evidenceTier).toBe('human_attested_external');
    // Partially verified chain stays a hypothesis.
    expect(long.evidenceBasis).toBe('exploratory');
    expect(long).not.toHaveProperty('verifiedBy');
    expect(result.confirmedFindings.map((f) => f.entityId)).toEqual(['path_gov_sole_compliance_x']);

    // Verify the rest of the long chain: now it is confirmed too, with every edge's record in chain order.
    mocks.listVerifiedDependencies.mockResolvedValue([
      verified('compliance_x', 'gov_sole'),
      verified('system_b', 'compliance_x'),
      verified('common_c', 'system_b'),
    ]);
    const full = await executeGraphQuery('org-1', q('propagation_paths'));
    const fullLong = full.findings.find((f) => f.entityId === 'path_gov_sole_compliance_x_system_b_common_c')!;
    expect(fullLong.evidenceBasis).toBe('verified');
    expect(fullLong.verifiedBy?.map((e) => e.record.id)).toEqual(['vd-compliance_x-gov_sole', 'vd-system_b-compliance_x', 'vd-common_c-system_b']);
  });

  it('keeps a propagation_paths finding exploratory when its edge is verified only in the reverse direction', async () => {
    // gov_sole depends on compliance_x is verified - the reverse of the chain's claim (compliance_x depends on gov_sole).
    mocks.listVerifiedDependencies.mockResolvedValue([verified('gov_sole', 'compliance_x')]);
    const result = await executeGraphQuery('org-1', q('propagation_paths'));
    const short = result.findings.find((f) => f.entityId === 'path_gov_sole_compliance_x')!;
    expect(short.evidenceBasis).toBe('exploratory');
    expect(short).not.toHaveProperty('verifiedBy');
    expect(result.confirmedFindings).toEqual([]);
  });

  it('keeps a propagation_paths finding exploratory when its verified record is no longer current', async () => {
    // Verified while compliance_x was classified 'operational'; it is 'compliance' now, so the fingerprint is stale.
    mocks.listVerifiedDependencies.mockResolvedValue([
      currentVerifiedRecord({ ...richNode('compliance_x'), category: 'operational' }, richNode('gov_sole')),
    ]);
    const result = await executeGraphQuery('org-1', q('propagation_paths'));
    expect(result.findings.find((f) => f.entityId === 'path_gov_sole_compliance_x')?.evidenceBasis).toBe('exploratory');
    expect(result.confirmedFindings).toEqual([]);
  });
});
