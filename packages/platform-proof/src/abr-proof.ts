/**
 * Nzila OS — ABR Proof Pack Section
 *
 * Extends the governance proof pack with ABR-specific evidence stats:
 *   - Terminal event counts (decisions issued, exports, closures)
 *   - Last seal timestamps per terminal event type
 *   - Evidence pack integrity summary
 *
 * Follows the same pattern as integrations-proof.ts — pure computation,
 * ports-injected, HMAC-signed.
 *
 * @module @nzila/platform-proof/abr
 */
import { computeSignatureHash } from './proof'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AbrTerminalEventStats {
  readonly eventType: string
  readonly totalCount: number
  readonly lastSealedAt: string | null
  readonly lastEntityId: string | null
}

export interface AbrProofSection {
  readonly sectionId: string
  readonly sectionType: 'abr_evidence'
  readonly generatedAt: string
  /** Per-terminal-event type breakdown */
  readonly terminalEvents: readonly AbrTerminalEventStats[]
  /** Total sealed evidence packs across all terminal event types */
  readonly totalSealedPacks: number
  /** Total ABR audit events in window */
  readonly totalAuditEvents: number
  /** Last evidence seal timestamp (any type) */
  readonly lastSealedAt: string | null
  /** HMAC signature of this section */
  readonly signatureHash: string
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface AbrProofPorts {
  /** Fetch terminal event stats per type for an org */
  readonly fetchTerminalEventStats: (
    orgId: string,
  ) => Promise<readonly AbrTerminalEventStats[]>
  /** Fetch total ABR audit event count for an org */
  readonly fetchAuditEventCount: (orgId: string) => Promise<number>
}

// ── Section Generator ───────────────────────────────────────────────────────

/**
 * Generate an ABR evidence proof section.
 *
 * This does not persist — callers attach the section
 * to the main proof pack payload before persisting.
 */
export async function generateAbrProofSection(
  orgId: string,
  ports: AbrProofPorts,
): Promise<AbrProofSection> {
  const terminalEvents = await ports.fetchTerminalEventStats(orgId)
  const totalAuditEvents = await ports.fetchAuditEventCount(orgId)

  const totalSealedPacks = terminalEvents.reduce((s, e) => s + e.totalCount, 0)

  // Find the most recent seal across all event types
  const lastSealedAt = terminalEvents.reduce<string | null>((latest, e) => {
    if (!e.lastSealedAt) return latest
    if (!latest) return e.lastSealedAt
    return e.lastSealedAt > latest ? e.lastSealedAt : latest
  }, null)

  const generatedAt = new Date().toISOString()

  const sigPayload: Record<string, string> = {
    sectionType: 'abr_evidence',
    orgId,
    generatedAt,
    totalSealedPacks: String(totalSealedPacks),
    totalAuditEvents: String(totalAuditEvents),
    lastSealedAt: lastSealedAt ?? 'none',
    terminalEventTypeCount: String(terminalEvents.length),
  }

  const signatureHash = computeSignatureHash(sigPayload)

  return {
    sectionId: `abr-proof-${orgId}-${Date.now()}`,
    sectionType: 'abr_evidence',
    generatedAt,
    terminalEvents,
    totalSealedPacks,
    totalAuditEvents,
    lastSealedAt,
    signatureHash,
  }
}
