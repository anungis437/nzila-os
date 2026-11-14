import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { logger } from '@/lib/logger'

/** V2 evidence must finish while the authenticated API transaction is still open. */
export async function settleUnionEvidencePack(
  pending: Promise<unknown>,
  actionType: string,
): Promise<void> {
  if (currentStateContextEnabled()) {
    await pending
    return
  }
  // Legacy storage retains its existing asynchronous failure handling.
  void pending.catch((error) =>
    logger.warn('Evidence pack failed', { error: String(error), actionType }),
  )
}
