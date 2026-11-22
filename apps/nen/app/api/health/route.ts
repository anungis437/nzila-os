import { NextResponse } from 'next/server'
/** Process liveness only. Does not assert DB readiness, institutional admission or product certification. */
export function GET() { return NextResponse.json({ application: 'nen', process: 'alive', productionReady: false }) }
