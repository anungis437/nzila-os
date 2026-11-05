import { NextResponse } from "next/server";
import { auth } from '@nzila/platform-auth/entra/server';
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";
import { eq } from 'drizzle-orm';
import { organizations } from '@/db/schema-organizations';
import { withSystemContext } from '@/lib/db/with-rls-context';

/**
 * GET /api/organizations/platform-id
 * Returns the platform (default) organization ID so client components
 * can distinguish "viewing platform" from "viewing a tenant org".
 * The identifier is answered only when the organizations table holds that row; a deployment where it was never provisioned is a 404,
 * not a constant the table does not back.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await withSystemContext(async (tx) =>
    tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, DEFAULT_ORGANIZATION_ID)).limit(1),
  );
  if (!row) return NextResponse.json({ error: 'The platform organization is not provisioned' }, { status: 404 });
  return NextResponse.json({ platformOrgId: row.id });
}
