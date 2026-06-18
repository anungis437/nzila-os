/**
 * Resilience Strategy Modeler
 *
 * Models organizational continuity strengthening pathways.
 * Generates a prioritized resilience roadmap based on current state.
 *
 * This is organizational capacity planning — not workforce management.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import { calculateResilienceIndex } from '../resilience-index/resilience-calculator';
import {
  type StrategyType,
  type ResilienceStrategyModel,
  type ResilienceRoadmap,
  type MaturityStage,
} from './strategy-models';

const STRATEGY_CATALOG: Record<StrategyType, Omit<ResilienceStrategyModel,
  'currentMaturity' | 'projectedResilienceGain' | 'governanceStabilityGain' | 'dependencyReductionImpact'
>> = {
  documentation_foundation: {
    strategyType: 'documentation_foundation',
    name: 'Documentation Foundation',
    description: 'Systematically document all operational processes, governance procedures, and organizational knowledge. Create a living documentation repository that survives role transitions.',
    targetMaturity: 'managed',
    estimatedDurationWeeks: 16,
    maturityProgression: 'From undocumented tribal knowledge → structured organizational documentation',
    milestones: [
      { week: 2, description: 'Complete knowledge inventory audit', successCriteria: 'All operational domains listed with documentation status', dimensionImpacted: 'Documentation Maturity' },
      { week: 6, description: 'Document top 10 critical processes', successCriteria: 'Written procedures for highest-risk single-source processes', dimensionImpacted: 'Documentation Maturity' },
      { week: 12, description: 'Documentation repository live', successCriteria: 'Searchable organizational knowledge base accessible to relevant roles', dimensionImpacted: 'Documentation Maturity' },
      { week: 16, description: 'Documentation review cycle established', successCriteria: 'Quarterly review process formalized for critical documentation', dimensionImpacted: 'Continuity Preparedness' },
    ],
    enablers: ['Leadership commitment to documentation time', 'Accessible documentation platform', 'Clear documentation standards'],
    potentialBlockers: ['Knowledge holder time constraints', 'Documentation quality inconsistency', 'Maintenance discipline'],
    kpis: ['% of critical processes documented', '# of single-source nodes with documentation', 'Documentation completeness score'],
  },
  knowledge_decentralization: {
    strategyType: 'knowledge_decentralization',
    name: 'Knowledge Decentralization',
    description: 'Systematically distribute concentrated knowledge across multiple organizational members. Eliminate single-source dependencies through intentional knowledge sharing.',
    targetMaturity: 'managed',
    estimatedDurationWeeks: 20,
    maturityProgression: 'From single-source concentration → multi-person knowledge coverage across all critical areas',
    milestones: [
      { week: 3, description: 'Map all single-source knowledge nodes', successCriteria: 'Complete inventory of single-source dependencies', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 8, description: 'Begin cross-training for critical nodes', successCriteria: 'At least 2 people cover each critical single-source area', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 14, description: 'Knowledge sharing sessions completed', successCriteria: 'All high-priority single-source areas have backup coverage', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 20, description: 'Sustained decentralization practices', successCriteria: 'Knowledge sharing is part of onboarding and operational practice', dimensionImpacted: 'Knowledge Redundancy' },
    ],
    enablers: ['Time allocation for knowledge sharing', 'Structured learning programs', 'Recognition of knowledge sharing contributions'],
    potentialBlockers: ['Knowledge silos and resistance', 'Insufficient time for sharing', 'Lack of structured program'],
    kpis: ['# single-source nodes reduced', 'Average knowledge coverage per domain', 'Cross-training completion rate'],
  },
  governance_distribution: {
    strategyType: 'governance_distribution',
    name: 'Governance Distribution',
    description: 'Decentralize governance knowledge and authority across multiple members. Ensure governance continuity independent of any single knowledge holder.',
    targetMaturity: 'managed',
    estimatedDurationWeeks: 24,
    maturityProgression: 'From governance concentration → distributed governance resilience',
    milestones: [
      { week: 4, description: 'Audit governance concentration', successCriteria: 'All governance processes mapped with knowledge holder coverage', dimensionImpacted: 'Governance Distribution' },
      { week: 10, description: 'Formalize key governance procedures', successCriteria: 'Written procedures for all governance functions', dimensionImpacted: 'Governance Distribution' },
      { week: 18, description: 'Train secondary governance leads', successCriteria: 'Backup governance leads trained for all critical functions', dimensionImpacted: 'Governance Distribution' },
      { week: 24, description: 'Governance succession protocols', successCriteria: 'Formal governance continuity plan approved and documented', dimensionImpacted: 'Governance Distribution' },
    ],
    enablers: ['Governance leadership commitment', 'Formal procedure documentation', 'Succession planning culture'],
    potentialBlockers: ['Governance authority concentration resistance', 'Complexity of governance procedures', 'Regulatory constraints on delegation'],
    kpis: ['% governance processes with backup coverage', 'Governance concentration index', 'Governance succession plan completeness'],
  },
  operational_redundancy: {
    strategyType: 'operational_redundancy',
    name: 'Operational Redundancy',
    description: 'Build redundant operational capabilities across all critical processes. Ensure organizational function can continue through role transitions and disruptions.',
    targetMaturity: 'managed',
    estimatedDurationWeeks: 18,
    maturityProgression: 'From fragile single-path operations → resilient multi-path operational capability',
    milestones: [
      { week: 3, description: 'Map operational single-points of failure', successCriteria: 'All single-path critical processes identified', dimensionImpacted: 'Continuity Preparedness' },
      { week: 8, description: 'Implement role rotation for critical functions', successCriteria: 'Critical operational functions covered by multiple trained roles', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 14, description: 'Backup procedures documented and tested', successCriteria: 'Verified backup procedures for all critical operational paths', dimensionImpacted: 'Documentation Maturity' },
      { week: 18, description: 'Redundancy validation complete', successCriteria: 'Simulated disruption testing confirms operational continuity', dimensionImpacted: 'Continuity Preparedness' },
    ],
    enablers: ['Cross-functional team capacity', 'Clear operational documentation', 'Leadership support for redundancy investment'],
    potentialBlockers: ['Resource constraints for redundancy', 'Operational complexity', 'Resistance to process change'],
    kpis: ['# critical processes with redundancy', 'Mean recovery time for disruptions', 'Operational backup test pass rate'],
  },
  vendor_diversification: {
    strategyType: 'vendor_diversification',
    name: 'Vendor Diversification',
    description: 'Reduce dependency on single-vendor relationships by qualifying alternative suppliers. Ensure operational continuity independent of any single vendor.',
    targetMaturity: 'managing' as MaturityStage,
    estimatedDurationWeeks: 28,
    maturityProgression: 'From single-vendor dependency → diversified vendor resilience',
    milestones: [
      { week: 4, description: 'Vendor dependency audit', successCriteria: 'All single-vendor dependencies identified and risk-rated', dimensionImpacted: 'Operational Diversification' },
      { week: 12, description: 'Alternative vendor qualification', successCriteria: 'Qualified alternatives for top 3 critical vendor dependencies', dimensionImpacted: 'Operational Diversification' },
      { week: 20, description: 'Vendor transition plans', successCriteria: 'Documented transition plans for all high-risk vendor dependencies', dimensionImpacted: 'Operational Diversification' },
      { week: 28, description: 'Multi-vendor agreements', successCriteria: 'Active multi-vendor relationships for critical operational functions', dimensionImpacted: 'Operational Diversification' },
    ],
    enablers: ['Procurement governance support', 'Budget for vendor qualification', 'Relationship management capacity'],
    potentialBlockers: ['Long-term vendor contracts', 'Cost of multi-vendor management', 'Vendor qualification complexity'],
    kpis: ['# single-vendor dependencies eliminated', 'Vendor concentration index', 'Alternative vendor readiness score'],
  },
  continuity_mentorship_program: {
    strategyType: 'continuity_mentorship_program',
    name: 'Continuity Mentorship Program',
    description: 'Establish structured mentorship connecting organizational knowledge holders with emerging successors. Create explicit knowledge transfer pathways.',
    targetMaturity: 'optimized',
    estimatedDurationWeeks: 20,
    maturityProgression: 'From informal knowledge transfer → structured organizational mentorship',
    milestones: [
      { week: 2, description: 'Identify knowledge holders and successors', successCriteria: 'Mentorship pairs identified for all critical knowledge areas', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 6, description: 'Mentorship program launched', successCriteria: 'Structured sessions scheduled for all mentor pairs', dimensionImpacted: 'Knowledge Redundancy' },
      { week: 12, description: 'Knowledge transfer milestones', successCriteria: '50% of transfer milestones completed per pair', dimensionImpacted: 'Continuity Preparedness' },
      { week: 20, description: 'Transfer validation', successCriteria: 'Successors demonstrate operational competency in transferred domains', dimensionImpacted: 'Continuity Preparedness' },
    ],
    enablers: ['Structured program design', 'Leadership endorsement', 'Time allocation for both mentor and mentee'],
    potentialBlockers: ['Knowledge holder availability', 'Program structure gaps', 'Lack of follow-through accountability'],
    kpis: ['Mentorship pairs active', '% transfer milestones completed', 'Successor readiness scores'],
  },
  institutional_transfer_initiative: {
    strategyType: 'institutional_transfer_initiative',
    name: 'Organizational Transfer Initiative',
    description: 'Comprehensive program to preserve and transfer organizational knowledge before critical transitions. Creates lasting organizational memory.',
    targetMaturity: 'optimized',
    estimatedDurationWeeks: 24,
    maturityProgression: 'From unplanned knowledge loss → systematic organizational memory preservation',
    milestones: [
      { week: 2, description: 'Organizational knowledge inventory', successCriteria: 'Complete map of organizational knowledge with transfer priority', dimensionImpacted: 'Documentation Maturity' },
      { week: 8, description: 'Priority transfer sessions', successCriteria: 'Critical organizational knowledge documented and transferred', dimensionImpacted: 'Documentation Maturity' },
      { week: 16, description: 'Knowledge repository complete', successCriteria: 'Searchable organizational memory repository live', dimensionImpacted: 'Continuity Preparedness' },
      { week: 24, description: 'Ongoing transfer culture', successCriteria: 'Knowledge transfer embedded in organizational processes', dimensionImpacted: 'Continuity Preparedness' },
    ],
    enablers: ['Dedicated program resources', 'Leadership sponsorship', 'Technology platform for knowledge preservation'],
    potentialBlockers: ['Scope complexity', 'Sustained commitment over time', 'Knowledge capture quality'],
    kpis: ['Organizational knowledge capture rate', 'Transfer completion rate', 'Knowledge retrieval usage'],
  },
};

function inferCurrentMaturity(
  resilienceScore: number,
  _strategyType: StrategyType,
): MaturityStage {
  if (resilienceScore >= 75) return 'managed';
  if (resilienceScore >= 60) return 'developing';
  if (resilienceScore >= 40) return 'initial';
  return 'initial';
}

function computeStrategyGain(
  strategyType: StrategyType,
  singleSourceCount: number,
  govConcentration: number,
  vendorConcentration: number,
): { resilience: number; governance: number; dependency: number } {
  const base: Record<StrategyType, [number, number, number]> = {
    documentation_foundation:         [18, 10, 15],
    knowledge_decentralization:        [22, 12, 25],
    governance_distribution:           [12, 30, 10],
    operational_redundancy:            [20, 8, 20],
    vendor_diversification:            [10, 5, 30],
    continuity_mentorship_program:     [15, 15, 18],
    institutional_transfer_initiative: [25, 18, 20],
  };
  const [r, g, d] = base[strategyType];
  const singleSourceBonus = Math.min(10, singleSourceCount);
  const govBonus = Math.min(8, govConcentration / 10);
  const vendorBonus = Math.min(8, vendorConcentration / 10);
  return {
    resilience: Math.min(35, r + (strategyType.includes('knowledge') ? singleSourceBonus : 0)),
    governance: Math.min(40, g + (strategyType.includes('governance') ? govBonus : 0)),
    dependency: Math.min(40, d + (strategyType.includes('vendor') ? vendorBonus : 0)),
  };
}

/**
 * Build an organizational resilience roadmap.
 * Returns prioritized strategies and phased implementation plan.
 */
