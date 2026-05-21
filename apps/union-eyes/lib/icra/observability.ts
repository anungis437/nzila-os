/**
 * ARTIFACT TYPE: Observability
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 *
 * ICRA event observability — lightweight structured event logging.
 * Silent failure: observability errors NEVER surface to users or break flows.
 * No personal identifiers are logged. IP is hashed before storage.
 *
 * Events are stored in icra_events (not part of icra-schema.ts — append
 * to that schema if you add this table to the migration).
 */

import { createHash } from 'crypto';

export type IcraEventKind =
  | 'assessment_started'
  | 'consent_accepted'
  | 'section_completed'
  | 'assessment_submitted'
  | 'results_viewed'
  | 'scoring_error'
  | 'submission_error'
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
 * Track an ICRA observability event. Silent on any failure.
 * Do not await in critical paths — fire and forget.
 */
export async function trackIcraEvent(event: IcraEvent): Promise<void> {
  try {
    const { db } = await import('@/db');
    // Dynamic import to avoid circular deps and allow graceful skip if DB unavailable
    await (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(
      buildInsertSql(event),
    );
  } catch {
    // Silent — observability failures must never affect user flows
  }
}

/** Synchronous fire-and-forget wrapper */
export function fireAndForgetEvent(event: Omit<IcraEvent, 'occurredAt'>): void {
  const fullEvent: IcraEvent = { ...event, occurredAt: new Date().toISOString() };
  void trackIcraEvent(fullEvent);
}

/** Raw SQL insert — avoids schema import cycle (icra-schema not in main index) */
function buildInsertSql(event: IcraEvent): { sql: string; params: unknown[] } {
  return {
    sql: `
      INSERT INTO icra_events (
        id, kind, assessment_id, section_id, metadata, occurred_at, ip_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
    `,
    params: [
      generateEventId(),
      event.kind,
      event.assessmentId ?? null,
      event.sectionId ?? null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.occurredAt,
      event.ipHash ?? null,
    ],
  };
}

function generateEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
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

