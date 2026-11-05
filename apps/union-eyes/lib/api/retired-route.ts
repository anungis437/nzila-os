import { NextResponse } from 'next/server'

/**
 * Handler for an endpoint that has been retired. It performs no operation, reads and writes nothing, and says so, so a
 * client that still calls it gets a truthful answer instead of a success it did not earn.
 */
export function retiredHandler(replacement: string) {
  return async (..._args: unknown[]): Promise<NextResponse> =>
    NextResponse.json(
      { error: { code: 'NOT_IMPLEMENTED', message: `This endpoint is retired and performs no operation. Use ${replacement}.` } },
      { status: 501 },
    )
}
