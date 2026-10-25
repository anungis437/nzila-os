// SignatureService.syncDocumentStatus against real PostgreSQL semantics (PGlite) with the actual migration 0023: a
// provider's report is judged, applied once, audited in the same transaction, and never stamped with the local clock
// as an event time. The provider itself is stood in for; no provider was contacted and none is activated here.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG = '11111111-1111-4111-8111-111111111111';
const DOC = '00000000-0000-4000-8000-000000000001';
const SIGNER = '00000000-0000-4000-8000-000000000051';

const state = vi.hoisted(() => ({
  db: null as unknown,
  status: null as null | { envelopeId: string; status: string; signers: Array<Record<string, unknown>>; completedAt?: Date },
  providerFails: false,
  calls: 0,
}));

vi.mock('@/db', () => ({ db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v; } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, work: (tx: unknown) => Promise<unknown>) => (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t)),
}));
vi.mock('./providers', () => ({
  default: {
    getProvider: () => ({
      getEnvelopeStatus: async () => {
        state.calls += 1;
        if (state.providerFails) throw new Error('provider down');
        return state.status;
      },
    }),
  },
}));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }));
vi.mock('@/lib/services/document-storage-service', () => ({ default: {} }));

const { createDocumentDatabase, resetDocumentDatabase, ddl } = await import('@/lib/documents/test-support/pglite-document-database');
const schema = await import('@/db/schema');
const { SignatureService } = await import('./signature-service');
const { classifySignatureEvidence } = await import('@/lib/documents/signature-projection');

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
// Zone-less columns are written in UTC; they are read as text so the local zone of the machine never enters.
const utc = (text: string) => new Date(text.replace(' ', 'T') + 'Z').toISOString();
const doc = async () => (await q('SELECT *, completed_at::text AS completed_at_utc FROM signature_documents WHERE id = $1', [DOC])).rows[0] as Record<string, unknown>;
const signer = async () => (await q('SELECT *, signed_at::text AS signed_at_utc FROM document_signers WHERE id = $1', [SIGNER])).rows[0] as Record<string, unknown>;
const audits = async () => (await q('SELECT action FROM audit_security.audit_logs')).rows.map((r) => (r as { action: string }).action);

async function seed(over: { status?: string; provider?: string; envelope?: string | null; signerStatus?: string; ack?: string | null } = {}) {
  await q(`INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, provider_envelope_id, status, sent_by, provider_acknowledged_at, created_at, updated_at)
           VALUES ($1, $2, 'Agreement', 'agreement', 'https://x', 'a.pdf', 10, $3, $4, $5, $6, 'sender-1', $7, now(), now())`,
    [DOC, ORG, 'a'.repeat(64), over.provider ?? 'docusign', over.envelope === undefined ? 'env-1' : over.envelope, over.status ?? 'sent', over.ack ?? null]);
  await q(`INSERT INTO document_signers (id, document_id, email, name, signing_order, status, provider_signer_id, created_at, updated_at)
           VALUES ($1, $2, 'rep@example.org', 'Rep', 1, $3, 'sig-1', now(), now())`, [SIGNER, DOC, over.signerStatus ?? 'sent']);
}
const observe = (status: string, extra: Record<string, unknown> = {}, signers: Array<Record<string, unknown>> = []) => {
  state.status = { envelopeId: 'env-1', status, signers, ...extra } as never;
};

