/**
 * Prints read-only membership identity evidence as JSON (lib/membership/identity-evidence.ts).
 *
 *   MEMBERSHIP_EVIDENCE_DATABASE_URL=postgres://… pnpm exec tsx scripts/runtime/membership-identity-evidence.ts [organization-uuid …]
 *
 * The connection is opened with default_transaction_read_only=on and the collection itself runs in a READ ONLY transaction. Reading a
 * staging or production database is a privileged operation under the release programme's own gates; this script does not grant that.
 */
import pg from 'pg';
import { collectMembershipIdentityEvidence } from '../../lib/membership/identity-evidence';

async function main() {
  const url = process.env.MEMBERSHIP_EVIDENCE_DATABASE_URL;
  if (!url) throw new Error('MEMBERSHIP_EVIDENCE_DATABASE_URL is required');
  const organizationIds = process.argv.slice(2);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of organizationIds) if (!uuid.test(id)) throw new Error(`not an organization uuid: ${id}`);
  const client = new pg.Client({ connectionString: url, options: '-c default_transaction_read_only=on' });
  await client.connect();
  try {
    const evidence = await collectMembershipIdentityEvidence(client, { organizationIds });
    process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
