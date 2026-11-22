import { NextResponse } from 'next/server'
/** Process liveness only. No claim of DB readiness or commercial admission. */
export function GET() { return NextResponse.json({ application: 'nen', status: 'alive', timestamp: new Date().toISOString(), productionReady: false }) }
