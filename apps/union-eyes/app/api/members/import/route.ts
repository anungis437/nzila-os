/**
 * Member Import
 *
 * POST /api/members/import
 *
 * Accepts a CSV file via multipart/form-data and enqueues a background import job.
 * Returns a job reference so the UI can poll for progress.
 *
 * Synchronous processing is used here (parse + insert) for simplicity.
 * A job ID is generated so the response shape is compatible with async expectations.
 *
 * An import never creates a person. Each row's email must resolve to exactly one identity in the directory; a row with no identity,
 * with more than one, or repeating an earlier row's email is not imported and is reported by its CSV line number. If the directory
 * cannot be asked, the whole import fails before anything is written (it used to mint a random user id, which made a second,
 * unreachable membership for the same person on every re-import).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { organizationMembers } from '@/db/schema-organizations';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { adminClient } from '@nzila/platform-auth/entra/server';

export const dynamic = 'force-dynamic';

/**
 * Minimal CSV parser — handles quoted fields and basic rows.
 */
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Members'], summary: 'Import members from CSV file' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw ApiError.badRequest('No file provided');

    let csvText: string;
    try {
      csvText = await file.text();
    } catch {
      throw ApiError.badRequest('Could not read file');
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return { job: { id: crypto.randomUUID() }, processed: 0, skipped: 0, unresolved: [] };
    }

    const jobId = crypto.randomUUID();
    let skipped = 0;

    type Unresolved = { row: number; reason: 'NO_DIRECTORY_IDENTITY' | 'AMBIGUOUS_DIRECTORY_IDENTITY' | 'DUPLICATE_IN_FILE' };
    const unresolved: Unresolved[] = [];
    const seenEmails = new Set<string>();
    const candidates: Array<{ userId: string; name: string; email: string }> = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2; // the header is line 1
      const email = (row['email'] ?? row['Email'] ?? '').trim();
      const name  = (row['name']  ?? row['Name']  ?? row['full_name'] ?? '').trim();
      const role  = (row['role']  ?? row['Role']  ?? 'member').trim().toLowerCase();

      if (!email) { skipped++; continue; }
      // An import is not a way to grant authority: only plain membership can be imported.
      if (role !== 'member') { skipped++; continue; }

      const key = email.toLowerCase();
      if (seenEmails.has(key)) { unresolved.push({ row: line, reason: 'DUPLICATE_IN_FILE' }); continue; }
      seenEmails.add(key);

      let matches: Array<{ id: string }>;
      try {
        matches = (await adminClient.users.getUserList({ emailAddress: [email] })).data;
      } catch (error) {
        logger.warn('Member import stopped: directory lookup failed', { jobId, organizationId, line, error: error instanceof Error ? error.message : String(error) });
        throw ApiError.externalService('Directory', 'member identities could not be resolved; nothing was imported');
      }
      if (matches.length === 0) { unresolved.push({ row: line, reason: 'NO_DIRECTORY_IDENTITY' }); continue; }
      if (matches.length > 1) { unresolved.push({ row: line, reason: 'AMBIGUOUS_DIRECTORY_IDENTITY' }); continue; }
      candidates.push({ userId: matches[0].id, name: name || email, email });
    }
    skipped += unresolved.length;

    // The memberships and the audit record commit together; a failed audit leaves no imported members.
    const processed = await withRLSContext({ organizationId }, async (tx) => {
      let inserted = 0;
      for (const candidate of candidates) {
        const created = await tx
          .insert(organizationMembers)
          .values({
            organizationId,
            userId: candidate.userId,
            name: candidate.name,
            email: candidate.email,
            role: 'member',
            status: 'active',
          })
          .onConflictDoNothing()
          .returning({ id: organizationMembers.id });
        if (created.length > 0) inserted++;
      }
      if (inserted > 0) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'member.import',
          resourceType: 'organization_members',
          resourceId: jobId,
          details: { jobId, imported: inserted, rows: rows.length },
        });
      }
      return inserted;
    });
    skipped += candidates.length - processed;

    logger.info('Members imported', { jobId, processed, skipped, unresolved: unresolved.length, organizationId });

    return { job: { id: jobId }, processed, skipped, unresolved };
  },
);

