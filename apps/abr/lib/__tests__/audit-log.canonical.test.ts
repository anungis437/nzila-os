/**
 * Canonical audit-hash tests (CourtLens Gap 3 audit-integrity repair).
 *
 * Contract under test:
 *   - `buildCanonicalPayload` emits keys in strict ASCII sort order regardless
 *     of caller input order, so `JSON.stringify` is byte-deterministic.
 *   - `computeCanonicalHash` produces the SHA-256 that the writer persists.
 *   - Rows tagged `canonical-v1` are independently reconstructable from
 *     persisted columns; the recomputed hash matches the stored hash byte-
 *     for-byte.
 *   - Any tampering with a canonical column breaks recomputation.
 *   - The chain link (`previous_hash`) is verifiable across successive rows.
 *
 * Pure unit tests run always. DB-integration tests run only when the same
 * gate as `route.db.integration.test.ts` is set:
 *     ABR_DB_INTEGRATION_TEST=true
 *     ABR_DB_INTEGRATION_DB_APPROVED=true
 *     DATABASE_URL=<postgres url pointing at a disposable DB>
 */
import { createHash, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { platformDb } from '@nzila/db/platform';
import {
  CANONICAL_HASH_VERSION,
  CANONICAL_KEY_ORDER,
  buildCanonicalPayload,
  canonicalStringify,
  computeCanonicalHash,
  logAuditEvent,
  setAuditLogWriter,
  type CanonicalPayloadInput,
} from '@/lib/audit-log';

const integrationEnabled = process.env.ABR_DB_INTEGRATION_TEST === 'true';
const integrationApproved = process.env.ABR_DB_INTEGRATION_DB_APPROVED === 'true';
const runDbIntegration = integrationEnabled && integrationApproved && !!process.env.DATABASE_URL;
const dbDescribe = runDbIntegration ? describe : describe.skip;

const baseInput: CanonicalPayloadInput = {
  action: 'courtlens.review_packet.exported',
  actorClerkUserId: 'user-canonical-1',
  actorRole: null,
  afterJson: { format: 'json', locale: 'en-CA' },
  hashTimestamp: '2026-07-18T21:52:11.123Z',
  orgId: '00000000-0000-4000-8000-000000000001',
  targetId: '00000000-0000-4000-8000-000000000abc',
  targetType: 'matter',
};

describe('canonical audit payload (pure)', () => {
  it('emits fixed key order matching CANONICAL_KEY_ORDER', () => {
    const payload = buildCanonicalPayload(baseInput);
    expect(Object.keys(payload)).toEqual([...CANONICAL_KEY_ORDER]);
  });

  it('produces deterministic JSON regardless of caller construction order', () => {
    const forwards = buildCanonicalPayload(baseInput);
    const reordered = buildCanonicalPayload({
      targetType: baseInput.targetType,
      targetId: baseInput.targetId,
      orgId: baseInput.orgId,
      hashTimestamp: baseInput.hashTimestamp,
      afterJson: baseInput.afterJson,
      actorRole: baseInput.actorRole,
      actorClerkUserId: baseInput.actorClerkUserId,
      action: baseInput.action,
    });
    expect(JSON.stringify(forwards)).toBe(JSON.stringify(reordered));
    expect(computeCanonicalHash(forwards, null)).toBe(computeCanonicalHash(reordered, null));
  });

  it('always stamps hashVersion = canonical-v1', () => {
    const payload = buildCanonicalPayload(baseInput);
    expect(payload.hashVersion).toBe(CANONICAL_HASH_VERSION);
    expect(payload.hashVersion).toBe('canonical-v1');
  });

  it('preserves nulls (does not elide null actorRole / targetId / afterJson)', () => {
    const payload = buildCanonicalPayload({
      ...baseInput,
      actorRole: null,
      targetId: null,
      afterJson: null,
    });
    const serialised = JSON.stringify(payload);
    expect(serialised).toContain('"actorRole":null');
    expect(serialised).toContain('"targetId":null');
    expect(serialised).toContain('"afterJson":null');
  });

  it('canonical SHA-256 wrapper is {payload, previousHash} in that exact order', () => {
    const payload = buildCanonicalPayload(baseInput);
    const previousHash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const expected = createHash('sha256')
      .update(canonicalStringify({ payload, previousHash }), 'utf8')
      .digest('hex');
    expect(computeCanonicalHash(payload, previousHash)).toBe(expected);
  });

  it('null previousHash is included verbatim in the wrapper (first-row case)', () => {
    const payload = buildCanonicalPayload(baseInput);
    const expected = createHash('sha256')
      .update(canonicalStringify({ payload, previousHash: null }), 'utf8')
      .digest('hex');
    expect(computeCanonicalHash(payload, null)).toBe(expected);
  });

  it('canonicalStringify sorts nested object keys deterministically (tolerates PG jsonb reordering)', () => {
    const a = { note: 'x', runTag: 'r1', nested: { b: 2, a: 1 } };
    const b = { nested: { a: 1, b: 2 }, runTag: 'r1', note: 'x' };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
    // Explicit expected form:
    expect(canonicalStringify(a)).toBe('{"nested":{"a":1,"b":2},"note":"x","runTag":"r1"}');
  });

  it('canonicalStringify preserves array order (semantic)', () => {
    expect(canonicalStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('tampering with any canonical field changes the hash', () => {
    const base = buildCanonicalPayload(baseInput);
    const baseHash = computeCanonicalHash(base, null);

    for (const key of CANONICAL_KEY_ORDER) {
      if (key === 'hashVersion') continue; // covered separately (constant)
      const tampered = buildCanonicalPayload({
        ...baseInput,
        [key]:
          key === 'afterJson'
            ? { ...baseInput.afterJson, tampered: true }
            : key === 'actorRole' || key === 'targetId'
              ? 'tampered-value'
              : `${(baseInput as unknown as Record<string, string>)[key]}-tampered`,
      } as CanonicalPayloadInput);
      const tamperedHash = computeCanonicalHash(tampered, null);
      expect(tamperedHash, `tampering ${key} must change the hash`).not.toBe(baseHash);
    }
  });

  it('tampering with previousHash changes the wrapper hash', () => {
    const payload = buildCanonicalPayload(baseInput);
    const a = computeCanonicalHash(payload, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const b = computeCanonicalHash(payload, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(a).not.toBe(b);
  });

  it('handles Unicode / French accents deterministically', () => {
    const payload = buildCanonicalPayload({
      ...baseInput,
      afterJson: {
        title: 'Décision arbitrale — Émilie Côté',
        note: 'contrôle qualité: à réviser',
      },
    });
    const serialised = JSON.stringify(payload);
    // JSON.stringify escapes non-ASCII deterministically as \uXXXX or leaves
    // them literal depending on runtime; assert that repeated serialisation
    // yields the same bytes and the hash is stable.
    expect(JSON.stringify(payload)).toBe(serialised);
    const h1 = computeCanonicalHash(payload, null);
    const h2 = computeCanonicalHash(buildCanonicalPayload({
      ...baseInput,
      afterJson: {
        title: 'Décision arbitrale — Émilie Côté',
        note: 'contrôle qualité: à réviser',
      },
    }), null);
    expect(h1).toBe(h2);
  });

  it('handles null targetId (event.recordId undefined case)', () => {
    const payload = buildCanonicalPayload({ ...baseInput, targetId: null });
    expect(payload.targetId).toBeNull();
    // Recomputation must succeed with a null in-place.
    const hash = computeCanonicalHash(payload, null);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles empty metadata (afterJson = {})', () => {
    const payload = buildCanonicalPayload({ ...baseInput, afterJson: {} });
    expect(JSON.stringify(payload.afterJson)).toBe('{}');
    const hash = computeCanonicalHash(payload, null);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonical hash defect regression (pre-repair contract)', () => {
  it('legacy hashing (with an ephemeral, unpersisted timestamp) is NOT reconstructable', () => {
    // This test reproduces the PRE-repair defect to prove it stays fixed.
    // Legacy writer generated the timestamp inside a hash-only object, never
    // persisted it, then read the row back. Any reconstruction attempt has
    // to guess the timestamp and therefore fails with overwhelming
    // probability. We simulate the guess by picking a plausible-adjacent
    // timestamp and asserting the hash does NOT match.
    const legacyPayload = {
      orgId: baseInput.orgId,
      actorClerkUserId: baseInput.actorClerkUserId,
      action: baseInput.action,
      targetType: baseInput.targetType,
      targetId: baseInput.targetId,
      afterJson: baseInput.afterJson,
      timestamp: '2026-07-18T21:52:11.123Z',
    };
    const legacyHash = createHash('sha256')
      .update(JSON.stringify({ payload: legacyPayload, previousHash: null }))
      .digest('hex');

    // Guess a timestamp 1 ms later, as any independent verifier who did not
    // capture the exact millisecond would.
    const guessed = { ...legacyPayload, timestamp: '2026-07-18T21:52:11.124Z' };
    const guessedHash = createHash('sha256')
      .update(JSON.stringify({ payload: guessed, previousHash: null }))
      .digest('hex');

    expect(guessedHash).not.toBe(legacyHash);
  });

  it('repaired canonical writer IS reconstructable from persisted columns', () => {
    // Contract: given only the persisted columns, an independent verifier
    // MUST recompute the same hash. This is the exact invariant the FAILED
    // classification demanded.
    const persistedOccurredAt = new Date('2026-07-18T21:52:11.123Z');
    const persistedRow = {
      org_id: baseInput.orgId,
      actor_clerk_user_id: baseInput.actorClerkUserId,
      actor_role: null,
      action: baseInput.action,
      target_type: baseInput.targetType,
      target_id: baseInput.targetId,
      after_json: baseInput.afterJson,
      previous_hash: null,
      occurred_at: persistedOccurredAt,
      hash_version: 'canonical-v1' as const,
    };

    // Independent reconstruction from the row alone:
    const reconstructedPayload = buildCanonicalPayload({
      action: persistedRow.action,
      actorClerkUserId: persistedRow.actor_clerk_user_id,
      actorRole: persistedRow.actor_role,
      afterJson: persistedRow.after_json,
      hashTimestamp: persistedRow.occurred_at.toISOString(),
      orgId: persistedRow.org_id,
      targetId: persistedRow.target_id,
      targetType: persistedRow.target_type,
    });
    const reconstructedHash = computeCanonicalHash(reconstructedPayload, persistedRow.previous_hash);

    // Simulate what the writer computed at INSERT time:
    const writerPayload = buildCanonicalPayload({
      action: baseInput.action,
      actorClerkUserId: baseInput.actorClerkUserId,
      actorRole: null,
      afterJson: baseInput.afterJson,
      hashTimestamp: persistedOccurredAt.toISOString(),
      orgId: baseInput.orgId,
      targetId: baseInput.targetId,
      targetType: baseInput.targetType,
    });
    const writerHash = computeCanonicalHash(writerPayload, null);

    expect(reconstructedHash).toBe(writerHash);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB integration: end-to-end write → read → reconstruct → recompute → assert.
// Runs only when the same gates as the review-packet integration test are
// enabled. Uses a synthetic org tag in `actorClerkUserId` for isolation.
// ─────────────────────────────────────────────────────────────────────────────

dbDescribe('canonical audit hash — DB round-trip', () => {
  it('write → read → reconstruct → recompute → equality holds; tamper breaks equality', async () => {
    setAuditLogWriter(null); // ensure the real writer is used

    const orgRows = await platformDb.execute(sql`
      select id::text as id from orgs order by created_at asc limit 1
    `);
    const orgId = (orgRows[0] as { id?: string } | undefined)?.id;
    if (!orgId) throw new Error('canonical hash DB test requires at least one org');

    const runTag = `canonical_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const actorUserId = `user_${runTag}`;
    const matterId = randomUUID();

    await logAuditEvent({
      action: 'courtlens.canonical_hash.write_probe',
      actorUserId,
      orgId,
      entityType: 'matter',
      recordId: matterId,
      details: { runTag, note: 'Décision — probe' },
    });

    const rows = await platformDb.execute(sql`
      select
        id::text as id,
        org_id::text as org_id,
        actor_clerk_user_id,
        actor_role,
        action,
        target_type,
        target_id::text as target_id,
        after_json,
        hash,
        previous_hash,
        occurred_at,
        hash_version
      from audit_events
      where actor_clerk_user_id = ${actorUserId}
      order by created_at asc
    `);
    expect(rows.length).toBe(1);
    const row = rows[0] as {
      hash: string;
      previous_hash: string | null;
      occurred_at: Date | string;
      hash_version: string;
      org_id: string;
      actor_clerk_user_id: string;
      actor_role: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      after_json: Record<string, unknown> | null;
    };
    expect(row.hash_version).toBe(CANONICAL_HASH_VERSION);

    const occurredAtIso =
      row.occurred_at instanceof Date ? row.occurred_at.toISOString() : new Date(row.occurred_at).toISOString();
    const reconstructed = buildCanonicalPayload({
      action: row.action,
      actorClerkUserId: row.actor_clerk_user_id,
      actorRole: row.actor_role,
      afterJson: row.after_json,
      hashTimestamp: occurredAtIso,
      orgId: row.org_id,
      targetId: row.target_id,
      targetType: row.target_type,
    });
    const recomputed = computeCanonicalHash(reconstructed, row.previous_hash);
    expect(recomputed).toBe(row.hash);

    // Tamper: mutate a canonical field in memory and prove equality breaks.
    const tampered = buildCanonicalPayload({
      action: row.action,
      actorClerkUserId: row.actor_clerk_user_id,
      actorRole: row.actor_role,
      afterJson: { ...(row.after_json ?? {}), tamper: true },
      hashTimestamp: occurredAtIso,
      orgId: row.org_id,
      targetId: row.target_id,
      targetType: row.target_type,
    });
    expect(computeCanonicalHash(tampered, row.previous_hash)).not.toBe(row.hash);
  });

  it('chain linkage: 3 successive events form a verifiable hash chain', async () => {
    setAuditLogWriter(null);

    const orgRows = await platformDb.execute(sql`
      select id::text as id from orgs order by created_at asc limit 1
    `);
    const orgId = (orgRows[0] as { id?: string } | undefined)?.id;
    if (!orgId) throw new Error('canonical hash DB test requires at least one org');

    const runTag = `chain_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const actorUserId = `user_${runTag}`;

    for (let i = 0; i < 3; i++) {
      await logAuditEvent({
        action: 'courtlens.canonical_hash.chain_probe',
        actorUserId,
        orgId,
        entityType: 'matter',
        recordId: randomUUID(),
        details: { runTag, step: i },
      });
    }

    const rows = await platformDb.execute(sql`
      select
        id::text as id,
        hash,
        previous_hash,
        occurred_at,
        hash_version,
        org_id::text as org_id,
        actor_clerk_user_id,
        actor_role,
        action,
        target_type,
        target_id::text as target_id,
        after_json
      from audit_events
      where actor_clerk_user_id = ${actorUserId}
      order by created_at asc
    `);
    expect(rows.length).toBe(3);

    // Chain check: each row's previous_hash equals the previous row's hash
    // (relative to the org's global chain — for a freshly tagged actor whose
    // events are the only ones in this window, first row's previous_hash
    // may point to any earlier row in the org).
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1] as { hash: string };
      const cur = rows[i] as { previous_hash: string | null };
      expect(cur.previous_hash).toBe(prev.hash);
    }

    // Canonical recomputation for every row.
    for (const r of rows as unknown as Array<{
      hash: string;
      previous_hash: string | null;
      occurred_at: Date | string;
      hash_version: string;
      org_id: string;
      actor_clerk_user_id: string;
      actor_role: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      after_json: Record<string, unknown> | null;
    }>) {
      expect(r.hash_version).toBe(CANONICAL_HASH_VERSION);
      const iso = r.occurred_at instanceof Date ? r.occurred_at.toISOString() : new Date(r.occurred_at).toISOString();
      const payload = buildCanonicalPayload({
        action: r.action,
        actorClerkUserId: r.actor_clerk_user_id,
        actorRole: r.actor_role,
        afterJson: r.after_json,
        hashTimestamp: iso,
        orgId: r.org_id,
        targetId: r.target_id,
        targetType: r.target_type,
      });
      expect(computeCanonicalHash(payload, r.previous_hash)).toBe(r.hash);
    }
  });
});
