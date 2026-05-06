import { handleRUMBeacon } from '@nzila/platform-rum'

export async function POST(request: Request): Promise<Response> {
  return handleRUMBeacon(request)
}