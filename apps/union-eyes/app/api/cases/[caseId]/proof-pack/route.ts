/**
 * GET /api/cases/[caseId]/proof-pack
 *
 * Streams a downloadable ZIP containing the evidence trail for a single
 * case. Composed from three sources:
 *
 *   1. The case row itself (via getDemoCaseFromDb)
 *   2. All decision proof-packs (artifacts/runtime/<profile>-demo/governance/*.json
 *      whose metadata.linkedCase.id matches the requested caseId)
 *   3. A manifest summarising what's inside + SHA-256 hashes per entry
 *
 * This consumes the per-decision JSON artifacts that Gap 3 emits, so
 * "Log decision" → "Download evidence" forms a closed loop from action
 * to portable proof bundle.
 */

import { NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';

import { getDemoCaseFromDb } from '@/lib/demo/server/cupe4373-cases-repo';
import { listDecisionsForCase } from '@/lib/demo/server/cupe4373-governance';
import { auth } from '@nzila/platform-auth/entra/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FOUNDATION_PROFILE = process.env.NZILA_FOUNDATION_PROFILE ?? 'cupe4373';

type ManifestEntry = {
  path: string;
  bytes: number;
  sha256: string;
  source: 'database' | 'artifact' | 'manifest';
};

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function loadDecisionArtifacts(caseId: string): Promise<Array<{ name: string; body: Buffer }>> {
  const dir = resolve(process.cwd(), 'artifacts', 'runtime', `${FOUNDATION_PROFILE}-demo`, 'governance');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out: Array<{ name: string; body: Buffer }> = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const full = join(dir, entry);
    try {
      const s = await stat(full);
      if (!s.isFile()) continue;
      const buf = await readFile(full);
      const parsed = JSON.parse(buf.toString('utf-8')) as {
        linkedCase?: { id?: string };
      };
      if (parsed.linkedCase?.id !== caseId) continue;
      out.push({ name: `governance/${entry}`, body: buf });
    } catch {
      // skip malformed files
    }
  }
  return out;
}

function archiveToBuffer(archive: archiver.Archiver): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', message: 'Sign-in required.' },
      { status: 401 },
    );
  }

  const { caseId } = await params;
  const demoCase = await getDemoCaseFromDb(caseId);
  if (!demoCase) {
    return NextResponse.json({ error: 'CASE_NOT_FOUND' }, { status: 404 });
  }

  const liveDecisions = await listDecisionsForCase(caseId);
  const decisionArtifacts = await loadDecisionArtifacts(caseId);

  const caseJson = JSON.stringify(demoCase, null, 2);
  const decisionsJson = JSON.stringify(liveDecisions, null, 2);

  const entries: Array<{ name: string; body: Buffer; source: ManifestEntry['source'] }> = [
    { name: 'case.json', body: Buffer.from(caseJson, 'utf-8'), source: 'database' },
    { name: 'decisions.json', body: Buffer.from(decisionsJson, 'utf-8'), source: 'database' },
    ...decisionArtifacts.map((e) => ({ name: e.name, body: e.body, source: 'artifact' as const })),
  ];

  const manifest = {
    schemaVersion: 1,
    profile: FOUNDATION_PROFILE,
    caseId,
    generatedAt: new Date().toISOString(),
    counts: {
      decisionsFromDb: liveDecisions.length,
      decisionArtifactFiles: decisionArtifacts.length,
    },
    entries: entries.map<ManifestEntry>((e) => ({
      path: e.name,
      bytes: e.body.byteLength,
      sha256: sha256(e.body),
      source: e.source,
    })),
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');

  const archive = archiver('zip', { zlib: { level: 9 } });
  const bufferPromise = archiveToBuffer(archive);
  archive.append(manifestBuf, { name: 'manifest.json' });
  for (const entry of entries) {
    archive.append(entry.body, { name: entry.name });
  }
  await archive.finalize();
  const zip = await bufferPromise;

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${caseId}-proof-pack.zip"`,
      'Content-Length': String(zip.byteLength),
      'Cache-Control': 'no-store',
      'X-Proof-Pack-Manifest-Sha256': sha256(manifestBuf),
    },
  });
}
