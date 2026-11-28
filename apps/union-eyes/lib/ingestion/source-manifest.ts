/**
 * The tenant-bound expected source manifest (MIG-07).
 *
 * Before (or alongside) an import, the organization declares what the source holds: its case ids and how many documents.
 * The declaration is immutable and identified by its digest, so the same declaration is the same manifest. Verification
 * reconciles a batch against it; a batch without one cannot pass. Runs on the ambient tenant transaction, like the import.
 */
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { canonicalImportJson } from './validation-pipeline';

export interface SourceManifestDeclaration {
  organizationId: string;
  sourceSystem: string;
  caseIds: string[];
  expectedDocumentCount: number;
  declaredBy: string;
}

export function sourceManifestDigest(input: Pick<SourceManifestDeclaration, 'sourceSystem' | 'caseIds' | 'expectedDocumentCount'>): string {
  return createHash('sha256').update(canonicalImportJson({
    source: input.sourceSystem,
    cases: [...input.caseIds].sort(),
    documents: input.expectedDocumentCount,
  })).digest('hex');
}

export async function declareSourceManifest(input: SourceManifestDeclaration): Promise<{ manifestId: string; digest: string }> {
  const ids = input.caseIds.map((id) => id.trim());
  if (!input.sourceSystem.trim()) throw new Error('SOURCE_MANIFEST_SOURCE_REQUIRED');
  if (ids.some((id) => !id)) throw new Error('SOURCE_MANIFEST_BLANK_CASE_ID');
  if (new Set(ids).size !== ids.length) throw new Error('SOURCE_MANIFEST_DUPLICATE_CASE_ID');
  if (!Number.isInteger(input.expectedDocumentCount) || input.expectedDocumentCount < 0) throw new Error('SOURCE_MANIFEST_DOCUMENT_COUNT_INVALID');
  const sorted = [...ids].sort();
  const digest = sourceManifestDigest({ ...input, caseIds: sorted });
  const inserted = (await db.execute(sql`
    INSERT INTO ue_ingestion_source_manifests
      (organization_id, source_system, manifest_digest, expected_case_ids, expected_case_count, expected_document_count, declared_by)
    VALUES (${input.organizationId}::uuid, ${input.sourceSystem}, ${digest}, ${JSON.stringify(sorted)}::jsonb, ${sorted.length},
      ${input.expectedDocumentCount}, ${input.declaredBy})
    ON CONFLICT (organization_id, source_system, manifest_digest) DO NOTHING
    RETURNING id::text
  `)) as unknown as Array<{ id: string }>;
  if (inserted[0]) return { manifestId: inserted[0].id, digest };
  const [existing] = (await db.execute(sql`
    SELECT id::text FROM ue_ingestion_source_manifests
    WHERE organization_id = ${input.organizationId}::uuid AND source_system = ${input.sourceSystem} AND manifest_digest = ${digest}
  `)) as unknown as Array<{ id: string }>;
  if (!existing) throw new Error('SOURCE_MANIFEST_NOT_RECORDED');
  return { manifestId: existing.id, digest };
}
