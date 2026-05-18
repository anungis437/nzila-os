/**
 * generate-trust-center-manifest.ts
 *
 * Scans the repo for expected evidence artifacts, classifies each as
 * present / partial / missing, and writes the trust center evidence
 * manifest to reports/trust-center-evidence-manifest.json.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes trust:center:check
 *   FAIL_ON_MISSING_EVIDENCE=true pnpm --filter @nzila/union-eyes trust:center:check
 *
 * Exit codes:
 *   0  — success (including when evidence is partial/missing in default mode)
 *   1  — missing evidence detected AND FAIL_ON_MISSING_EVIDENCE=true
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  annotateArtifacts,
  computeManifestSummary,
  validateBuyerSafety,
  buildClaim,
  buildArtifact,
} from '../lib/trust-center/evidence.js';
import type { TrustClaim, TrustCenterManifest } from '../lib/trust-center/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Paths in claim definitions are monorepo-relative (e.g. apps/union-eyes/...)
// so ROOT must point to the monorepo root.
const ROOT = resolve(__dirname, '../../..');

function repoPath(rel: string): string {
  return resolve(ROOT, rel);
}

function fileStatus(rel: string): [boolean, boolean] {
  const abs = repoPath(rel);
  if (!existsSync(abs)) return [false, false];
  try {
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      // A non-empty directory counts as fully present
      const entries = readdirSync(abs);
      return [true, entries.length > 0];
    }
    const content = readFileSync(abs, 'utf8').trim();
    return [true, content.length > 80];
  } catch {
    return [true, false];
  }
}

// ── Claim definitions ─────────────────────────────────────────────────────────

const RAW_CLAIMS: TrustClaim[] = [
  buildClaim(
    'route-governance',
    'Runtime route governance registry',
    'Union Eyes maintains a generated registry of governed API and page routes, ' +
    'providing auditable coverage of role-based access control assignments across ' +
    'the application surface.',
    [
      buildArtifact('apps/union-eyes/reports/route-registry.json', 'report',
        'Generated registry mapping all routes to their governance policy'),
      buildArtifact('apps/union-eyes/scripts/generate-route-registry.ts', 'script',
        'Script that produces the route-registry.json report'),
    ],
    { buyerVisible: true, riskIfMissing: 'Buyers cannot independently verify route-level access control coverage.' },
  ),

  buildClaim(
    'api-governance-validation',
    'API governance CI validation',
    'An automated validation script checks that Union Eyes API routes conform to ' +
    'governance policy contracts on every change. This provides continuous evidence ' +
    'that API access controls have not drifted from declared policy.',
    [
      buildArtifact('apps/union-eyes/scripts/validate-api-governance.ts', 'script',
        'CI gate that validates API route governance conformance'),
      buildArtifact('apps/union-eyes/scripts/validate-route-policies.ts', 'script',
        'Route policy validation companion script'),
    ],
    { buyerVisible: true, riskIfMissing: 'API governance drift may go undetected between reviews.' },
  ),

  buildClaim(
    'middleware-activation',
    'Middleware layer activation and rate limiting',
    'Union Eyes activates a runtime middleware layer that enforces IP-based and ' +
    'role-based rate limiting, ensuring that sensitive operations are protected ' +
    'against abuse at the infrastructure boundary.',
    [
      buildArtifact('apps/union-eyes/middleware.ts', 'source',
        'Runtime middleware entry point with rate limiting and auth guards'),
      buildArtifact('apps/union-eyes/proxy.ts', 'source',
        'Full middleware stack: CORS, org-scoped rate limiting, IP brute-force protection, auth guards'),
    ],
    { buyerVisible: true, riskIfMissing: 'Without middleware evidence, buyers cannot verify perimeter controls.' },
  ),

  buildClaim(
    'org-isolation',
    'Organisation isolation hardening',
    'All data-access paths in Union Eyes are gated through organisation-scope guards. ' +
    'An automated check verifies that no route auto-provisions a new organisation without ' +
    'explicit governance approval, preventing cross-tenant data leakage.',
    [
      buildArtifact('apps/union-eyes/lib/api/with-api.ts', 'source',
        'Unified API wrapper enforcing org-scoped rate limiting, RBAC, and tenant isolation'),
      buildArtifact('apps/union-eyes/docs/governance/ORG_SCOPE_AUDIT.md', 'doc',
        'Manual org-scope audit findings and remediation evidence'),
    ],
    { buyerVisible: true, riskIfMissing: 'Tenant data isolation cannot be verified, which is a critical procurement blocker.' },
  ),

  buildClaim(
    'migration-lineage',
    'Database migration lineage and manifest',
    'Union Eyes maintains a migration lineage manifest that records the SHA-256 ' +
    'hash of every applied database migration, enabling independent verification ' +
    'that the deployed schema matches declared history.',
    [
      buildArtifact('nzila-truth-manifest.json', 'doc',
        'Platform-wide truth manifest tracking schema and deployment status'),
      buildArtifact('migrations', 'config',
        'Migration SQL files directory at monorepo root'),
    ],
    { buyerVisible: true, riskIfMissing: 'Without migration lineage, schema integrity cannot be verified by auditors.' },
  ),

  buildClaim(
    'rbac-role-auth',
    'Role-based access control and dashboard auth parity',
    'Union Eyes enforces role-based access control through server-side auth wrappers ' +
    'applied consistently across dashboard routes. Roles include member, steward, ' +
    'staff, executive, governance, and admin, each with a defined experience lane.',
    [
      buildArtifact('apps/union-eyes/lib/auth/rbac-server.ts', 'source',
        'Server-side RBAC utilities: role checks, permission gates, withRole enforcement'),
      buildArtifact('apps/union-eyes/lib/dashboard/role-experience.ts', 'source',
        'Role-to-experience-lane mapping for dashboard personalisation'),
    ],
    { buyerVisible: true, riskIfMissing: 'Role-based access cannot be demonstrated to buyers — significant trust gap.' },
  ),

  buildClaim(
    'policy-orchestration',
    'Governance policy orchestration and federation inheritance',
    'Union Eyes includes a policy orchestration layer that evaluates governance ' +
    'contracts, resolves federation-level policy inheritance, and classifies ' +
    'AI operations against declared risk thresholds before they execute.',
    [
      buildArtifact('apps/union-eyes/lib/governance-policy/contracts.ts', 'source',
        'Governance contract definitions and evaluation engine'),
      buildArtifact('apps/union-eyes/lib/governance-policy/inheritance.ts', 'source',
        'Federation policy inheritance resolution'),
      buildArtifact('apps/union-eyes/lib/governance-policy/ai-governance.ts', 'source',
        'AI operation governance classification'),
    ],
    { buyerVisible: true, riskIfMissing: 'Policy orchestration maturity cannot be demonstrated to governance-sensitive buyers.' },
  ),

  buildClaim(
    'governance-observability',
    'Governance observability and evidence correlation',
    'A governed observability layer classifies all governance events by severity, ' +
    'assigns correlation IDs, and maintains a retention-aware evidence ledger. ' +
    'This supports audit trail reconstruction and evidence correlation across operations.',
    [
      buildArtifact('apps/union-eyes/lib/governance-observability/telemetry.ts', 'source',
        'Governance telemetry classification and event recording'),
      buildArtifact('apps/union-eyes/lib/governance-observability/correlation.ts', 'source',
        'Correlation ID assignment and cross-event evidence linking'),
      buildArtifact('apps/union-eyes/lib/governance-observability/ledger.ts', 'source',
        'Observability event ledger with retention governance'),
    ],
    { buyerVisible: true, riskIfMissing: 'Audit trail evidence cannot be independently verified.' },
  ),

  buildClaim(
    'governance-simulation',
    'Governance digital twin and operational simulation',
    'Union Eyes provides a shadow-mode governance simulation layer that models ' +
    'federation conflicts, continuity stress, AI escalation scenarios, and ' +
    'policy inheritance outcomes before they affect production operations. ' +
    'Simulations are replayable and ledgered for governance preparedness evidence.',
    [
      buildArtifact('apps/union-eyes/lib/governance-simulation/simulation.ts', 'source',
        'Governance simulation engine'),
      buildArtifact('apps/union-eyes/lib/governance-simulation/ledger.ts', 'source',
        'Simulation ledger'),
      buildArtifact('apps/union-eyes/reports/governance-simulation-summary.json', 'report',
        'Generated governance simulation summary report'),
    ],
    { buyerVisible: true, riskIfMissing: 'Institutional preparedness evidence is unavailable for procurement review.' },
  ),

  buildClaim(
    'federation-sovereignty',
    'Sovereign federation execution fabric',
    'Union Eyes models governance-aware institutional autonomy across federation ' +
    'tiers (national, regional, local, affiliate, coalition). Delegation chains, ' +
    'sovereignty conflicts, continuity sharing, AI governance jurisdiction, and ' +
    'replayable federation simulations are all supported in shadow mode.',
    [
      buildArtifact('apps/union-eyes/lib/federation-sovereignty/types.ts', 'source',
        'Sovereignty type vocabulary'),
      buildArtifact('apps/union-eyes/lib/federation-sovereignty/delegation.ts', 'source',
        'Delegated authority chain evaluation'),
      buildArtifact('apps/union-eyes/lib/federation-sovereignty/simulation.ts', 'source',
        'Cross-federation simulation engine'),
      buildArtifact('apps/union-eyes/reports/federation-sovereignty-summary.json', 'report',
        'Generated federation sovereignty summary report'),
    ],
    { buyerVisible: true, riskIfMissing: 'Federation governance architecture cannot be demonstrated to multi-tier union buyers.' },
  ),

  buildClaim(
    'ai-governance',
    'AI governance and human oversight controls',
    'All AI operations within Union Eyes are classified by risk level before execution. ' +
    'Sensitive and restricted AI operations require explicit human review. ' +
    'Federation-level AI autonomy boundaries are declared and enforced through ' +
    'shadow-mode governance contracts.',
    [
      buildArtifact('apps/union-eyes/lib/governance-policy/ai-governance.ts', 'source',
        'AI operation risk classification and governance gate'),
      buildArtifact('apps/union-eyes/lib/governance-simulation/ai-simulation.ts', 'source',
        'AI governance simulation scenarios'),
      buildArtifact('apps/union-eyes/lib/federation-sovereignty/autonomy.ts', 'source',
        'AI autonomy boundary resolution per federation tier'),
      buildArtifact('apps/union-eyes/docs/trust-center/AI_GOVERNANCE_AND_HUMAN_OVERSIGHT.md', 'doc',
        'Buyer-readable AI governance overview'),
    ],
    { buyerVisible: true, riskIfMissing: 'AI accountability cannot be demonstrated — significant risk for public-sector and union buyers.' },
  ),

  buildClaim(
    'public-experience-governance',
    'Public-experience governance primitives',
    'Content published to public-facing surfaces in Union Eyes is classified ' +
    'through a governance lifecycle (draft → review → approved → published → archived). ' +
    'Federation sovereignty metadata is tracked in shadow mode for all public surfaces.',
    [
      buildArtifact('apps/union-eyes/lib/public-experience/types.ts', 'source',
        'Public-experience governance type vocabulary including federation sovereignty metadata'),
      buildArtifact('apps/union-eyes/lib/public-experience/governance.ts', 'source',
        'Governance enforcement for public-surface publish and promote operations'),
    ],
    { buyerVisible: true, riskIfMissing: 'Content governance controls for public surfaces cannot be verified.' },
  ),

  buildClaim(
    'narrative-governance',
    'Narrative governance and terminology alignment',
    'Union Eyes enforces vocabulary alignment through a narrative audit CI check. ' +
    'Marketing language, product claims, and documentation are continuously validated ' +
    'against a terminology contract to prevent claim drift.',
    [
      buildArtifact('apps/union-eyes/tooling/marketing/narrative-audit.ts', 'source',
        'Narrative audit script'),
      buildArtifact('apps/union-eyes/docs/governance/TERMINOLOGY_ALIGNMENT.md', 'doc',
        'Terminology alignment contract'),
    ],
    { buyerVisible: true, riskIfMissing: 'Marketing claim accuracy cannot be independently verified.' },
  ),

  buildClaim(
    'security-auth-audit',
    'Security and authentication audit evidence',
    'Union Eyes includes documented authentication audit findings, secret management ' +
    'validation evidence, an incident drill report, and backup/restore validation. ' +
    'These provide a foundation for independent security review.',
    [
      buildArtifact('apps/union-eyes/docs/security/AUTH_REALITY_AUDIT.md', 'doc',
        'Auth layer audit findings'),
      buildArtifact('apps/union-eyes/docs/security/SECRET_MANAGEMENT_VALIDATION.md', 'doc',
        'Secrets posture evidence'),
      buildArtifact('apps/union-eyes/docs/security/INCIDENT_DRILL_REPORT.md', 'doc',
        'Incident response rehearsal results'),
      buildArtifact('apps/union-eyes/docs/security/BACKUP_RESTORE_VALIDATION.md', 'doc',
        'Disaster recovery validation evidence'),
    ],
    { buyerVisible: true, riskIfMissing: 'Security posture evidence is unavailable — blocks trust-sector procurement.' },
  ),

  buildClaim(
    'business-continuity',
    'Business continuity and rollback evidence',
    'Union Eyes provides documented rollback procedures, production cutover checklists, ' +
    'and deployment rehearsal evidence. These support institutional buyers\' continuity ' +
    'and recovery requirements.',
    [
      buildArtifact('apps/union-eyes/docs/operations/ROLLBACK_VALIDATION.md', 'doc',
        'Rollback procedure and validation evidence'),
      buildArtifact('apps/union-eyes/docs/operations/PRODUCTION_CUTOVER_CHECKLIST.md', 'doc',
        'Production go-live checklist'),
      buildArtifact('apps/union-eyes/docs/operations/DEPLOYMENT_REHEARSAL.md', 'doc',
        'Deployment rehearsal results'),
    ],
    { buyerVisible: true, riskIfMissing: 'Buyers cannot verify recovery procedures — required for regulated-sector procurement.' },
  ),

  buildClaim(
    'pilot-evidence',
    'Pilot readiness and procurement documentation',
    'Union Eyes includes a pilot scope document, pilot validation results, a product ' +
    'readiness report, and a final readiness sign-off. These provide a documented ' +
    'procurement evidence trail for controlled pilot deployments.',
    [
      buildArtifact('apps/union-eyes/docs/procurement/PILOT_SCOPE.md', 'doc',
        'Pilot program scope and constraints'),
      buildArtifact('apps/union-eyes/docs/procurement/PILOT_VALIDATION.md', 'doc',
        'Pilot validation results'),
      buildArtifact('apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md', 'doc',
        'Production readiness memo for buyer evidence'),
      buildArtifact('apps/union-eyes/docs/procurement/FINAL_READINESS_STATUS.md', 'doc',
        'Gate sign-off record'),
    ],
    { buyerVisible: true, riskIfMissing: 'Structured procurement evidence trail is missing — increases sales cycle friction.' },
  ),

  buildClaim(
    'docs-hygiene',
    'Documentation hygiene and evidence organisation',
    'Union Eyes maintains a structured documentation index covering architecture, ' +
    'security, operations, governance, and procurement. Documentation is organised ' +
    'for traceability and is referenced from a central index.',
    [
      buildArtifact('apps/union-eyes/docs/INDEX.md', 'doc',
        'Central documentation navigation index'),
      buildArtifact('apps/union-eyes/docs/architecture/ARCHITECTURE_SHAPE.md', 'doc',
        'System architecture overview'),
      buildArtifact('apps/union-eyes/docs/architecture/GOVERNANCE_RUNTIME_MODEL.md', 'doc',
        'Governance runtime model documentation'),
    ],
    { buyerVisible: true, riskIfMissing: 'Documentation disorganisation signals operational immaturity to enterprise buyers.' },
  ),
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const failOnMissing = process.env['FAIL_ON_MISSING_EVIDENCE'] === 'true';

  console.log('📋 Generating trust center evidence manifest...\n');

  // Annotate all artifacts with file-system status
  const annotatedClaims: TrustClaim[] = RAW_CLAIMS.map((claim) => ({
    ...claim,
    evidence: annotateArtifacts(claim.evidence, fileStatus),
  }));

  // Validate buyer safety
  const violations = validateBuyerSafety(annotatedClaims);
  if (violations.length > 0) {
    console.error('❌ Buyer-safety denylist violations found:');
    for (const v of violations) {
      console.error(`   claim "${v.claimId}" contains forbidden term: "${v.matchedTerm}"`);
    }
    process.exit(1);
  }

  const summary = computeManifestSummary(annotatedClaims);

  const manifest = {
    generatedAt: new Date().toISOString(),
    app: 'union-eyes' as const,
    evidenceVersion: 1,
    claims: annotatedClaims,
    summary,
  };

  // Report to stdout
  console.log('Evidence coverage:');
  console.log(`  ✅ Present  : ${summary.presentClaims}/${summary.totalClaims}`);
  console.log(`  🟡 Partial  : ${summary.partialClaims}/${summary.totalClaims}`);
  console.log(`  ❌ Missing  : ${summary.missingClaims}/${summary.totalClaims}`);
  console.log(`  Coverage   : ${summary.coverageScore}%`);
  console.log(`  Buyer-vis. : ${summary.buyerVisibleClaims} claims\n`);

  for (const claim of annotatedClaims) {
    for (const artifact of claim.evidence) {
      const icon = artifact.status === 'present' ? '✅' : artifact.status === 'partial' ? '🟡' : '❌';
      if (artifact.status !== 'present') {
        console.log(`  ${icon} [${claim.id}] ${artifact.path}`);
      }
    }
  }

  // Write manifest
  const outPath = repoPath('apps/union-eyes/reports/trust-center-evidence-manifest.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\n✅ Manifest written to reports/trust-center-evidence-manifest.json`);

  if (failOnMissing && summary.missingClaims > 0) {
    console.error(`\n❌ FAIL_ON_MISSING_EVIDENCE=true — ${summary.missingClaims} claims are missing evidence.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Manifest generation failed:', err);
  process.exit(1);
});
