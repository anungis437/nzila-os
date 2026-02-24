/**
 * Marketing & Growth Engine Types
 * 
 * Type definitions for the Union Eyes growth infrastructure:
 * - Impact metrics
 * - Case studies
 * - Pilot program
 * - Organizer recognition
 * - Movement insights
 * - Trust metrics
 */

// ============================================================================
// IMPACT METRICS
// ============================================================================

export type MetricType =
  | 'time-to-resolution'
  | 'escalation-rate'
  | 'member-satisfaction'
  | 'organizer-workload'
  | 'democratic-participation'
  | 'governance-engagement';

export type MetricVisibility = 'public' | 'pilot-only' | 'internal';

export interface ImpactMetric {
  id: string;
  organizationId: string;
  metricType: MetricType;
  value: number;
  comparisonValue?: number; // Before Union Eyes
  unit: string;
  period: string; // ISO date range
  visibility: MetricVisibility;
  anonymized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImpactMetricInput {
  organizationId: string;
  metricType: MetricType;
  value: number;
  comparisonValue?: number;
  unit: string;
  period: string;
  visibility: MetricVisibility;
  anonymized: boolean;
}

// ============================================================================
// CASE STUDIES
// ============================================================================

export type OrganizationType = 'clc' | 'local' | 'federation' | 'regional' | 'national' | 'platform' | 'congress' | 'union' | 'region' | 'district';
export type CaseStudyCategory = 'pilot' | 'success-story' | 'before-after' | 'transformation';

export interface CaseStudyMetric {
  label: string;
  before: number;
  after: number;
  unit: string;
  improvement?: string; // e.g., "-60%", "+120%"
  type?: string;
}

export interface CaseStudyTestimonial {
  quote: string;
  author: string;
  role: string;
  organization?: string;
  photo?: string;
}

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  organizationId?: string | null; // Optional for anonymized
  organizationType: OrganizationType;
  category: CaseStudyCategory;
  summary: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics: CaseStudyMetric[];
  testimonial?: CaseStudyTestimonial;
  visibility: 'public' | 'authenticated';
  featured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Extended fields for case study pages
  status?: string;
  jurisdiction?: string;
  sector?: string;
  memberCount?: number;
  anonymized?: boolean;
  quote?: string;
  results?: string[];
  lessonsLearned?: string[];
  replicability?: string[];
}

export interface CaseStudyInput {
  title: string;
  slug: string;
  organizationId?: string;
  organizationType: OrganizationType;
  category: CaseStudyCategory;
  summary: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics: CaseStudyMetric[];
  testimonial?: CaseStudyTestimonial;
  visibility: 'public' | 'authenticated';
  featured?: boolean;
}

// ============================================================================
// PILOT PROGRAM
// ============================================================================

export type PilotStatus = 'submitted' | 'review' | 'approved' | 'active' | 'completed' | 'declined';

export interface PilotApplication {
  id: string;
  organizationName: string;
  organizationType: 'local' | 'regional' | 'national';
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  memberCount: number;
  jurisdictions: string[];
  sectors: string[];
  currentSystem?: string;
  challenges: string[];
  goals: string[];
  readinessScore?: number;
  status: PilotStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: Record<string, any>;
  notes?: string;
}

export interface PilotApplicationInput {
  organizationName: string;
  organizationType: 'local' | 'regional' | 'national';
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  memberCount: number;
  jurisdictions: string[];
  sectors: string[];
  currentSystem?: string;
  challenges: string[];
  goals: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: Record<string, any>;
}

export interface PilotMilestone {
  name: string;
  description: string;
  targetDate?: Date;
  completedAt?: Date;
  status: 'pending' | 'in-progress' | 'complete' | 'blocked';
}

export interface PilotMetrics {
  id: string;
  pilotId: string;
  organizationId: string;
  enrollmentDate: Date;
  daysActive: number;
  organizerAdoptionRate: number; // percentage 0-100
  memberEngagementRate: number; // percentage 0-100
  casesManaged: number;
  avgTimeToResolution: number; // hours
  healthScore: number; // 0-100
  milestones: PilotMilestone[];
  lastCalculated: Date;
}

export interface PilotHealthScoreBreakdown {
  overall: number;
  adoption: number;
  engagement: number;
  usage: number;
  effectiveness: number;
  progress: number;
}

// ============================================================================
// ORGANIZER RECOGNITION
// ============================================================================

export type RecognitionEventType = 'case-win' | 'member-feedback' | 'peer-recognition' | 'milestone';

