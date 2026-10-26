/**
 * Informational tripwire: for each platform defect routed to Codex, report
 * whether the cited pattern is still PRESENT in the files of the CURRENT working
 * tree (run it from a checkout of the platform branch, with --root pointing at it).
 * It never fails the build and changes nothing. ABSENT means "the cited pattern
 * is gone", which is a prompt to re-run the real tests, not proof of a fix.
 *
 *   node scripts/platform-tripwire.ts --root C:\path\to\platform\checkout
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootIdx = process.argv.indexOf('--root');
const root = resolve(rootIdx > -1 ? process.argv[rootIdx + 1]! : join(import.meta.dirname, '..', '..', '..'));

interface Probe {
  readonly finding: string;
  readonly file: string;
  readonly pattern: RegExp;
  readonly describes: string;
}

const probes: Probe[] = [
  { finding: 'WA-R3-001', file: 'tooling/contract-tests/server-action-org-scoping.test.ts', pattern: /content\.includes\("'use server'"\)/, describes: 'detector recognizes only the single-quoted directive' },
  { finding: 'WA-R3-006', file: 'apps/union-eyes/lib/services/document-storage-service.ts', pattern: /expiresIn:\s*365\s*\*\s*24\s*\*\s*60\s*\*\s*60/, describes: 'one-year presigned URL' },
  { finding: 'WA-INT-001', file: 'apps/union-eyes/lib/services/document-storage-service.ts', pattern: /\$\{timestamp\}-\$\{randomBytes\}-\$\{doc\.documentName\}/, describes: 'object key embeds the human document name' },
  { finding: 'WA-R3-012', file: 'apps/union-eyes/lib/services/document-storage-service.ts', pattern: /Metadata:\s*\{[\s\S]{0,200}documentName:\s*doc\.documentName/, describes: 'S3/R2 metadata carries documentName' },
  { finding: 'WA-INT-002', file: 'apps/union-eyes/lib/services/document-storage-service.ts', pattern: /Generate read-only SAS URL valid for 1 year/, describes: 'comment claims a SAS URL where an unsigned URL is returned' },
  { finding: 'WA-R3-005', file: 'apps/union-eyes/app/api/search/universal/route.ts', pattern: /ilike\(documents\.title/, describes: 'documents matched by title in the query' },
  { finding: 'WA-R3-008', file: 'apps/union-eyes/lib/services/representation-authority-service.ts', pattern: /export async function revokeRepresentationAuthority[\s\S]*?\.update\(representationAuthorities\)/, describes: 'revocation updates the authority row' },
  { finding: 'WA-R3-023', file: 'apps/union-eyes/lib/deadline-engine/recipient-resolver.ts', pattern: /not yet supported \(Phase A grievance-only\)/, describes: 'resolver is grievance-only (expected to remain; WorkAid must not reuse it)' },
  { finding: 'WA-R3-004', file: 'apps/union-eyes/app/api/external/documents/[id]/route.ts', pattern: /matterType !== 'grievance'/, describes: 'external routes reject every matter type except grievance' },
];

const out = probes.map((p) => {
  const path = join(root, p.file);
  if (!existsSync(path)) return { finding: p.finding, status: 'FILE_MISSING', describes: p.describes, file: p.file };
  return { finding: p.finding, status: p.pattern.test(readFileSync(path, 'utf8')) ? 'PRESENT' : 'ABSENT', describes: p.describes, file: p.file };
});
for (const r of out) console.log(`${r.status.padEnd(12)} ${r.finding.padEnd(11)} ${r.describes}  [${r.file}]`);
