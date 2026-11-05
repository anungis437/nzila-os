import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectUseServerDirective, expiredExceptions, legacyDetectorSaysServerAction, orgScopingViolations } from '../src/platform-repro/server-action-detector.ts';
import { authorizedDocumentSearch, legacyMatchThenFilterSearch } from '../src/platform-repro/search-authorization.ts';
import {
  LEGACY_UPLOAD_URL_TTL_SECONDS,
  buildOpaqueObjectKey,
  disallowedMetadataKeys,
  findCanaryLeaks,
  isBareStorageUrl,
  legacyObjectKey,
  legacyUploadSequence,
  mintDownloadUrl,
  uploadWithCompensation,
  validateSignedUrlTtl,
} from '../src/platform-repro/storage-policy.ts';
import type { Decision } from '../src/authorization.ts';

/**
 * Platform defects are routed to the platform owner. These tests do three things only:
 *  1. confirm, from the PINNED commit's blobs, that the cited source behaviour exists;
 *  2. show a synthetic reproduction of the failure;
 *  3. show that the reference contract behaves as the proposed test would require.
 * Passing here does NOT mean the platform is fixed; it means the finding is reproducible and the proposed assertion is satisfiable.
 */
const PINNED_SHA = '38a824918cf2e7d7cfb7fcb0e796cbde45433be8';
const repoRoot = join(import.meta.dirname, '..', '..', '..');
const pinned = (path: string): string => execFileSync('git', ['show', `${PINNED_SHA}:${path}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const pinnedList = (dir: string): string[] =>
  execFileSync('git', ['ls-tree', '--name-only', PINNED_SHA, `${dir}/`], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);

const allow: Decision = { allow: true, basis: 't' };
const deny: Decision = { allow: false, publicOutcome: 'NOT_FOUND', reason: 'r' };

describe('server-action org-scope detector (WA-R3-001, WA-R3-019)', () => {
  const DETECTOR = 'tooling/contract-tests/server-action-org-scoping.test.ts';

  it('[WA-T081] source at the pinned SHA only recognizes the single-quoted directive', () => {
    assert.match(pinned(DETECTOR), /if \(!content\.includes\("'use server'"\)\) continue/);
  });

  it('[WA-T081] a double-quoted action without resolveOrgContext is invisible to the legacy detector and caught by the reference detector', () => {
    const file = { path: 'apps/union-eyes/actions/synthetic-actions.ts', content: '"use server";\nimport { db } from "@/db";\nexport async function exportAll(organizationId: string) { return db; }\n' };
    assert.equal(legacyDetectorSaysServerAction(file.content), false);
    assert.equal(detectUseServerDirective(file.content).isServerAction, true);
    assert.deepEqual(orgScopingViolations([file], [], '2026-10-23', legacyDetectorSaysServerAction), []);
    assert.deepEqual(orgScopingViolations([file], [], '2026-10-23', (c) => detectUseServerDirective(c).isServerAction), [{ path: file.path, reason: 'MISSING_RESOLVE_ORG_CONTEXT' }]);
  });

  it('[WA-T081] reference detector handles BOM, comments, stacked directives, inline directives and ignores look-alikes', () => {
    assert.deepEqual(detectUseServerDirective("\uFEFF// header\n/* block */\n'use strict';\n'use server';\nexport const a = 1;"), { isServerAction: true, scope: 'FILE', quote: 'single' });
    assert.equal(detectUseServerDirective('"use server"\nexport const a = 1;').quote, 'double');
    assert.deepEqual(detectUseServerDirective("export async function act() {\n  'use server';\n  return 1;\n}"), { isServerAction: true, scope: 'INLINE', quote: 'single' });
    assert.equal(detectUseServerDirective("const s = 'use server';\nexport const a = s;").isServerAction, false);
    assert.equal(detectUseServerDirective("// 'use server' is mentioned in a comment\nexport const a = 1;").isServerAction, false);
    assert.equal(detectUseServerDirective('import x from "y";\n"use server";').isServerAction, false, 'a directive after code is not a prologue directive');
  });

  it('[WA-T081] measured at the pinned SHA: the legacy detector sees fewer UE action files than the reference detector', () => {
    const files = pinnedList('apps/union-eyes/actions').filter((p) => p.endsWith('-actions.ts'));
    const contents = files.map((p) => ({ path: p, content: pinned(p) }));
    const legacy = contents.filter((f) => legacyDetectorSaysServerAction(f.content)).length;
    const reference = contents.filter((f) => detectUseServerDirective(f.content).isServerAction).length;
    assert.ok(files.length > 0);
    assert.ok(reference > legacy, `reference=${reference} legacy=${legacy} of ${files.length}`);
  });

  it('[WA-T094] exception entries are failed once their expiry passes', () => {
    const ledger = JSON.parse(pinned('governance/exceptions/org-required-server-actions.json')) as { entries: { path: string; expires?: string; expiresOn?: string; expiry?: string }[] };
    const entries = ledger.entries.map((e) => ({ path: e.path, expires: (e.expires ?? e.expiresOn ?? e.expiry) as string })).filter((e) => !!e.expires);
    assert.ok(entries.length > 0, 'ledger has dated entries');
    assert.equal(expiredExceptions(entries, '2026-10-23').length, 0);
    assert.ok(expiredExceptions(entries, '2026-12-01').length > 0, 'at least one exception lapses after 2026-11-17');
  });
});

describe('universal search authorizes before matching (WA-R3-005, WA-R3-013)', () => {
  const docs = [
    { id: 'd1', title: 'Weekly schedule' },
    { id: 'd2', title: 'SYNTH-CANARY psychiatric assessment' },
    { id: 'd3', title: 'SYNTH-CANARY psychiatric note (unlinked)' },
  ];
  const authorize = (d: { id: string }) => (d.id === 'd1' ? allow : deny);

  it('[WA-T090] reference search never evaluates restricted titles for an unauthorized caller', () => {
    const matched: string[] = [];
    const result = authorizedDocumentSearch({
      query: 'psychiatric',
      candidates: docs,
      authorize,
      match: (t, q) => {
        matched.push(t);
        return t.includes(q);
      },
    });
    assert.deepEqual(result.hits, []);
    assert.deepEqual(matched, ['Weekly schedule'], 'only the authorized title was ever compared');
  });

  it('[WA-T090] legacy ordering (match, then filter) touches restricted titles before authorization', () => {
    const r = legacyMatchThenFilterSearch({ query: 'psychiatric', candidates: docs, authorize, match: (t, q) => t.includes(q) });
    assert.deepEqual(r.hits, []);
    assert.equal(r.matchedBeforeAuthorization, 2, 'two restricted titles were scored before being filtered');
  });

  it('[WA-T090] source at the pinned SHA queries by title before applying the visibility policy', () => {
    const src = pinned('apps/union-eyes/app/api/search/universal/route.ts');
    assert.match(src, /ilike\(documents\.title/);
    assert.match(src, /isDocumentVisibleByPolicy/);
    assert.ok(src.indexOf('ilike(documents.title') < src.indexOf('isDocumentVisibleByPolicy('), 'title match precedes policy filter in source order');
  });
});

describe('document storage (WA-R3-006, WA-R3-012, WA-INT-001..003)', () => {
  const STORAGE = 'apps/union-eyes/lib/services/document-storage-service.ts';
  const CANARIES = ['SYNTH-CANARY', 'psychiatric'];

  it('[WA-T082] source at the pinned SHA signs S3/R2 URLs for one year', () => {
    assert.match(pinned(STORAGE), /expiresIn: 365 \* 24 \* 60 \* 60/);
  });

  it('[WA-T082] a one-year TTL is beyond both policy and the S3 SigV4 maximum; reference policy is <= 60 minutes', () => {
    assert.deepEqual(validateSignedUrlTtl(LEGACY_UPLOAD_URL_TTL_SECONDS), { ok: false, reason: 'EXCEEDS_BACKEND_MAXIMUM' });
    assert.deepEqual(validateSignedUrlTtl(7 * 24 * 3600), { ok: false, reason: 'EXCEEDS_POLICY' });
    assert.deepEqual(validateSignedUrlTtl(3600), { ok: true });
    assert.deepEqual(validateSignedUrlTtl(0), { ok: false, reason: 'NOT_POSITIVE' });
  });

  it('[WA-T082] a download URL is minted only after a fresh allow; a revoked grant yields no URL', () => {
    const sign = (ttl: number) => `https://storage.invalid/o?ttl=${ttl}&X-Amz-Signature=x`;
    assert.equal(mintDownloadUrl({ authorization: deny, ttlSeconds: 300, sign }).ok, false);
    assert.equal(mintDownloadUrl({ authorization: allow, ttlSeconds: LEGACY_UPLOAD_URL_TTL_SECONDS, sign }).ok, false);
    const ok = mintDownloadUrl({ authorization: allow, ttlSeconds: 300, sign });
    assert.equal(ok.ok, true);
  });

  it('[WA-INT-001] source builds the object key from the human document name and logs it', () => {
    const src = pinned(STORAGE);
    assert.match(src, /const key = `organization\/\$\{doc\.organizationId\}\/\$\{timestamp\}-\$\{randomBytes\}-\$\{doc\.documentName\}`/);
    assert.match(src, /logger\.error\("Failed to upload document", \{[\s\S]*documentName: doc\.documentName/);
  });

  it('[WA-INT-001][WA-T097] a clinical-name canary appears in the legacy key, metadata and log context but not in the opaque design', () => {
    const name = 'SYNTH-CANARY psychiatric assessment.pdf';
    const legacyKey = legacyObjectKey('ORG-UNION-A', 1_700_000_000_000, 'a1b2c3d4', name);
    const legacyMetadata = { organizationId: 'ORG-UNION-A', documentName: name, documentType: 'MEDICAL' };
    const legacyLog = { organizationId: 'ORG-UNION-A', documentName: name };
    const legacyLeaks = findCanaryLeaks({ key: legacyKey, metadata: legacyMetadata, errorLog: legacyLog }, CANARIES).map((l) => l.surface);
    assert.deepEqual([...new Set(legacyLeaks)].sort(), ['errorLog', 'key', 'metadata']);

    const opaqueKey = buildOpaqueObjectKey('ORG-UNION-A', '0123456789abcdef0123456789abcdef');
    const opaqueMetadata = { organizationId: 'ORG-UNION-A', opaqueDocumentId: 'doc_7f3a', uploadedAt: '2026-10-23T14:00:00Z' };
    assert.deepEqual(findCanaryLeaks({ key: opaqueKey, metadata: opaqueMetadata }, CANARIES), []);
    assert.deepEqual(disallowedMetadataKeys(legacyMetadata), ['documentName', 'documentType']);
    assert.deepEqual(disallowedMetadataKeys(opaqueMetadata), []);
    assert.throws(() => buildOpaqueObjectKey('ORG', '../../etc/passwd'));
  });

  it('[WA-INT-002] source says "SAS URL valid for 1 year" but returns a bare container URL with no signature', () => {
    const src = pinned(STORAGE);
    const azure = src.slice(src.indexOf('Generate read-only SAS URL valid for 1 year'), src.indexOf('Upload to S3 or Cloudflare R2'));
    assert.match(azure, /const url = `\$\{blobServiceClient\.url\}\$\{this\.bucket\}\/\$\{key\}`/);
    assert.doesNotMatch(azure, /generateBlobSASQueryParameters|generateSasUrl|sasToken|sig=/);
    assert.equal(isBareStorageUrl('https://account.blob.core.windows.net/container/organization/ORG/abc'), true);
    assert.equal(isBareStorageUrl('https://account.blob.core.windows.net/container/o?sv=2024&se=2026-10-23T15%3A00%3A00Z&sig=abc'), false);
    assert.equal(isBareStorageUrl('https://s3.invalid/b/k?X-Amz-Signature=abc&X-Amz-Expires=300'), false);
  });

  it('[WA-INT-003] source puts the object before it signs, inside one try that rethrows', () => {
    const src = pinned(STORAGE);
    const s3 = src.slice(src.indexOf('Upload to S3 or Cloudflare R2'), src.indexOf('Download document from storage'));
    assert.ok(s3.indexOf('await this.s3Client!.send(command)') < s3.indexOf('await getSignedUrl('));
    assert.match(s3, /catch \(error\) \{[\s\S]*throw error;/);
    assert.doesNotMatch(s3, /DeleteObjectCommand|deleteObject|\.delete\(/);
  });

  it('[WA-INT-003] reproduction: a signing failure after put leaves an orphan; the compensating sequence cleans up or records it', async () => {
    const stored = new Set<string>();
    const adapters = {
      put: async (k: string) => void stored.add(k),
      remove: async (k: string) => void stored.delete(k),
      sign: async (): Promise<string> => {
        throw new Error('signing failed: expiry exceeds backend maximum');
      },
    };
    await assert.rejects(legacyUploadSequence(adapters, 'k1'), /signing failed/);
    assert.deepEqual([...stored], ['k1'], 'legacy sequence returns an error while the object remains stored and untracked');

    stored.clear();
    const cleaned = await uploadWithCompensation(adapters, 'k2', async () => void (await adapters.sign()));
    assert.equal(cleaned.status, 'FAILED_CLEANED_UP');
    assert.deepEqual([...stored], []);

    const cannotRemove = { ...adapters, remove: async () => { throw new Error('delete failed'); } };
    const orphan = await uploadWithCompensation(cannotRemove, 'k3', async () => void (await adapters.sign()));
    assert.deepEqual(orphan, { status: 'FAILED_ORPHAN_RECORDED', reason: 'signing failed: expiry exceeds backend maximum', orphanKey: 'k3' });

    const ok = await uploadWithCompensation(adapters, 'k4', async () => {});
    assert.equal(ok.status, 'OK');
  });
});

describe('revocation source gap (WA-R3-008, WA-R3-015)', () => {
  it('[WA-T084] revokeRepresentationAuthority at the pinned SHA updates the authority and audits, with no grant or session handling', () => {
    const src = pinned('apps/union-eyes/lib/services/representation-authority-service.ts');
    const start = src.indexOf('export async function revokeRepresentationAuthority');
    const end = src.indexOf('export async function auditRepresentationAuthorityEvent');
    const body = src.slice(start, end);
    assert.match(body, /\.update\(representationAuthorities\)/);
    assert.doesNotMatch(body, /externalMatterAccessGrants|externalDocumentAccessGrants|revokeSession|revokeAllUserSessions/);
  });
});

describe('grievance deadline engine is not reused for WSIB (WA-R3-023)', () => {
  it('[WA-T086] the resolver at the pinned SHA throws for claim_deadlines and resolves grievance recipients only', () => {
    const src = pinned('apps/union-eyes/lib/deadline-engine/recipient-resolver.ts');
    assert.match(src, /if \(input\.sourceTable !== 'grievance_deadlines'\)/);
    assert.match(src, /not yet supported \(Phase A grievance-only\)/);
    assert.match(src, /from '@\/db\/schema\/domains\/claims\/grievances'/);
  });

  it('[WA-T086] no WorkAid preparation source imports the deadline engine, its resolver, scheduler or tables', () => {
    const srcDir = join(import.meta.dirname, '..', 'src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name)));
    };
    walk(srcDir);
    assert.ok(files.length > 10);
    for (const f of files) {
      const imports = readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
      for (const line of imports) assert.doesNotMatch(line, /deadline-engine|deadline_reminders|grievance_deadlines|recipient-resolver|@\/db|apps\/union-eyes/, `${f}: ${line}`);
    }
  });
});
