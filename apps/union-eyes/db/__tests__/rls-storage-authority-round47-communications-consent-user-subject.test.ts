/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 47: COMMUNICATIONS_CONSENT_USER_SUBJECT_AUTHORITY —
 * establishes USER_SUBJECT_WITHIN_TENANT as a reusable authority archetype:
 * a row can belong to an organization while ALSO being additionally scoped
 * to a specific user/subject, and same-organization membership must never
 * silently grant authority over another subject's row.
 *
 * Investigation universe (the 10 tables named by the round spec):
 *   communication_preferences_phase4, cookie_consents, sms_campaigns,
 *   sms_conversations, sms_opt_outs, user_consents,
 *   user_notification_preferences, newsletter_engagement,
 *   newsletter_list_subscribers, sms_campaign_recipients.
 *
 * CLOSED this round (6 tables):
 *   TENANT_RLS_REQUIRED (USER_SUBJECT_WITHIN_TENANT): user_consents
 *   TENANT_RLS_REQUIRED (anonymous-subject-legitimate): cookie_consents
 *   TENANT_RLS_REQUIRED (DIRECT_ORG_TENANT_ROOT): sms_campaigns, sms_conversations
 *   CONTAINED_NO_AUTHORITY: communication_preferences_phase4, sms_campaign_recipients,
 *     sms_opt_outs, newsletter_engagement (all have router-registered Django
 *     ViewSets, contained this round, even though the TS side is dead)
 *
 * EXCEPTIONS retained (documented, NEEDS_REVIEW):
 *   user_notification_preferences — DUAL_SCHEMA (financial-service has its
 *     own actively-used declaration of the same physical table name)
 *   newsletter_list_subscribers — route-shape ambiguity (item vs collection
 *     semantics), re-confirmed from round 42, needs a product decision
 *
 * SECURITY DEFECT FOUND AND FIXED (same-org cross-user access,
 * user_consents): app/api/members/[id]/consents/route.ts had org scoping
 * but no subject scoping — any org member could read, and any steward
 * mutate, any other member's consent record. Fixed with a new ownerColumn
 * itemRoute enforcement in crud-factory.ts (previously only the collection
 * GET honoured ownerColumn) plus blockedPatchFields locking consent facts.
 *
 * CROSS-PARENT-CONSISTENCY DEFECT FOUND, NOT FIXED (dead code,
 * newsletter_engagement): calculateEngagementScore() takes an
 * organizationId parameter but never applies it to its newsletterEngagement
 * query — flagged for whoever revives that dead code path.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';

