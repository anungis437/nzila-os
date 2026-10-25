// Reviewed transcription (Contract 4) against real PostgreSQL semantics (PGlite) with the actual 0022 migration: the
// original document, the machine extraction and the human-reviewed transcript are separate rows; revisions are
// contiguous, immutable and concurrency-checked; evidence publication is a separate, once-only act on the head
// reviewed revision; and every write commits only together with its mandatory audit record.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG = '11111111-1111-4111-8111-111111111111';
const DOC = '00000000-0000-4000-8000-000000000001';
const ENGINEER = 'engineer-1';
const REVIEWER = 'reviewer-1';
const CASE = '00000000-0000-4000-8000-0000000000c1';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: (_t, p) => (state.db as Record<PropertyKey, unknown>)?.[p] }) }));

const { createDocumentDatabase, resetDocumentDatabase } = await import('@/lib/documents/test-support/pglite-document-database');
const transcripts = await import('@/lib/documents/transcripts');
const { recordMachineExtraction, saveHumanRevision, publishTranscriptAsEvidence, readTranscript, sha256Text } = transcripts;

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
const tx = <T>(work: (t: never) => Promise<T>) => (state.db as ReturnType<typeof drizzle>).transaction((t) => work(t as never));
const sha = (value: string) => sha256Text(value);
const failAudit = async (action: string) => { await q('INSERT INTO audit_fault_actions(action) VALUES ($1)', [action]); };
const audits = async () => (await q('SELECT action FROM audit_security.audit_logs')).rows.map((r) => (r as { action: string }).action).sort();
const revisions = async () => (await q('SELECT revision_no, state, authored_by, reviewed_by FROM document_transcript_revisions ORDER BY revision_no')).rows as Array<{ revision_no: number; state: string; authored_by: string; reviewed_by: string | null }>;

