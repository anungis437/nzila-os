/**
 * ARTIFACT TYPE: Observability
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 *
 * ICRA event observability — lightweight structured event logging.
 * Observability errors NEVER surface to users or break flows.
 * No personal identifiers are logged. IP is hashed before it is logged.
 *
 * Events are emitted as structured log records. They were written to an icra_events table that no schema file or migration ever
 * defined, inside a try that swallowed every error, so on a real database every event was silently lost; a store needs its own
 * reviewed table and retention before events are persisted again.
 */

import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

export type IcraEventKind =
  | 'assessment_started'
  | 'consent_accepted'
  | 'org_context_completed'
  | 'section_advanced'
  | 'section_completed'
  | 'section_abandoned'
  | 'assessment_resumed'
  | 'assessment_submitted'
  | 'results_viewed'
  | 'results_emailed'
  | 'scoring_error'
  | 'submission_error'
  | 'turnstile_failed'
  | 'adaptive_profile_created'
  | 'assessment_routed'
  | 'adaptive_question_deferred'
  | 'report_unlock_requested'
  | 'enterprise_diagnostic_requested'
  | 'landing_page_viewed'
  | 'cta_clicked';

export interface IcraEvent {
  kind: IcraEventKind;
  assessmentId?: string;
  sectionId?: string;
  metadata?: Record<string, string | number | boolean>;
  occurredAt: string;
  ipHash?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/**
 * Track an ICRA observability event as a structured log record. Never throws.
 */
export async function trackIcraEvent(event: IcraEvent): Promise<void> {
  try {
    logger.info('icra.event', {
      kind: event.kind,
      assessmentId: event.assessmentId,
      sectionId: event.sectionId,
      metadata: event.metadata,
      occurredAt: event.occurredAt,
      ipHash: event.ipHash,
    });
  } catch {
    // A logging failure must never affect a user flow.
  }
}

/** Synchronous fire-and-forget wrapper */
export function fireAndForgetEvent(event: Omit<IcraEvent, 'occurredAt'>): void {
  const fullEvent: IcraEvent = { ...event, occurredAt: new Date().toISOString() };
  void trackIcraEvent(fullEvent);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTM capture helper — client-side, sessionStorage-backed
// ─────────────────────────────────────────────────────────────────────────────

import type { UtmParams } from './types';

/**
 * Capture UTM parameters from URL search params.
 * Returns only the UTM-relevant fields; ignores everything else.
 * Safe to call with any URLSearchParams — returns empty object if none found.
 */
export function captureUtmFromUrl(
  searchParams: URLSearchParams | Record<string, string>,
): UtmParams {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    return (searchParams as Record<string, string>)[key];
  };

  const source = get('utm_source');
  const medium = get('utm_medium');
  const campaign = get('utm_campaign');
  const content = get('utm_content');
  const term = get('utm_term');

  const result: UtmParams = {};
  if (source) result.source = source;
  if (medium) result.medium = medium;
  if (campaign) result.campaign = campaign;
  if (content) result.content = content;
  if (term) result.term = term;
  return result;
}

