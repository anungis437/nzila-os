import { NextResponse } from 'next/server';

/**
 * GET /api/health/liveness
 * Simple liveness probe for Docker/Kubernetes health checks
 * 
 * This endpoint always returns 200 if the server is running.
 * Use /api/health for detailed health status including dependencies.
 * 
 * Returns:
 * - 200: Server is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}

