/**
 * Organizational Resilience Index
 *
 * Measure organizational continuity resilience across multiple dimensions.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';

export interface ResilienceIndexDimension {
  name: string;
  score: number; // 0-100
  status: 'critical' | 'at_risk' | 'adequate' | 'strong';
  components: Array<{ name: string; value: number }>;
  recommendations: string[];
}

export interface OrganizationalResilienceIndex {
  organizationId: string;
  generatedAt: string;
  /** Overall resilience score (0-100) */
  overallScore: number;
  /** Overall status */
  status: 'critical' | 'at_risk' | 'adequate' | 'strong';
  /** Performance across dimensions */
  dimensions: ResilienceIndexDimension[];
  /** Trend (improving/stable/degrading) */
  trend: 'improving' | 'stable' | 'degrading';
  /** Maturity level */
  maturityLevel: 'initial' | 'developing' | 'managed' | 'optimized';
  /** Actionable recommendations */
  recommendations: string[];
}

export async function calculateResilienceIndex(orgId: string): Promise<OrganizationalResilienceIndex> {
  const propagationMap = await buildDependencyPropagationMap(orgId);
  const interviews = await db
    .select()
    .from(exitInterviews)
    .where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published')));

  // Calculate dimensions
  const redundancyScore = calculateRedundancyScore(propagationMap);
  const documentationScore = calculateDocumentationScore(interviews, propagationMap);
  const governanceScore = calculateGovernanceScore(propagationMap);
  const preparednessScore = calculatePreparednessScore(propagationMap, interviews.length);
  const diversificationScore = calculateDiversificationScore(propagationMap);

  const dimensions: ResilienceIndexDimension[] = [
    {
      name: 'Knowledge Redundancy',
      score: redundancyScore,
      status: statusFromScore(redundancyScore),
      components: [
        { name: 'Single-source knowledge areas', value: propagationMap.nodes.filter((n: any) => n.isSingleSource).length },
        { name: 'Average coverage', value: propagationMap.nodes.reduce((sum: any, n: any) => sum + n.frequency, 0) / Math.max(propagationMap.nodes.length, 1) },
      ],
      recommendations: redundancyScore < 60 ? ['Cross-train on critical areas', 'Document isolated knowledge'] : [],
    },
    {
      name: 'Documentation Maturity',
      score: documentationScore,
      status: statusFromScore(documentationScore),
      components: [
        { name: 'Published interviews', value: interviews.length },
        { name: 'Estimated doc quality', value: interviews.length >= 8 ? 75 : interviews.length >= 4 ? 50 : 25 },
      ],
      recommendations: documentationScore < 60 ? ['Capture more interviews', 'Create runbooks and procedures'] : [],
    },
    {
      name: 'Governance Distribution',
      score: governanceScore,
      status: statusFromScore(governanceScore),
      components: [
        { name: 'Governance/compliance nodes', value: propagationMap.nodes.filter((n: any) => n.category === 'governance' || n.category === 'compliance').length },
        { name: 'Single-source governance', value: propagationMap.nodes.filter((n: any) => (n.category === 'governance' || n.category === 'compliance') && n.isSingleSource).length },
      ],
      recommendations: governanceScore < 60 ? ['Formalize governance procedures', 'Cross-train on compliance'] : [],
    },
    {
      name: 'Continuity Preparedness',
      score: preparednessScore,
      status: statusFromScore(preparednessScore),
      components: [
        { name: 'Knowledge capture interviews', value: interviews.length },
        { name: 'Continuity bottlenecks identified', value: propagationMap.bottlenecks.length },
      ],
      recommendations: preparednessScore < 60 ? ['Conduct continuity risk assessment', 'Create business continuity plan'] : [],
    },
    {
      name: 'Operational Diversification',
      score: diversificationScore,
      status: statusFromScore(diversificationScore),
      components: [
        { name: 'Vendor concentration risks', value: propagationMap.nodes.filter((n: any) => n.category === 'vendor' && n.isSingleSource).length },
        { name: 'System diversification', value: propagationMap.nodes.filter((n: any) => n.category === 'system').length },
      ],
      recommendations: diversificationScore < 60 ? ['Diversify vendor relationships', 'Consider system redundancy'] : [],
    },
  ];

  // Overall score
  const scores = dimensions.map((d) => d.score);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallStatus = statusFromScore(overallScore);

  // Maturity level
  const maturityLevel =
    overallScore >= 80 ? 'optimized' :
    overallScore >= 60 ? 'managed' :
    overallScore >= 40 ? 'developing' :
    'initial';

  // Trend (heuristic)
  const trend = propagationMap.nodes.filter((n: any) => n.isSingleSource).length > propagationMap.nodes.length * 0.4 ? 'degrading' : 'stable' as const;

  // Overall recommendations
  const recommendations = dimensions
    .filter((d) => d.score < 70)
    .flatMap((d) => d.recommendations)
    .slice(0, 5);

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    overallScore,
    status: overallStatus,
    dimensions,
    trend,
    maturityLevel,
    recommendations,
  };
}

