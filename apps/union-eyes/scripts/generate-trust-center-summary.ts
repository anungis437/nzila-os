/**
 * generate-trust-center-summary.ts
 *
 * Reads the trust center evidence manifest and regenerates
 * docs/trust-center/INDEX.md with a buyer-readable evidence summary,
 * claim coverage table, and links to supporting documents.
 *
 * This script is non-destructive: it overwrites only INDEX.md.
 * The other trust center docs are static and authored separately.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes trust:center
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TrustCenterManifest } from '../lib/trust-center/types.js';
import { classifyClaimCoverage } from '../lib/trust-center/evidence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function repoPath(rel: string): string {
  return resolve(ROOT, rel);
}

function statusIcon(status: 'present' | 'partial' | 'missing'): string {
  return status === 'present' ? '✅' : status === 'partial' ? '🟡' : '❌';
}

function buildIndexMd(manifest: TrustCenterManifest): string {
  const { summary, claims, generatedAt } = manifest;

  const coverageRow = `| **Total claims** | ${summary?.totalClaims ?? claims.length} | **Present** | ${summary?.presentClaims ?? 0} | **Partial** | ${summary?.partialClaims ?? 0} | **Missing** | ${summary?.missingClaims ?? 0} |`;

  const claimRows = claims
    .map((c) => {
      const coverage = classifyClaimCoverage(c);
      const icon = statusIcon(coverage);
      const vis = c.buyerVisible ? '✅' : '🔒';
      return `| ${icon} | \`${c.id}\` | ${c.title} | ${vis} |`;
    })
    .join('\n');

  const evidenceRows = claims
    .flatMap((c) =>
      c.evidence.map((e) => {
        const icon = statusIcon(e.status ?? 'missing');
        return `| ${icon} | \`${c.id}\` | \`${e.path}\` | ${e.description} |`;
      }),
    )
    .join('\n');

  const missingSection = (() => {
    const missing = claims.filter((c) => classifyClaimCoverage(c) === 'missing');
    if (missing.length === 0) return '> ✅ All claims have at least partial evidence present.\n';
    return missing
      .map((c) => `- **\`${c.id}\`** — ${c.riskIfMissing}`)
      .join('\n') + '\n';
  })();

  return `# UnionEyes — Trust Center Index

> **Audience:** Procurement reviewers, institutional buyers, governance auditors.
> **Generated:** ${generatedAt}
> **Coverage score:** ${summary?.coverageScore ?? '–'}%

This index provides a buyer-readable summary of UnionEyes governance, security,
and operational evidence. All claims are grounded in repository artifacts and
generated automatically from the evidence manifest.

**Public-safe caveats:**
- Claims use language such as "is designed to," "supports," and "provides evidence of."
- No claim in this document represents a formal certification unless a certification
  document is explicitly referenced.
- This document does not contain secrets, credentials, client-specific references,
  or private meeting notes.

---

## Evidence Coverage Summary

| Metric | Value | Metric | Value | Metric | Value | Metric | Value |
|--------|-------|--------|-------|--------|-------|--------|-------|
${coverageRow}

**Buyer-visible claims:** ${summary?.buyerVisibleClaims ?? 0}

---

## Claim Coverage Table

| Status | Claim ID | Title | Buyer Visible |
|--------|----------|-------|---------------|
${claimRows}

---

## Trust Center Documents

The following documents provide buyer-readable summaries for each trust domain:

| Document | Domain |
|----------|--------|
| [SECURITY_AND_PRIVACY_OVERVIEW.md](./SECURITY_AND_PRIVACY_OVERVIEW.md) | Security controls and data privacy posture |
| [GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md](./GOVERNANCE_AND_AUDITABILITY_OVERVIEW.md) | Runtime governance and audit trail evidence |
| [DATA_RESIDENCY_AND_INFRASTRUCTURE_OVERVIEW.md](./DATA_RESIDENCY_AND_INFRASTRUCTURE_OVERVIEW.md) | Data residency and infrastructure architecture |
| [AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md](./AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md) | AI accountability and human review controls |
| [FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md](./FEDERATION_AND_SOVEREIGNTY_OVERVIEW.md) | Federation governance and institutional autonomy |
| [BUSINESS_CONTINUITY_AND_RECOVERY_OVERVIEW.md](./BUSINESS_CONTINUITY_AND_RECOVERY_OVERVIEW.md) | Continuity, rollback, and recovery posture |
| [PROCUREMENT_EVIDENCE_MAP.md](./PROCUREMENT_EVIDENCE_MAP.md) | Claim-to-artifact evidence mapping for procurement |
| [PUBLIC_SAFE_ARCHITECTURE_SUMMARY.md](./PUBLIC_SAFE_ARCHITECTURE_SUMMARY.md) | Architecture overview safe for external distribution |

---

## Evidence Artifact Status

| Status | Claim | Artifact Path | Description |
|--------|-------|---------------|-------------|
${evidenceRows}

---

## Missing or Partial Evidence

${missingSection}

---

## Related Resources

| Resource | Purpose |
|----------|---------|
| \`reports/trust-center-evidence-manifest.json\` | Machine-readable evidence manifest |
| \`reports/route-registry.json\` | Generated API/route governance registry |
| \`reports/governance-simulation-summary.json\` | Governance simulation summary |
| \`reports/federation-sovereignty-summary.json\` | Federation sovereignty summary |
| \`docs/INDEX.md\` | Full documentation index |
| \`docs/procurement/\` | Procurement and pilot readiness documents |
| \`docs/security/\` | Security audit and validation evidence |
| \`docs/operations/\` | Operations and continuity evidence |

---

*Generated by \`scripts/generate-trust-center-summary.ts\`. Run \`pnpm trust:center\` to refresh.*
`;
}

async function main(): Promise<void> {
  const manifestPath = repoPath('reports/trust-center-evidence-manifest.json');

  if (!existsSync(manifestPath)) {
    console.error('❌ Manifest not found. Run trust:center:check first.');
    process.exit(1);
  }

  const manifest: TrustCenterManifest = JSON.parse(
    readFileSync(manifestPath, 'utf8'),
  );

  const outDir = repoPath('docs/trust-center');
  mkdirSync(outDir, { recursive: true });

  const indexPath = resolve(outDir, 'INDEX.md');
  writeFileSync(indexPath, buildIndexMd(manifest), 'utf8');
  console.log('✅ Trust center INDEX.md refreshed.');

  const claimsCount = manifest.claims.length;
  const score = manifest.summary?.coverageScore ?? '–';
  console.log(`   ${claimsCount} claims | coverage: ${score}%`);
}

main().catch((err) => {
  console.error('❌ Summary generation failed:', err);
  process.exit(1);
});
