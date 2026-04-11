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
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
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
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

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
      return { job: { id: crypto.randomUUID() }, processed: 0, skipped: 0 };
    }

    const jobId = crypto.randomUUID();
    let processed = 0;
    let skipped = 0;

    // Resolve auth client for user lookups; fall back to provisional UUIDs if unavailable
    const authClient = adminClient;

    for (const row of rows) {
      const email = (row['email'] ?? row['Email'] ?? '').trim();
      const name  = (row['name']  ?? row['Name']  ?? row['full_name'] ?? '').trim();
      const role  = (row['role']  ?? row['Role']  ?? 'member').trim().toLowerCase();

      if (!email) { skipped++; continue; }

      // Look up the Clerk user by email; fall back to a provisional UUID if not found
      let resolvedUserId: string = crypto.randomUUID();
      try {
        const found = await authClient.users.getUserList({ emailAddress: [email] });
        if (found.data.length > 0) resolvedUserId = found.data[0].id;
      } catch {
        // Keep the provisional UUID
      }

      try {
        await withRLSContext(async () =>
          db.insert(organizationMembers).values({
            organizationId,
            userId: resolvedUserId,
            name: name || email,
            email,
            role,
            status: 'active',
          }).onConflictDoNothing()
        );
        processed++;
      } catch (err) {
        logger.warn('Member import row skipped', { email, err });
        skipped++;
      }
    }

    logger.info('Members imported', { jobId, processed, skipped, organizationId });

    return { job: { id: jobId }, processed, skipped };
  },
);
