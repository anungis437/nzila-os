import { db } from '../db/db';
import { organizations } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    // Test 1: Look up NZILA Ventures org by clerk org ID
    const clerkOrgId = 'org_3A1qYmVHWmeSbbZhlPMwVIrGHFQ';
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkOrganizationId, clerkOrgId))
      .limit(1);
    console.log('Clerk org lookup:', clerkOrgId, '→', org?.id ?? 'NOT FOUND');

    // Test 2: Verify the resolved UUID looks like a UUID
    if (org?.id) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      console.log('Is valid UUID:', uuidPattern.test(org.id));
    }

    console.log('SUCCESS');
  } catch (err) {
    console.error('ERROR:', err);
  }
  process.exit(0);
}
main();