beforeAll(async () => {
  pg = await createDocumentDatabase();
  for (const table of [schema.signatureDocuments, schema.documentSigners, schema.signatureAuditTrail]) await pg.exec(ddl(table as never));
  const migration = readFileSync(join(__dirname, '..', '..', 'db', 'migrations-platform', '0023_signature_provider_acknowledgment.sql'), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await pg.exec(statement);
  state.db = drizzle(pg, { schema });
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  await resetDocumentDatabase(pg);
  await pg.exec('TRUNCATE signature_audit_trail, document_signers, signature_documents');
  state.status = null; state.providerFails = false; state.calls = 0;
});

describe('SignatureService.syncDocumentStatus', () => {
  it('records a provider completion with the provider’s event time, not the local clock', async () => {
    await seed({ status: 'signed' });
    const eventTime = new Date('2026-02-20T14:15:16.000Z');
    observe('completed', { completedAt: eventTime });
    const before = Date.now();
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: true });
    const row = await doc();
    expect(row.status).toBe('completed');
    expect(new Date(row.provider_acknowledged_at as string).toISOString()).toBe(eventTime.toISOString());
    expect(utc(String(row.completed_at_utc))).toBe(eventTime.toISOString());
    // The local receipt time is kept apart and is plainly later than the event.
    expect(new Date(row.provider_status_observed_at as string).getTime()).toBeGreaterThanOrEqual(before);
    expect(classifySignatureEvidence({ status: row.status, provider: row.provider, providerEnvelopeId: row.provider_envelope_id, providerAcknowledgedAt: row.provider_acknowledged_at })).toBe('verified_completed');
    expect(await audits()).toEqual(['signature.provider_status_sync']);
  });

  it('records a completion that carries no provider time without inventing one, and it stays historical', async () => {
    await seed({ status: 'signed' });
    observe('completed');
    await SignatureService.syncDocumentStatus(DOC);
    const row = await doc();
    expect(row).toMatchObject({ status: 'completed', provider_acknowledged_at: null, completed_at: null });
    expect(row.provider_status_observed_at).not.toBeNull();
    expect(classifySignatureEvidence({ status: row.status, provider: row.provider, providerEnvelopeId: row.provider_envelope_id, providerAcknowledgedAt: row.provider_acknowledged_at })).toBe('historical_evidence');
  });

  it('is idempotent: a replay changes nothing and writes no second record', async () => {
    await seed({ status: 'signed' });
    observe('completed', { completedAt: new Date('2026-02-20T14:15:16.000Z') });
    await SignatureService.syncDocumentStatus(DOC);
    const first = await doc();
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'no_change' });
    expect(await doc()).toEqual(first);
    expect(await audits()).toEqual(['signature.provider_status_sync']);
  });

  it('lets a concurrent pair of syncs apply exactly once', async () => {
    await seed({ status: 'signed' });
    observe('completed', { completedAt: new Date('2026-02-20T14:15:16.000Z') });
    const results = await Promise.all([SignatureService.syncDocumentStatus(DOC), SignatureService.syncDocumentStatus(DOC)]);
    expect(results.filter((r) => r.synced)).toHaveLength(1);
    expect(await audits()).toEqual(['signature.provider_status_sync']);
  });

  it('refuses to regress a terminal document on a stale or replayed observation', async () => {
    await seed({ status: 'completed', ack: '2026-02-20T14:15:16.000Z' });
    observe('sent');
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'terminal_is_final' });
    expect((await doc()).status).toBe('completed');
  });

  it('moves a document forward only', async () => {
    await seed({ status: 'viewed' });
    observe('delivered');
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'stale_observation' });
    observe('signed');
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: true });
    expect((await doc()).status).toBe('signed');
    expect((await doc()).provider_acknowledged_at).toBeNull();
  });

  it('attaches a provider time to an already-completed document once, and never rewrites it', async () => {
    await seed({ status: 'completed' });
    const first = new Date('2026-02-20T14:15:16.000Z');
    observe('completed', { completedAt: first });
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: true });
    observe('completed', { completedAt: new Date('2026-02-21T00:00:00.000Z') });
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'no_change' });
    expect(new Date((await doc()).provider_acknowledged_at as string).toISOString()).toBe(first.toISOString());
  });

  it('leaves the stored state untouched when the provider is unavailable', async () => {
    await seed({ status: 'sent' });
    state.providerFails = true;
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'provider_unavailable' });
    expect((await doc()).status).toBe('sent');
    expect(await audits()).toEqual([]);
  });

  it('does not call, or trust, the built-in internal provider, and ignores a document with no envelope', async () => {
    await seed({ provider: 'internal', status: 'sent' });
    observe('completed', { completedAt: new Date('2026-02-20T14:15:16.000Z') });
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'not_external_provider' });
    expect((await doc()).status).toBe('sent');
    await resetDocumentDatabase(pg);
    await pg.exec('TRUNCATE signature_audit_trail, document_signers, signature_documents');
    await seed({ envelope: null });
    expect(await SignatureService.syncDocumentStatus(DOC)).toEqual({ synced: false, reason: 'no_envelope' });
  });

  it('writes nothing when the mandatory audit cannot be written', async () => {
    await seed({ status: 'signed' });
    await q(`INSERT INTO audit_fault_actions(action) VALUES ('signature.provider_status_sync')`);
    observe('completed', { completedAt: new Date('2026-02-20T14:15:16.000Z') });
    await expect(SignatureService.syncDocumentStatus(DOC)).rejects.toThrow();
    expect(await doc()).toMatchObject({ status: 'signed', provider_acknowledged_at: null });
    expect((await q('SELECT 1 FROM signature_audit_trail')).rows).toHaveLength(0);
  });

  it('advances signers with the provider’s event times, forward only, and never stamps a local decline time', async () => {
    await seed({ status: 'sent', signerStatus: 'sent' });
    const signedAt = new Date('2026-02-19T08:00:00.000Z');
    observe('signed', {}, [{ signerId: 'sig-1', email: 'rep@example.org', status: 'signed', signedAt }]);
    await SignatureService.syncDocumentStatus(DOC);
    const row = await signer();
    expect(row.status).toBe('signed');
    expect(utc(String(row.signed_at_utc))).toBe(signedAt.toISOString());

    // A later, older report cannot undo a settled signer.
    await resetDocumentDatabase(pg);
    await pg.exec('TRUNCATE signature_audit_trail, document_signers, signature_documents');
    await seed({ status: 'viewed', signerStatus: 'declined' });
    observe('signed', {}, [{ signerId: 'sig-1', email: 'rep@example.org', status: 'signed', signedAt }]);
    await SignatureService.syncDocumentStatus(DOC);
    expect((await signer()).status).toBe('declined');

    await resetDocumentDatabase(pg);
    await pg.exec('TRUNCATE signature_audit_trail, document_signers, signature_documents');
    await seed({ status: 'viewed', signerStatus: 'viewed' });
    observe('declined', {}, [{ signerId: 'sig-1', email: 'rep@example.org', status: 'declined' }]);
    await SignatureService.syncDocumentStatus(DOC);
    expect(await signer()).toMatchObject({ status: 'declined', declined_at: null });
  });
});