async function seed(versions = 1) {
  await q(`INSERT INTO documents (id, organization_id, title, name, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status)
           VALUES ($1, $2, 'T', 'T', 'f.pdf', 'https://x', 'pdf', 'application/pdf', 'team_confidential', $3, 'active')`, [DOC, ORG, ENGINEER]);
  for (let n = 1; n <= versions; n += 1) {
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`, [ORG, DOC, n, `documents/${ORG}/v${n}`, sha(`v${n}`), ENGINEER]);
  }
}

const extract = (text = 'machine text', over: Record<string, unknown> = {}) =>
  tx((t) => recordMachineExtraction(t, { organizationId: ORG, userId: ENGINEER, documentId: DOC, classification: 'team_confidential', text, engine: 'tesseract', engineVersion: '5', language: 'en', confidence: 0.91, ...over }));
const revise = (expectedRevisionNo: number, text: string, review: boolean, userId = REVIEWER, over: Record<string, unknown> = {}) =>
  tx((t) => saveHumanRevision(t, { organizationId: ORG, userId, documentId: DOC, classification: 'team_confidential', expectedRevisionNo, text, review, ...over }));
const publish = (revisionNo: number, userId = REVIEWER) =>
  tx((t) => publishTranscriptAsEvidence(t, { organizationId: ORG, userId, documentId: DOC, linkedCaseId: CASE, revisionNo, purpose: 'hearing exhibit' }));

beforeAll(async () => { pg = await createDocumentDatabase(); state.db = drizzle(pg); });
afterAll(async () => { await pg.close(); });
beforeEach(async () => { await resetDocumentDatabase(pg); await seed(); });

describe('machine extraction', () => {
  it('is recorded as revision 1 beside the immutable original, with provenance and audit', async () => {
    const result = await extract();
    expect(result).toMatchObject({ ok: true, created: true });
    const [row] = (await q('SELECT * FROM document_transcript_revisions')).rows as Array<Record<string, unknown>>;
    expect(row).toMatchObject({ revision_no: 1, state: 'machine_extraction', engine: 'tesseract', engine_version: '5', classification: 'team_confidential', authored_by: ENGINEER, source_content_hash: sha('v1'), text_hash: sha('machine text') });
    expect(Number(row.confidence)).toBeCloseTo(0.91);
    expect(await audits()).toEqual(['document.ocr.extract']);
    // The original is untouched: still one version with its own hash.
    expect((await q('SELECT content_hash FROM document_versions')).rows).toEqual([{ content_hash: sha('v1') }]);
  });

  it('is idempotent per version: a second extraction returns the first and writes nothing', async () => {
    await extract('first');
    const again = await extract('second');
    expect(again).toMatchObject({ ok: true, created: false });
    expect(await revisions()).toHaveLength(1);
    expect(await audits()).toEqual(['document.ocr.extract']);
  });

  it('refuses text read from bytes that are not the version’s recorded content', async () => {
    const seen: Array<{ storageKey: string; contentHash: string }> = [];
    const result = await extract('x', { verifySource: async (v: { storageKey: string; contentHash: string }) => { seen.push(v); return false; } });
    expect(result).toMatchObject({ ok: false, kind: 'source_integrity' });
    expect(seen).toEqual([{ storageKey: `documents/${ORG}/v1`, contentHash: sha('v1') }]);
    expect(await revisions()).toHaveLength(0);
  });

  it('stores nothing when its mandatory audit cannot be written', async () => {
    await failAudit('document.ocr.extract');
    await expect(extract()).rejects.toThrow();
    expect(await revisions()).toHaveLength(0);
  });

  it('refuses oversized text and a document with no version', async () => {
    expect(await extract('x'.repeat(200_001))).toMatchObject({ ok: false, kind: 'too_large' });
    await q('DELETE FROM document_versions');
    expect(await extract()).toMatchObject({ ok: false, kind: 'no_version' });
  });
});

describe('human revisions', () => {
  beforeEach(async () => { await extract(); });

  it('appends contiguous draft and reviewed revisions with identity, base and audit', async () => {
    expect(await revise(1, 'draft text', false, ENGINEER)).toMatchObject({ ok: true, revision: { revisionNo: 2, state: 'human_draft', baseRevisionNo: 1 } });
    expect(await revise(2, 'reviewed text', true, REVIEWER)).toMatchObject({ ok: true, revision: { revisionNo: 3, state: 'human_reviewed', reviewedBy: REVIEWER } });
    expect((await revisions()).map((r) => [r.revision_no, r.state])).toEqual([[1, 'machine_extraction'], [2, 'human_draft'], [3, 'human_reviewed']]);
    expect(await audits()).toEqual(['document.ocr.extract', 'document.transcript.draft', 'document.transcript.review']);
  });

  it('refuses a stale write and reports the current head', async () => {
    await revise(1, 'first editor', false, ENGINEER);
    expect(await revise(1, 'second editor', false, REVIEWER)).toMatchObject({ ok: false, kind: 'stale', currentRevisionNo: 2 });
    expect(await revisions()).toHaveLength(2);
  });

  it('lets two concurrent writers from the same base produce exactly one new revision', async () => {
    const outcomes = await Promise.all([revise(1, 'a', false, ENGINEER), revise(1, 'b', false, REVIEWER)]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok)[0]).toMatchObject({ kind: 'stale' });
    expect(await revisions()).toHaveLength(2);
  });

  it('requires an independent reviewer: the author of a draft cannot review it', async () => {
    await revise(1, 'my draft', false, ENGINEER);
    expect(await revise(2, 'my draft reviewed', true, ENGINEER)).toMatchObject({ ok: false, kind: 'self_review' });
    expect((await revisions()).length).toBe(2);
  });

  it('refuses a write whose classification differs from the transcript’s', async () => {
    expect(await revise(1, 'text', false, REVIEWER, { classification: 'highly_sensitive' })).toMatchObject({ ok: false, kind: 'classification_changed' });
  });

  it('refuses empty text and writing before an extraction exists', async () => {
    expect(await revise(1, '', false)).toMatchObject({ ok: false, kind: 'invalid_text' });
    await resetDocumentDatabase(pg);
    await seed();
    expect(await revise(1, 'x', false)).toMatchObject({ ok: false, kind: 'no_extraction' });
  });

  it('commits no revision when its mandatory audit cannot be written', async () => {
    await failAudit('document.transcript.review');
    await expect(revise(1, 'reviewed', true)).rejects.toThrow();
    expect(await revisions()).toHaveLength(1);
  });

  it('keeps revisions immutable, linear and hash-bound in the database itself', async () => {
    await revise(1, 'draft', false, ENGINEER);
    const fails = async (statement: string, params: unknown[] = []) => { let failed = false; try { await q(statement, params); } catch { failed = true; } expect(failed, statement).toBe(true); };
    await fails(`UPDATE document_transcript_revisions SET text = 'rewritten', text_hash = $1 WHERE revision_no = 2`, [sha('rewritten')]);
    await fails('DELETE FROM document_transcript_revisions WHERE revision_no = 2');
    await fails(`UPDATE document_transcript_revisions SET authored_by = 'someone' WHERE revision_no = 1`);
    // A gap, a wrong hash and a second machine revision are all refused.
    const base = `INSERT INTO document_transcript_revisions (organization_id, document_id, version_id, revision_no, base_revision_no, state, text, text_hash, source_content_hash, classification, authored_by)
                  SELECT $1, $2, id, $3, $4, $5, 'x', $6, $7, 'team_confidential', 'u' FROM document_versions WHERE document_id = $2`;
    await fails(base, [ORG, DOC, 9, 2, 'human_draft', sha('x'), sha('v1')]);
    await fails(base, [ORG, DOC, 3, 2, 'human_draft', sha('not x'), sha('v1')]);
    await fails(base, [ORG, DOC, 3, 2, 'machine_extraction', sha('x'), sha('v1')]);
    expect(await revisions()).toHaveLength(2);
  });
});

describe('publication as evidence', () => {
  beforeEach(async () => { await extract(); });

  it('is refused for a machine extraction or an unreviewed draft', async () => {
    expect(await publish(1)).toMatchObject({ ok: false, kind: 'not_reviewed' });
    await revise(1, 'draft', false, ENGINEER);
    expect(await publish(2)).toMatchObject({ ok: false, kind: 'not_reviewed' });
    expect((await q('SELECT 1 FROM document_transcript_publications')).rows).toHaveLength(0);
  });

  it('publishes the head reviewed revision once, as a separate audited act', async () => {
    await revise(1, 'reviewed', true, REVIEWER);
    const first = await publish(2);
    expect(first).toMatchObject({ ok: true, publication: { revisionNo: 2, textHash: sha('reviewed'), linkedCaseId: CASE, publishedBy: REVIEWER } });
    expect(await publish(2)).toMatchObject({ ok: false, kind: 'already_published' });
    expect(await audits()).toContain('document.transcript.publish_as_evidence');
    expect((await q('SELECT 1 FROM document_transcript_publications')).rows).toHaveLength(1);
  });

  it('refuses a revision that is not the head, and a published revision is never rewritten', async () => {
    await revise(1, 'reviewed', true, REVIEWER);
    await revise(2, 'later draft', false, ENGINEER);
    expect(await publish(2)).toMatchObject({ ok: false, kind: 'stale', currentRevisionNo: 3 });
    const read = await tx((t) => readTranscript(t, { organizationId: ORG, documentId: DOC }));
    expect(read?.head.revisionNo).toBe(3);
    expect(read?.publishedAsEvidence).toBeNull();
  });

  it('is not recorded when its mandatory audit cannot be written', async () => {
    await revise(1, 'reviewed', true, REVIEWER);
    await failAudit('document.transcript.publish_as_evidence');
    await expect(publish(2)).rejects.toThrow();
    expect((await q('SELECT 1 FROM document_transcript_publications')).rows).toHaveLength(0);
  });

  it('is append-only in the database', async () => {
    await revise(1, 'reviewed', true, REVIEWER);
    await publish(2);
    for (const statement of ['DELETE FROM document_transcript_publications', `UPDATE document_transcript_publications SET purpose = 'changed'`]) {
      let failed = false;
      try { await q(statement); } catch { failed = true; }
      expect(failed, statement).toBe(true);
    }
  });
});

describe('reading', () => {
  it('returns the head text and a history without text, and whether the head is published', async () => {
    await extract();
    await revise(1, 'reviewed', true, REVIEWER);
    await publish(2);
    const read = await tx((t) => readTranscript(t, { organizationId: ORG, documentId: DOC }));
    expect(read?.head).toMatchObject({ revisionNo: 2, text: 'reviewed' });
    expect(read?.history.map((h) => h.revisionNo)).toEqual([2, 1]);
    expect(read?.history.every((h) => !('text' in h))).toBe(true);
    expect(read?.publishedAsEvidence).not.toBeNull();
  });

  it('is scoped to the latest version: a new version starts without a transcript', async () => {
    await extract();
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES (gen_random_uuid(), $1, $2, 2, $3, $4, $5)`, [ORG, DOC, `documents/${ORG}/v2`, sha('v2'), ENGINEER]);
    expect(await tx((t) => readTranscript(t, { organizationId: ORG, documentId: DOC }))).toBeNull();
    expect(await extract('second version text')).toMatchObject({ ok: true, created: true });
  });
});
