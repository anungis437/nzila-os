import type { AuditEventId, ClaimId, MatterId, OrganizationId } from './ids.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/**
 * Audit events carry who/what/when/where and opaque identifiers only. Free
 * text and restricted content are rejected by construction (WA-T066).
 */
export const ALLOWED_AUDIT_DETAIL_KEYS: readonly string[] = [
  'fromState',
  'toState',
  'submissionVersion',
  'ruleSourceId',
  'method',
  'reasonCode',
  'grantId',
  'documentRef',
  'count',
];

export interface AuditEvent {
  readonly id: AuditEventId;
  readonly organizationId: OrganizationId;
  readonly matterId: MatterId | null;
  readonly claimId: ClaimId | null;
  readonly actor: string;
  readonly action: string;
  readonly at: string;
  readonly correlationId: string;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
}

export function buildAuditEvent(input: Omit<AuditEvent, 'details'> & { details?: Readonly<Record<string, unknown>> }, forbiddenFragments: readonly string[] = []): Result<AuditEvent, 'DISALLOWED_DETAIL_KEY' | 'NON_SCALAR_DETAIL' | 'DETAIL_TOO_LONG' | 'FORBIDDEN_CONTENT'> {
  const details: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(input.details ?? {})) {
    if (!ALLOWED_AUDIT_DETAIL_KEYS.includes(k)) return err('DISALLOWED_DETAIL_KEY', `detail key not allow-listed: ${k}`);
    if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return err('NON_SCALAR_DETAIL', 'details must be scalar');
    if (typeof v === 'string') {
      if (v.length > 80) return err('DETAIL_TOO_LONG', 'detail values are short codes, not prose');
      if (forbiddenFragments.some((f) => v.includes(f))) return err('FORBIDDEN_CONTENT', 'restricted content may not enter the audit trail');
    }
    details[k] = v as string | number | boolean | null;
  }
  return ok({ ...input, details });
}