describe('the database refuses what the service must never do', () => {
  const fails = async (statement: string, params: unknown[] = []) => { let failed = false; try { await q(statement, params); } catch { failed = true; } expect(failed, statement).toBe(true); };

  it('keeps a recorded provider acknowledgment immutable', async () => {
    await seed({ status: 'completed', ack: '2026-02-20T14:15:16.000Z' });
    await fails(`UPDATE signature_documents SET provider_acknowledged_at = now() WHERE id = $1`, [DOC]);
    await fails(`UPDATE signature_documents SET provider_acknowledged_at = NULL WHERE id = $1`, [DOC]);
  });

  it('allows an acknowledgment only on a document with an external provider envelope', async () => {
    await fails(`INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, provider_envelope_id, status, sent_by, provider_acknowledged_at)
                 VALUES ($1, $2, 't', 'a', 'u', 'f', 1, $3, 'internal', 'env', 'completed', 's', now())`, [DOC, ORG, 'a'.repeat(64)]);
    await fails(`INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, provider_envelope_id, status, sent_by, provider_acknowledged_at)
                 VALUES ($1, $2, 't', 'a', 'u', 'f', 1, $3, 'docusign', NULL, 'completed', 's', now())`, [DOC, ORG, 'a'.repeat(64)]);
  });
});
