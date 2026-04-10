/**
 * Canonical domain objects for the Nzila OS Deal Engine.
 *
 * These are the top-level operating abstractions. They do not replace
 * underlying app-specific models but serve as the unified view layer
 * used by the control-plane Deal Engine surface.
 */
import { z } from 'zod';
import { dealStageSchema } from './lifecycle';

// ── Deal ────────────────────────────────────────────────

export const dealSourceSchema = z.enum([
  'partner',
  'hubspot',
  'internal',
  'website',
  'referral',
  'event',
]);
export type DealSource = z.infer<typeof dealSourceSchema>;

export const dealProductSchema = z.enum([
  'union-eyes',
  'flow',
  'cfo',
  'zonga',
  'mobility',
  'agrimo',
  'platform',
  'bundle',
]);
export type DealProduct = z.infer<typeof dealProductSchema>;

export const dealSchema = z.object({
  id: z.string(),
  accountId: z.string().nullable(),
  accountName: z.string(),
  source: dealSourceSchema,
  stage: dealStageSchema,
  owner: z.string(),
  partnerId: z.string().nullable(),
  partnerName: z.string().nullable(),
  product: dealProductSchema,
  estimatedValue: z.number(),
  currency: z.string().default('CAD'),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  nextAction: z.string().nullable(),
  daysInStage: z.number().int().min(0),
  conversionRisk: z.enum(['low', 'medium', 'high']).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Deal = z.infer<typeof dealSchema>;

// ── Pilot ───────────────────────────────────────────────

export const pilotStatusSchema = z.enum([
  'proposed',
  'setup',
  'active',
  'data_collection',
  'ingestion',
  'review',
  'converted',
  'cancelled',
]);
export type PilotStatus = z.infer<typeof pilotStatusSchema>;

export const pilotChecklistSchema = z.object({
  dataReceived: z.boolean(),
  ingestionComplete: z.boolean(),
  demoDatasetReady: z.boolean(),
  userOnboardingComplete: z.boolean(),
  reviewMeetingScheduled: z.boolean(),
  conversionTriggered: z.boolean(),
});
export type PilotChecklist = z.infer<typeof pilotChecklistSchema>;

export const pilotSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  product: dealProductSchema,
  pilotStatus: pilotStatusSchema,
  successCriteria: z.array(z.string()),
  startDate: z.string().nullable(),
  targetReviewDate: z.string().nullable(),
  owner: z.string(),
  ingestionStatus: z.string().nullable(),
  checklist: pilotChecklistSchema,
  currentBlockers: z.array(z.string()),
  daysActive: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Pilot = z.infer<typeof pilotSchema>;

// ── Ingestion Run ───────────────────────────────────────

export const ingestionStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
  'retrying',
]);
export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

export const ingestionRunSchema = z.object({
  id: z.string(),
  pilotId: z.string().nullable(),
  migrationId: z.string().nullable(),
  accountName: z.string(),
  sourceSystem: z.string(),
  status: ingestionStatusSchema,
  processedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
  duplicateCount: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  trustSignal: z.enum(['verified', 'partial', 'unverified']).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type IngestionRun = z.infer<typeof ingestionRunSchema>;

// ── Proposal ────────────────────────────────────────────

export const proposalStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
]);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  accountName: z.string(),
  quoteSource: z.string().nullable(),
  pricingModel: z.string().nullable(),
  status: proposalStatusSchema,
  amount: z.number().nullable(),
  currency: z.string().default('CAD'),
  pilotPackageIssued: z.boolean(),
  conversionPricingReady: z.boolean(),
  generatedAt: z.string(),
});
export type Proposal = z.infer<typeof proposalSchema>;

// ── Partner Referral ────────────────────────────────────

export const partnerReferralSchema = z.object({
  id: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  dealId: z.string(),
  accountName: z.string(),
  referralStatus: z.enum(['registered', 'qualified', 'converted', 'expired']),
  commissionStatus: z.enum(['pending', 'earned', 'paid', 'cancelled']).nullable(),
  commissionAmount: z.number().nullable(),
  referredAt: z.string(),
});
export type PartnerReferral = z.infer<typeof partnerReferralSchema>;

// ── Account Health / Proof Summary ──────────────────────

export const accountHealthSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  pilotId: z.string().nullable(),
  readinessScore: z.number().min(0).max(100),
  migrationHealth: z.enum(['healthy', 'degraded', 'failed', 'not_started']),
  ingestionSuccess: z.boolean().nullable(),
  productUsageSummary: z.string().nullable(),
  recommendationTrust: z.enum(['high', 'medium', 'low']).nullable(),
  evidencePacksAvailable: z.number().int().min(0),
  governancePosture: z.enum(['compliant', 'partial', 'non_compliant']),
  proofStatus: z.enum(['ready', 'in_progress', 'not_started']),
  lastActivityAt: z.string().nullable(),
});
export type AccountHealth = z.infer<typeof accountHealthSchema>;

// ── Follow-up Task ──────────────────────────────────────

export const followUpPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type FollowUpPriority = z.infer<typeof followUpPrioritySchema>;

export const followUpSchema = z.object({
  id: z.string(),
  dealId: z.string().nullable(),
  pilotId: z.string().nullable(),
  accountName: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  owner: z.string(),
  priority: followUpPrioritySchema,
  dueDate: z.string(),
  isOverdue: z.boolean(),
  completedAt: z.string().nullable(),
  trigger: z.string(),
  createdAt: z.string(),
});
export type FollowUp = z.infer<typeof followUpSchema>;

// ── Account (unified view) ──────────────────────────────

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  dealStage: dealStageSchema.nullable(),
  activePilot: z.boolean(),
  billingState: z.string().nullable(),
  partnerSource: z.string().nullable(),
  productFootprint: z.array(dealProductSchema),
  owner: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  healthScore: z.number().min(0).max(100).nullable(),
  nextAction: z.string().nullable(),
  currentBlocker: z.string().nullable(),
});
export type Account = z.infer<typeof accountSchema>;