export interface RecognitionEvent {
  type: RecognitionEventType;
  description: string;
  date: Date;
  relatedCaseId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface OrganizerImpact {
  id: string;
  userId: string;
  organizationId: string;
  casesHandled: number;
  casesWon: number;
  avgResolutionTime: number; // days
  memberSatisfactionAvg: number; // 1-5
  escalationsAvoided: number;
  democraticParticipationRate: number; // percentage
  recognitionEvents: RecognitionEvent[];
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizerImpactSummary {
  userId: string;
  userName: string;
  role: string;
  organization: string;
  currentPeriod: OrganizerImpact;
  trend: 'improving' | 'stable' | 'declining';
  highlights: string[];
}

// ============================================================================
// MOVEMENT INSIGHTS
// ============================================================================

export type MovementTrendCategory = 
  | 'grievance-type' 
  | 'resolution-pattern' 
  | 'systemic-issue'
  | 'sector-trend'
  | 'jurisdiction-pattern';

export interface MovementTrend {
  id: string;
  trendType: string; // e.g., 'avg-resolution-time', 'win-rate', 'member-satisfaction'
  category?: MovementTrendCategory;
  dimension?: string; // e.g., 'harassment', 'scheduling', 'safety'
  aggregatedValue: number;
  aggregatedCount?: number;
  participatingOrgs: number; // Number of organizations contributing
  totalCases: number; // Total cases in the aggregation
  organizationsContributing?: number; // Alias for participatingOrgs
  jurisdiction?: string;
  sector?: string;
  timeframe: string; // 'last_30_days', 'last_90_days', 'last_year', 'month', 'quarter', 'year'
  insights?: string;
  legislativeBriefRelevance?: boolean;
  emergingPattern?: boolean;
  confidenceLevel?: 'low' | 'medium' | 'high';
  calculatedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface MovementInsightInput {
  category: MovementTrendCategory;
  timeframe: string;
  minimumOrganizations?: number;
}

export interface DataAggregationConsent {
  organizationId: string;
  consentGiven: boolean;
  consentDate: Date;
  categories: MovementTrendCategory[];
  expiresAt?: Date;
}

// ============================================================================
// TRUST METRICS
// ============================================================================

export type SystemStatus = 'active' | 'degraded' | 'error' | 'unknown';

export interface TrustMetricDetail {
  status: SystemStatus;
  verification: boolean;
  lastCheck: Date;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface ImmutabilityMetric extends TrustMetricDetail {
  triggersActive: boolean;
  tablesProtected: string[];
  violationAttempts: number;
  lastAudit: Date;
}

export interface RLSMetric extends TrustMetricDetail {
  policiesActive: number;
  tenantIsolation: string; // "100%"
  lastPolicyCheck: Date;
  tablesProtected: string[];
}

export interface FSMMetric extends TrustMetricDetail {
  invalidTransitionsBlocked: number;
  complianceRate: number; // percentage
  lastValidation: Date;
}

export interface GovernanceMetric extends TrustMetricDetail {
  goldenShareActive: boolean;
  goldenShareHolder: string;
  lastElectionDate?: Date;
  reservedMattersProtection: 'active' | 'inactive';
  upcomingElection?: Date;
}

export interface AuditLogMetric extends TrustMetricDetail {
  eventsLogged: number;
  retentionPolicy: string; // "7 years"
  lastArchive: Date;
  archivedEvents: number;
}

export interface TrustMetrics {
  immutability: ImmutabilityMetric;
  rlsEnforcement: RLSMetric;
  fsmValidation: FSMMetric;
  governance: GovernanceMetric;
  auditLog: AuditLogMetric;
  lastUpdated: Date;
}

// ============================================================================
// MEMBER EXPERIENCE
// ============================================================================

export interface HumanExplanation {
  title: string;
  explanation: string;
  nextSteps: string[];
  expectedTimeline: string;
  empathyMessage: string;
  daysInThisStage?: number;
  priorityContext?: string;
  resourcesAvailable?: {
    title: string;
    description: string;
    url?: string;
  }[];
}

export interface TimelineStage {
  status: string;
  title: string;
  description: string;
  enteredAt?: Date;
  completedAt?: Date;
  daysInStage?: number;
  isCurrent: boolean;
  isComplete: boolean;
}

export interface GrievanceTimeline {
  claimId: string;
  stages: TimelineStage[];
  currentStage: TimelineStage;
  progressPercentage: number;
  estimatedCompletionDate?: Date;
}

// ============================================================================
// TESTIMONIALS
// ============================================================================

export type TestimonialType = 'organizer' | 'member' | 'executive' | 'partner';

export interface Testimonial {
  id: string;
  type: TestimonialType;
  quote: string;
  author: string;
  role: string;
  organization?: string;
  organizationType?: OrganizationType;
  photo?: string;
  featured: boolean;
  visibility: 'public' | 'authenticated';
  createdAt: Date;
  approvedAt?: Date;
}

export interface TestimonialInput {
  type: TestimonialType;
  quote: string;
  author: string;
  role: string;
  organization?: string;
  organizationType?: OrganizationType;
  photo?: string;
  featured?: boolean;
  visibility: 'public' | 'authenticated';
}

// ============================================================================
// EXPORT ALL
// ============================================================================

// Types are already exported inline above
