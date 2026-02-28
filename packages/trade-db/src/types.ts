/**
 * @nzila/trade-db — Repository context types
 *
 * Follows the same pattern as @nzila/commerce-db/types.
 */

export interface TradeDbContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /**
   * @deprecated Use `orgId` instead. Kept for backward compatibility.
   */
  readonly entityId: string
  /** Actor performing the operation */
  readonly actorId: string
}

export interface TradeReadContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /**
   * @deprecated Use `orgId` instead. Kept for backward compatibility.
   */
  readonly entityId: string
}
