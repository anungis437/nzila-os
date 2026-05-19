import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { icraMaturityProfiles } from '@/db/schema/icra-schema';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;
  const rows = await db
    .select()
    .from(icraMaturityProfiles)
    .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
    .orderBy(icraMaturityProfiles.generatedAt)
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  return NextResponse.json({ profile: rows[0].profilePayload });
}
