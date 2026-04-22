/**
 * Health check endpoint — bypasses enforcement pipeline.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    app: 'test-scaffold-gp',
    timestamp: new Date().toISOString(),
  })
}
