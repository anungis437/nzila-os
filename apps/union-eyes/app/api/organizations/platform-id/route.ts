import { NextResponse } from "next/server";
import { auth } from '@nzila/platform-auth/entra/server';
import { DEFAULT_ORGANIZATION_ID } from "@/lib/organization-utils";

/**
 * GET /api/organizations/platform-id
 * Returns the platform (default) organization ID so client components
 * can distinguish "viewing platform" from "viewing a tenant org".
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ platformOrgId: DEFAULT_ORGANIZATION_ID });
}
