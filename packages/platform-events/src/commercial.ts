/**
 * @nzila/platform-events — Commercial GTM Event Types
 *
 * Canonical commercial event model for all Tier 1 apps (Union Eyes, Flow, Zonga).
 * These events feed the Revenue Command Center and CRM pipeline.
 *
 * Usage:
 *   import { createCommercialEvent, COMMERCIAL_EVENTS } from '@nzila/platform-events/commercial'
 *   const event = createCommercialEvent(COMMERCIAL_EVENTS.LEAD_CREATED, { ... }, { orgId, actorId })
 *
 * @module @nzila/platform-events/commercial
 */

import { createPlatformEvent } from './bus'
import type { PlatformEvent, PlatformEventMetadata } from './types'

// ── Event Type Registry ──────────────────────────────────────────────────────

export const COMMERCIAL_EVENTS = {
  // Top-of-funnel
  LEAD_CREATED:           'commercial.lead.created',
  LEAD_ENRICHED:          'commercial.lead.enriched',
  // Engagement
  DEMO_BOOKED:            'commercial.demo.booked',
  DEMO_COMPLETED:         'commercial.demo.completed',
  // Trial
  TRIAL_STARTED:          'commercial.trial.started',
  TRIAL_ACTIVATED:        'commercial.trial.activated',
  TRIAL_EXPIRED:          'commercial.trial.expired',
  // Sales
  PILOT_STARTED:          'commercial.pilot.started',
  PILOT_COMPLETED:        'commercial.pilot.completed',
  PROPOSAL_SENT:          'commercial.proposal.sent',
  // Close
  DEAL_WON:               'commercial.deal.won',
  DEAL_LOST:              'commercial.deal.lost',
  // Revenue lifecycle
  SUBSCRIPTION_STARTED:   'commercial.subscription.started',
  SUBSCRIPTION_UPGRADED:  'commercial.subscription.upgraded',
  SUBSCRIPTION_CANCELLED: 'commercial.subscription.cancelled',
  EXPANSION_CLOSED:       'commercial.expansion.closed',
  // Risk signals
  CHURN_RISK_FLAGGED:     'commercial.churnrisk.flagged',
  RENEWAL_RISK_FLAGGED:   'commercial.renewalrisk.flagged',
} as const

export type CommercialEventType = (typeof COMMERCIAL_EVENTS)[keyof typeof COMMERCIAL_EVENTS]

// ── Payload Shapes ───────────────────────────────────────────────────────────

export interface LeadCreatedPayload {
  leadId: string
  email: string
  firstName?: string
  company?: string
  source: string
  appId: 'union-eyes' | 'flow' | 'zonga' | 'control-plane'
  inquiryType?: string
  estimatedArrUsd?: number
}

export interface DemoBookedPayload {
  leadId: string
  email: string
  appId: string
  scheduledAt: string
  ownerId?: string
}

export interface TrialStartedPayload {
  leadId: string
  email: string
  company: string
  appId: string
  trialEndsAt: string
  teamSize?: string
  primaryUseCase?: string
  estimatedArrUsd?: number
}

export interface TrialActivatedPayload {
  leadId: string
  email: string
  appId: string
  firstActionAt: string
  timeToActivationMs?: number
}

export interface PilotStartedPayload {
  orgId: string
  leadId?: string
  appId: string
  pilotEndsAt: string
  contractValueUsd?: number
  ownerId?: string
}

export interface ProposalSentPayload {
  leadId: string
  orgId?: string
  appId: string
  proposalValueUsd: number
  sentAt: string
  ownerId?: string
}

export interface DealWonPayload {
  leadId?: string
  orgId: string
  appId: string
  arrUsd: number
  mrrUsd: number
  planId: string
  closedAt: string
  salesCycleDays?: number
  ownerId?: string
}

export interface DealLostPayload {
  leadId?: string
  orgId?: string
  appId: string
  proposalValueUsd?: number
  lostAt: string
  lostReason?: string
}

export interface SubscriptionStartedPayload {
  userId?: string
  orgId: string
  appId: string
  planId: string
  billingCycle: 'monthly' | 'annual'
  mrrUsd: number
  stripeSubscriptionId?: string
  trialConverted?: boolean
}

export interface SubscriptionUpgradedPayload {
  userId?: string
  orgId: string
  appId: string
  fromPlanId: string
  toPlanId: string
  expansionMrrUsd: number
  stripeSubscriptionId?: string
}

export interface SubscriptionCancelledPayload {
  userId?: string
  orgId: string
  appId: string
  planId: string
  mrrLostUsd: number
  stripeSubscriptionId?: string
  cancellationReason?: string
}

export interface ExpansionClosedPayload {
  orgId: string
  appId: string
  expansionType: 'seat_increase' | 'plan_upgrade' | 'add_on' | 'cross_sell'
  expansionArrUsd: number
  closedAt: string
}

// ── Factory Helper ────────────────────────────────────────────────────────────

type MinimalMeta = Pick<PlatformEventMetadata, 'orgId' | 'actorId'> & {
  correlationId?: string
  source?: string
}

function buildMeta(meta: MinimalMeta): Omit<PlatformEventMetadata, 'causationId' | 'traceId' | 'spanId'> & {
  causationId?: null
  traceId?: null
  spanId?: null
} {
  return {
    orgId: meta.orgId,
    actorId: meta.actorId,
    correlationId: meta.correlationId ?? crypto.randomUUID(),
    source: meta.source ?? 'commercial',
  }
}

export function createCommercialEvent<TPayload>(
  type: CommercialEventType,
  payload: TPayload,
  meta: MinimalMeta,
): PlatformEvent<TPayload> {
  return createPlatformEvent(type, payload, buildMeta(meta))
}

// ── Convenience Emitters ──────────────────────────────────────────────────────

export function emitLeadCreated(
  payload: LeadCreatedPayload,
  meta: MinimalMeta,
): PlatformEvent<LeadCreatedPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.LEAD_CREATED, payload, meta)
}

export function emitTrialStarted(
  payload: TrialStartedPayload,
  meta: MinimalMeta,
): PlatformEvent<TrialStartedPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.TRIAL_STARTED, payload, meta)
}

export function emitSubscriptionStarted(
  payload: SubscriptionStartedPayload,
  meta: MinimalMeta,
): PlatformEvent<SubscriptionStartedPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.SUBSCRIPTION_STARTED, payload, meta)
}

export function emitSubscriptionUpgraded(
  payload: SubscriptionUpgradedPayload,
  meta: MinimalMeta,
): PlatformEvent<SubscriptionUpgradedPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.SUBSCRIPTION_UPGRADED, payload, meta)
}

export function emitSubscriptionCancelled(
  payload: SubscriptionCancelledPayload,
  meta: MinimalMeta,
): PlatformEvent<SubscriptionCancelledPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.SUBSCRIPTION_CANCELLED, payload, meta)
}

export function emitDealWon(
  payload: DealWonPayload,
  meta: MinimalMeta,
): PlatformEvent<DealWonPayload> {
  return createCommercialEvent(COMMERCIAL_EVENTS.DEAL_WON, payload, meta)
}