export async function buildResilienceRoadmap(orgId: string): Promise<ResilienceRoadmap> {
  const [propagationMap, resilienceIndex] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    calculateResilienceIndex(orgId),
  ]);

  const nodes = propagationMap.nodes;
  const singleSourceCount = nodes.filter((n) => n.isSingleSource).length;
  const govSingleSource = nodes.filter((n) => (n.category === 'governance' || n.category === 'compliance') && n.isSingleSource).length;
  const vendorSingleSource = nodes.filter((n) => (n.category === 'vendor' || n.nodeType === 'vendor') && n.isSingleSource).length;
  const totalGov = nodes.filter((n) => n.category === 'governance' || n.category === 'compliance').length;
  const totalVendor = nodes.filter((n) => n.category === 'vendor' || n.nodeType === 'vendor').length;
  const govConcentration = totalGov > 0 ? Math.round((govSingleSource / totalGov) * 100) : 0;
  const vendorConcentration = totalVendor > 0 ? Math.round((vendorSingleSource / totalVendor) * 100) : 0;

  const currentScore = resilienceIndex.overallScore;

  // Select which strategies are relevant based on current state
  const strategyPriority: StrategyType[] = [];

  // Always recommend documentation as foundational
  if (resilienceIndex.dimensions.find((d) => d.name === 'Documentation Maturity')?.score ?? 0 < 65) {
    strategyPriority.push('documentation_foundation');
  }
  if (singleSourceCount >= 3) strategyPriority.push('knowledge_decentralization');
  if (govConcentration >= 30) strategyPriority.push('governance_distribution');
  if (singleSourceCount >= 4) strategyPriority.push('operational_redundancy');
  if (vendorConcentration >= 30) strategyPriority.push('vendor_diversification');
  if (singleSourceCount >= 5) strategyPriority.push('continuity_mentorship_program');
  if (nodes.length >= 10) strategyPriority.push('institutional_transfer_initiative');

  // Deduplicate, keep first 5
  const selectedTypes = [...new Set(strategyPriority)].slice(0, 5);

  const strategies: ResilienceStrategyModel[] = selectedTypes.map((type) => {
    const template = STRATEGY_CATALOG[type];
    const gains = computeStrategyGain(type, singleSourceCount, govConcentration, vendorConcentration);
    const currentMaturity = inferCurrentMaturity(currentScore, type);
    return {
      ...template,
      currentMaturity,
      projectedResilienceGain: gains.resilience,
      governanceStabilityGain: gains.governance,
      dependencyReductionImpact: gains.dependency,
    };
  });

  const totalGain = strategies.reduce((s, st) => s + st.projectedResilienceGain, 0);
  const projectedScore = Math.min(100, currentScore + Math.round(totalGain * 0.7));

  // Phase buckets
  const phase1QuickWins: string[] = [];
  const phase2Foundation: string[] = [];
  const phase3Sustained: string[] = [];

  for (const s of strategies) {
    if (s.estimatedDurationWeeks <= 8) {
      phase1QuickWins.push(s.name);
    } else if (s.estimatedDurationWeeks <= 24) {
      phase2Foundation.push(s.name);
    } else {
      phase3Sustained.push(s.name);
    }
  }

  // Always include documentation in phase 1 if selected
  if (strategies.find((s) => s.strategyType === 'documentation_foundation') && !phase1QuickWins.includes('Documentation Foundation')) {
    phase1QuickWins.unshift('Documentation Foundation (Phase 1 milestones)');
  }

  const maturityNarrative =
    currentScore < 40 ? `The organization is in an early continuity maturity stage (${currentScore}/100). The roadmap focuses on foundational documentation and knowledge distribution to establish baseline resilience.`
    : currentScore < 60 ? `The organization is developing continuity maturity (${currentScore}/100). The roadmap targets systematic knowledge decentralization and governance distribution.`
    : currentScore < 75 ? `The organization has adequate continuity foundations (${currentScore}/100). The roadmap focuses on optimization: structured mentorship, vendor resilience, and sustained transfer programs.`
    : `The organization demonstrates strong continuity maturity (${currentScore}/100). The roadmap sustains resilience and targets specific remaining concentration risks.`;

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    currentScore,
    projectedScore,
    strategies,
    phase1QuickWins,
    phase2Foundation,
    phase3Sustained,
    maturityNarrative,
  };
}
