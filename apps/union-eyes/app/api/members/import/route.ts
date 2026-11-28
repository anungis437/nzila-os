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
 *
 * A row may also carry the member's stable id in an external system of record (CSV column `external_member_id`), named by the form field
 * `source_system`. The membership is then reconciled against the bindings already held (lib/membership/import-memberships.ts): an id bound to
 * another member, or a member bound to another id, is reported and not imported; nothing is matched on a name or an email, merged or deleted.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { importMemberships, MembershipImportConflictError, type MembershipImportCandidate } from '@/lib/membership/import-memberships';
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
    const sourceField = formData.get('source_system');
    const sourceSystem = typeof sourceField === 'string' ? sourceField.trim() : '';
    if (sourceSystem.length > 100) throw ApiError.badRequest('source_system is longer than 100 characters');

    let csvText: string;
    try {
      csvText = await file.text();
    } catch {
      throw ApiError.badRequest('Could not read file');
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return { job: { id: crypto.randomUUID() }, processed: 0, bound: 0, skipped: 0, unresolved: [] };
    }

    const jobId = crypto.randomUUID();
    let skipped = 0;

    type Unresolved = {
      row: number;
      reason: 'NO_DIRECTORY_IDENTITY' | 'AMBIGUOUS_DIRECTORY_IDENTITY' | 'DUPLICATE_IN_FILE' | 'DUPLICATE_EXTERNAL_ID_IN_FILE'
        | 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER' | 'MEMBER_BOUND_TO_OTHER_EXTERNAL_ID';
    };
    const unresolved: Unresolved[] = [];
    const seenEmails = new Set<string>();
    const seenExternalIds = new Set<string>();
    const candidates: MembershipImportCandidate[] = [];

    const externalOf = (row: Record<string, string>) => (row['external_member_id'] ?? row['External Member ID'] ?? '').trim();
    if (rows.some((row) => externalOf(row)) && !sourceSystem) {
      throw ApiError.badRequest('Rows carry external_member_id but no source_system names the system they come from');
    }
    if (rows.some((row) => externalOf(row).length > 255)) throw ApiError.badRequest('An external_member_id is longer than 255 characters');

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
      const externalId = externalOf(row);
      if (externalId) {
        if (seenExternalIds.has(externalId)) { unresolved.push({ row: line, reason: 'DUPLICATE_EXTERNAL_ID_IN_FILE' }); continue; }
        seenExternalIds.add(externalId);
      }

      let matches: Array<{ id: string }>;
      try {
        matches = (await adminClient.users.getUserList({ emailAddress: [email] })).data;
      } catch (error) {
        logger.warn('Member import stopped: directory lookup failed', { jobId, organizationId, line, error: error instanceof Error ? error.message : String(error) });
        throw ApiError.externalService('Directory', 'member identities could not be resolved; nothing was imported');
      }
      if (matches.length === 0) { unresolved.push({ row: line, reason: 'NO_DIRECTORY_IDENTITY' }); continue; }
      if (matches.length > 1) { unresolved.push({ row: line, reason: 'AMBIGUOUS_DIRECTORY_IDENTITY' }); continue; }
      candidates.push({
        line,
        userId: matches[0].id,
        name: name || email,
        email,
        ...(externalId ? { external: { source: sourceSystem, id: externalId } } : {}),
      });
    }

    // The memberships and the audit record commit together; a failed audit leaves no imported members.
    let outcome;
    try {
      outcome = await withRLSContext({ organizationId }, async (tx) => {
        const written = await importMemberships(tx, organizationId, candidates);
        if (written.inserted + written.bound > 0) {
          await persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'member.import',
            resourceType: 'organization_members',
            resourceId: jobId,
            details: { jobId, imported: written.inserted, bound: written.bound, rows: rows.length, sourceSystem: sourceSystem || null },
          });
        }
        return written;
      });
    } catch (error) {
      if (error instanceof MembershipImportConflictError) throw ApiError.conflict(error.message);
      throw error;
    }
    unresolved.push(...outcome.conflicts);
    unresolved.sort((x, y) => x.row - y.row);
    const processed = outcome.inserted;
    skipped += unresolved.length + outcome.unchanged;

    logger.info('Members imported', { jobId, processed, skipped, unresolved: unresolved.length, organizationId });

    return { job: { id: jobId }, processed, bound: outcome.bound, skipped, unresolved };
  },
);

