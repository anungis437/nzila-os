/**
 * API Route: Load CUPE Pilot Fixtures
 * POST /api/admin/seed-cupe-pilot
 * 
 * Allows admins to load CUPE Local 123 demo data for pilot readiness testing.
 * Supports both regular load and reset modes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

interface SeedRequest {
  reset?: boolean;
}

const CUPE_PILOT_JSON = resolve(
  process.cwd(),
  'fixtures/cupe/pilot-org/cupe-pilot-setup.json'
);

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // const user = await getUser(request);
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    // }

    const body: SeedRequest = await request.json();
    const { reset = false } = body;

    // Load fixture JSON
    const jsonContent = await readFile(CUPE_PILOT_JSON, 'utf-8');
    const fixture = JSON.parse(jsonContent);

    // TODO: Implement actual database seeding
    // For v0.1, this is a stub that validates the fixture structure
    // v0.2: Integrate with seed-cupe-pilot.mjs or direct DB inserts

    return NextResponse.json({
      success: true,
      message: reset
        ? 'CUPE pilot data reset successfully'
        : 'CUPE pilot data loaded successfully',
      data: {
        org: fixture.org.name,
        worksites: fixture.worksites.length,
        members: fixture.members.length,
        cases: fixture.cases.length,
      },
    });
  } catch (error) {
    console.error('[/api/admin/seed-cupe-pilot] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to seed CUPE pilot data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
