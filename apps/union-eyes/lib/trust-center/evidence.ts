/**
 * Trust Center — evidence classification helpers.
 *
 * Pure functions for classifying evidence artifacts, scoring claim coverage,
 * and building the manifest summary. Used by both the generator script and
 * the test suite.
 *
 * No file I/O in this module — callers pass file-existence results so that
 * tests can run without a real file system.
 *
 * @module lib/trust-center/evidence
 */

import type {
  EvidenceArtifact,
  EvidenceStatus,
  EvidenceType,
  TrustClaim,
  ManifestSummary,
} from './types';
import { checkDenylist } from './types';

export type { EvidenceStatus, EvidenceType };

// ── Artifact classification ───────────────────────────────────────────────────

/**
 * Classify a single evidence artifact given whether the file exists and
 * whether it has meaningful content.
 *
 * - Both truthy → `present`
 * - File exists but empty/stub → `partial`
 * - File missing → `missing`
 */
export function classifyArtifact(
  fileExists: boolean,
  hasContent: boolean,
): EvidenceStatus {
  if (!fileExists) return 'missing';
  if (!hasContent) return 'partial';
  return 'present';
}

/**
 * Annotate a list of evidence artifacts with their resolved status,
 * given a lookup function that returns [exists, hasContent] per path.
 */
export function annotateArtifacts(
  artifacts: EvidenceArtifact[],
  lookup: (path: string) => [boolean, boolean],
): EvidenceArtifact[] {
  return artifacts.map((artifact) => {
    const [exists, hasContent] = lookup(artifact.path);
    return { ...artifact, status: classifyArtifact(exists, hasContent) };
  });
}

// ── Claim coverage ────────────────────────────────────────────────────────────

/**
 * Determine the aggregate status of a trust claim based on its evidence.
 *
 * Rules:
 * - All evidence present → `present`
 * - Any evidence present, none missing → `partial`
 * - All evidence missing → `missing`
 * - Mix of present + missing → `partial`
 */
export function classifyClaimCoverage(claim: TrustClaim): EvidenceStatus {
  if (claim.evidence.length === 0) return 'missing';
  const statuses = claim.evidence.map((e) => e.status ?? 'missing');
  const allPresent = statuses.every((s) => s === 'present');
  if (allPresent) return 'present';
  const allMissing = statuses.every((s) => s === 'missing');
  if (allMissing) return 'missing';
  return 'partial';
}

// ── Manifest summary ──────────────────────────────────────────────────────────

/**
 * Compute the manifest summary counts from a list of annotated claims.
 *
 * Coverage score = (present + partial * 0.5) / total * 100, rounded.
 */
export function computeManifestSummary(claims: TrustClaim[]): ManifestSummary {
  let present = 0;
  let partial = 0;
  let missing = 0;
  let buyerVisible = 0;

  for (const claim of claims) {
    const status = classifyClaimCoverage(claim);
    if (status === 'present') present++;
    else if (status === 'partial') partial++;
    else missing++;
    if (claim.buyerVisible) buyerVisible++;
  }

  const total = claims.length;
  const coverageScore =
    total === 0
      ? 0
      : Math.round(((present + partial * 0.5) / total) * 100);

  return {
    totalClaims: total,
    presentClaims: present,
    partialClaims: partial,
    missingClaims: missing,
    buyerVisibleClaims: buyerVisible,
    coverageScore,
  };
}

// ── Public-safety validation ──────────────────────────────────────────────────

/**
 * Validate that all buyer-visible claim summaries are free of denylist terms.
 *
 * Returns a list of violations (empty = clean).
 */
export interface DenylistViolation {
  claimId: string;
  matchedTerm: string;
}

export function validateBuyerSafety(claims: TrustClaim[]): DenylistViolation[] {
  const violations: DenylistViolation[] = [];
  for (const claim of claims) {
    if (!claim.buyerVisible) continue;
    const matched = checkDenylist(claim.summary);
    if (matched) {
      violations.push({ claimId: claim.id, matchedTerm: matched });
    }
  }
  return violations;
}

// ── Claim builders (convenience) ─────────────────────────────────────────────

/** Build a minimal TrustClaim with defaults. */
export function buildClaim(
  id: string,
  title: string,
  summary: string,
  evidence: EvidenceArtifact[],
  options: {
    buyerVisible?: boolean;
    riskIfMissing?: string;
  } = {},
): TrustClaim {
  return {
    id,
    title,
    summary,
    evidence,
    buyerVisible: options.buyerVisible ?? true,
    riskIfMissing: options.riskIfMissing ?? 'Unverifiable claim — reduces buyer confidence.',
  };
}

/** Build a minimal EvidenceArtifact. */
export function buildArtifact(
  path: string,
  type: EvidenceType,
  description: string,
): EvidenceArtifact {
  return { path, type, description };
}