const APP_ROOT = resolve(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

/* ── Closed cohort: manifest shape assertions ─────────────────────────── */

describe('round 47 TENANT_RLS_REQUIRED (USER_SUBJECT_WITHIN_TENANT): user_consents', () => {
  it('has the proven org+subject scoped shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'user_consents');
    expect(entry, 'user_consents: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'UPDATE']);
    expect(entry!.requiredSystemPrivileges).toEqual([]);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 47 TENANT_RLS_REQUIRED (anonymous-subject-legitimate): cookie_consents', () => {
  it('has the proven org-scoped, consent-id-keyed shape', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'cookie_consents');
    expect(entry, 'cookie_consents: no manifest entry found').toBeTruthy();
    expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE']);
    expect(entry!.invocationAuthority).toBe('TENANT_USER');
    expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe.each(['sms_campaigns', 'sms_conversations'])(
  'round 47 TENANT_RLS_REQUIRED (DIRECT_ORG_TENANT_ROOT): %s',
  (table) => {
    it('has the proven org-scoped shape', () => {
      const entry = storageAuthorityManifest.find((e) => e.table === table);
      expect(entry, `${table}: no manifest entry found`).toBeTruthy();
      expect(entry!.classification).toBe('TENANT_RLS_REQUIRED');
      expect(entry!.requiredRuntimePrivileges).toEqual(['SELECT', 'INSERT']);
      expect(entry!.requiredSystemPrivileges).toEqual([]);
      expect(entry!.invocationAuthority).toBe('TENANT_USER');
      expect(entry!.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
    });
  },
);

describe.each(['communication_preferences_phase4', 'sms_campaign_recipients', 'sms_opt_outs', 'newsletter_engagement'])(
  'round 47 CONTAINED_NO_AUTHORITY: %s',
  (table) => {
    it('has the strict zero-authority shape', () => {
      const entry = storageAuthorityManifest.find((e) => e.table === table);
      expect(entry, `${table}: no manifest entry found`).toBeTruthy();
      expect(entry!.classification).toBe('CONTAINED_NO_AUTHORITY');
      expect(entry!.requiredRuntimePrivileges).toEqual([]);
      expect(entry!.requiredSystemPrivileges).toEqual([]);
      expect(entry!.invocationAuthority).toBe('NONE');
      expect(entry!.dbExecutionPrincipal).toBe('NONE');
    });
  },
);

describe('round 47 CONTAINED_NO_AUTHORITY: communication_preferences_phase4 scopeDisposition', () => {
  it('has the required scopeDisposition (no canonical Drizzle declaration exists)', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'communication_preferences_phase4');
    expect(entry).toBeTruthy();
    expect(entry!.scopeDisposition).toBe('DECLARATION_STALE_OR_NONCANONICAL');
  });
});

describe('round 47: no TBD authority fields remain on the closed cohort', () => {
  const CLOSED = [
    'user_consents',
    'cookie_consents',
    'sms_campaigns',
    'sms_conversations',
    'communication_preferences_phase4',
    'sms_campaign_recipients',
    'sms_opt_outs',
    'newsletter_engagement',
  ];

  it.each(CLOSED)('%s has no TBD fields', (table) => {
    const entry = storageAuthorityManifest.find((e) => e.table === table);
    expect(entry!.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry!.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry!.invocationAuthority).not.toBe('TBD');
    expect(entry!.dbExecutionPrincipal).not.toBe('TBD');
  });
});

/* ── Exceptions retained ───────────────────────────────────────────────── */

describe('round 47 exception: user_notification_preferences stays NEEDS_REVIEW', () => {
  it('is documented as a DUAL_SCHEMA exception, not silently dropped', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'user_notification_preferences');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('NEEDS_REVIEW');
    expect(entry!.reason).toContain('DUAL_SCHEMA');
    expect(entry!.reason).toContain('financial-service');
  });
});

describe('round 47 exception CLOSED round 55: newsletter_list_subscribers', () => {
  it('is documented as closed (route-shape defect fixed), not silently dropped', () => {
    const entry = storageAuthorityManifest.find((e) => e.table === 'newsletter_list_subscribers');
    expect(entry).toBeTruthy();
    expect(entry!.classification).toBe('PARENT_OWNED_RLS_REQUIRED');
    expect(entry!.reason).toContain('CLOSED round 55');
    expect(entry!.reason).toContain('NESTED_COLLECTION_ITEM_AUTHORITY');
  });
});

/* ── Same-org cross-user ratchet (doctrine sections 5, 6, 28) ──────────── *
 * A permanent regression guard for the user_consents fix: the route must
 * keep deriving the subject from authentication (ownerColumn), not from a
 * caller-supplied ID, and must keep blocking rewrites of consent facts.
 */

describe('round 47 same-org cross-user ratchet: user_consents route', () => {
  it('scopes both GET and PATCH to the authenticated subject via ownerColumn', () => {
    const src = source('app/api/members/[id]/consents/route.ts');
    expect(src).toContain("ownerColumn: 'userId'");
  });

  it('keeps consent facts immutable via blockedPatchFields', () => {
    const src = source('app/api/members/[id]/consents/route.ts');
    expect(src).toContain('blockedPatchFields');
    expect(src).toContain("'consentType'");
    expect(src).toContain("'legalBasis'");
    expect(src).toContain("'consentText'");
  });

  it('does not export a DELETE handler (consent provenance must not be erasable)', () => {
    const src = source('app/api/members/[id]/consents/route.ts');
    expect(src).toContain('export { GET, PATCH }');
    expect(src).not.toMatch(/export \{ GET, PATCH, DELETE \}/);
  });
});

describe('round 47 crud-factory itemRoute ownerColumn ratchet', () => {
  it('buildItemHandlers applies ownerColumn to GET/PATCH/DELETE conditions', () => {
    const src = source('lib/api/crud-factory.ts');
    const occurrences = src.match(/if \(ownerCol && userId\) \{\s*conditions\.push\(eq\(ownerCol, userId\)\);/g);
    // One in buildCollectionHandlers' GET (pre-existing) + three in
    // buildItemHandlers' GET/PATCH/DELETE (added this round) = 4 total.
    expect(occurrences?.length ?? 0).toBe(4);
  });
});