function calculateRedundancyScore(propagationMap: any): number {
  const totalNodes = propagationMap.nodes.length;
  const singleSourceCount = propagationMap.nodes.filter((n: any) => n.isSingleSource).length;
  const avgFrequency = propagationMap.nodes.reduce((sum: any, n: any) => sum + n.frequency, 0) / totalNodes;

  // Score based on redundancy
  const singleSourcePenalty = (singleSourceCount / totalNodes) * 40;
  const redundancyBonus = Math.min(avgFrequency * 10, 40);

  return Math.max(50 + redundancyBonus - singleSourcePenalty, 0);
}

function calculateDocumentationScore(interviews: any[], propagationMap: any): number {
  let score = Math.min(interviews.length * 10, 60); // Base on interview count

  // Bonus for comprehensive coverage
  const avgFrequency = propagationMap.nodes.reduce((sum: any, n: any) => sum + n.frequency, 0) / propagationMap.nodes.length;
  score += Math.min(avgFrequency * 5, 20);

  // Penalty for undocumented areas
  const undocumentedPenalty = propagationMap.nodes.filter((n: any) => n.isSingleSource).length / propagationMap.nodes.length * 20;
  score -= undocumentedPenalty;

  return Math.max(Math.min(score, 100), 0);
}

function calculateGovernanceScore(propagationMap: any): number {
  const governanceNodes = propagationMap.nodes.filter((n: any) => n.category === 'governance' || n.category === 'compliance');
  const totalNodes = propagationMap.nodes.length;

  // Score based on governance coverage and redundancy
  let score = 50;
  score += Math.min((governanceNodes.length / totalNodes) * 30, 30); // More governance = better

  const singleSourceGov = governanceNodes.filter((n: any) => n.isSingleSource).length;
  score -= (singleSourceGov / Math.max(governanceNodes.length, 1)) * 20;

  return Math.max(Math.min(score, 100), 0);
}

function calculatePreparednessScore(propagationMap: any, interviewCount: number): number {
  let score = Math.min(interviewCount * 8, 60);

  // Bonus for identified bottlenecks (means org is aware)
  if (propagationMap.bottlenecks.length > 0) score += 15;

  // Penalty for unaddressed critical issues
  const criticalBottlenecks = propagationMap.bottlenecks.filter((b: any) => b.riskLevel === 'critical').length;
  score -= criticalBottlenecks * 10;

  return Math.max(Math.min(score, 100), 0);
}

function calculateDiversificationScore(propagationMap: any): number {
  const vendors = propagationMap.nodes.filter((n: any) => n.category === 'vendor');
  const systems = propagationMap.nodes.filter((n: any) => n.category === 'system');

  let score = 50;

  // Diversification benefit from multiple systems/vendors
  score += Math.min(systems.length * 5, 25);
  score += Math.min(vendors.length * 5, 25);

  // Penalty for single-source critical items
  const singleSourceCritical = vendors.filter((v: any) => v.isSingleSource).length;
  score -= singleSourceCritical * 15;

  return Math.max(Math.min(score, 100), 0);
}

function statusFromScore(score: number): 'critical' | 'at_risk' | 'adequate' | 'strong' {
  if (score < 40) return 'critical';
  if (score < 60) return 'at_risk';
  if (score < 75) return 'adequate';
  return 'strong';
}
