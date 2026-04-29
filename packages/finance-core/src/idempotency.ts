import { createHash } from 'node:crypto'

export function buildFinanceIdempotencyKey(orgId: string, operation: string, resourceId: string): string {
  return createHash('sha256')
    .update(`${orgId}:${operation}:${resourceId}`)
    .digest('hex')
}
