/**
 * Trust Center — shared type vocabulary.
 *
 * Defines the shape of trust claims, evidence artifacts, and the manifest
 * used by the evidence generator and summary generator scripts.
 *
 * No runtime side-effects. Import anywhere safely.
 *
 * @module lib/trust-center/types
 */

// ── Evidence classification ───────────────────────────────────────────────────

/**
 * How confidently an evidence artifact is present on disk / in the repo.
 *
 * - `present`  — file exists and is non-empty
 * - `partial`  — file exists but appears incomplete (stub / placeholder)
 * - `missing`  — file does not exist
 */
export type EvidenceStatus = 'present' | 'partial' | 'missing';

/**
 * Category of evidence artifact.
 *
 * Used to group claims in the manifest and in generated summaries.
 */
export type EvidenceType =
  | 'report'
  | 'script'
  | 'doc'
  | 'test'
  | 'config'
  | 'source';

// ── Evidence artifact ─────────────────────────────────────────────────────────

/** A single file-level evidence artifact referenced by a trust claim. */
export interface EvidenceArtifact {
  /** Repo-relative path (e.g. apps/union-eyes/reports/route-registry.json). */
  path: string;
  /** Human-readable description of what this artifact demonstrates. */
  description: string;
  /** Kind of artifact. */
  type: EvidenceType;
  /** Resolved at generation time — do NOT hand-populate. */
  status?: EvidenceStatus;
}

// ── Trust claim ───────────────────────────────────────────────────────────────

/**
 * A single verifiable trust claim made about the UnionEyes platform.
 *
 * Claims map to procurement questions, security reviews, and buyer diligence.
 */
export interface TrustClaim {
  /** Stable kebab-case identifier. */
  id: string;
  /** Short buyer-readable title. */
  title: string;
  /**
   * One-paragraph public-safe summary.
   * Must NOT contain secrets, credentials, client-specific references,
   * or terms on the TRUST_CENTER_DENYLIST.
   */
  summary: string;
  /** Supporting artifacts that ground the claim in repo evidence. */
  evidence: EvidenceArtifact[];
  /**
   * Whether this claim and its summary may be shown in a public-facing
   * trust center document.
   */
  buyerVisible: boolean;
  /**
   * What risk a buyer faces if this claim cannot be verified.
   * Used to prioritise remediation.
   */
  riskIfMissing: string;
}

// ── Manifest ──────────────────────────────────────────────────────────────────

/** Top-level structure of the generated trust center evidence manifest. */
export interface TrustCenterManifest {
  /** ISO-8601 generation timestamp. */
  generatedAt: string;
  /** App this manifest describes. */
  app: 'union-eyes';
  /** Increment this when the schema changes. */
  evidenceVersion: number;
  /** All trust claims, in order of procurement priority. */
  claims: TrustClaim[];
  /** Summary counts populated at generation time. */
  summary?: ManifestSummary;
}

/** Aggregate counts appended to the manifest at generation time. */
export interface ManifestSummary {
  totalClaims: number;
  presentClaims: number;
  partialClaims: number;
  missingClaims: number;
  buyerVisibleClaims: number;
  /** Overall coverage score 0–100. */
  coverageScore: number;
}

// ── Forbidden terms ───────────────────────────────────────────────────────────

/**
 * Terms that must not appear in buyer-visible trust center text.
 *
 * This denylist is trust-center-specific. It is not a global filter.
 * It prevents accidental leakage of sensitive/private material into
 * procurement-facing documents.
 */
export const TRUST_CENTER_DENYLIST: readonly string[] = [
  'whatsapp',
  'private meeting',
  'raw transcript',
  'client secret',
  'password',
  'token=',
  'bearer ',
  'psac constitution',
  'cupw constitution',
  'api_key',
  'secret_key',
  'private_key',
] as const;

/**
 * Check whether text contains any denylist term (case-insensitive).
 *
 * @returns the matched term if found, undefined if clean.
 */
export function checkDenylist(text: string): string | undefined {
  const lower = text.toLowerCase();
  return TRUST_CENTER_DENYLIST.find((term) => lower.includes(term));
}
