# RFP Generator

> Automated RFP response generation from live platform proof artifacts.

## Overview

The RFP Generator produces a complete Markdown RFP response document from
platform evidence, assurance scores, and policy compliance data. It answers
common procurement questions across 8 domains with evidence references.

## Usage

```bash
# Default: writes to docs/rfp/answers.md
pnpm rfp:generate

# Custom output path
pnpm rfp:generate -- --out path/to/output.md
```

## Output

The generator produces a structured Markdown document with:

- **Section headers** for each domain
- **Question/answer pairs** with evidence references
- **Confidence ratings** (high / medium / low) per answer

## Sections Covered

The RFP response is structured into 8 numbered sections:

| # | Section | ID | Topics |
|---|---------|-----|--------|
| 1 | Security Controls | `security` | Vulnerability management, dependency posture, attestations |
| 2 | Privacy & Data Protection | `privacy` | PII classification, encryption, retention, POPIA/GDPR |
| 3 | Evidence & Auditability | `evidence_auditability` | Evidence packs, snapshot chain, audit trail |
| 4 | Operational Resilience | `operations` | SLA/SLO targets, incident metrics, uptime |
| 5 | Integrations & Data Flow | `integration` | Marketplace, webhook signing, health checks |
| 6 | Hosting & Sovereignty | `hosting_sovereignty` | Deployment region, data residency, regulatory frameworks |
| 7 | Disaster Recovery | `disaster_recovery` | DR procedures, RTO/RPO, testing cadence |
| 8 | Verification Appendix | `verification` | How to verify pack integrity, signature, hash chain |

### Language Guardrails

- Avoid "certified compliant" — instead describe verifiable controls
- Reference regulatory alignment (POPIA, GDPR, PIPEDA, Québec Law 25)
  without claiming certification
- All claims are backed by evidence references

## Evidence References

Each answer includes `evidenceRefs` pointing to:

- **Evidence packs** — `evidence-pack:security-posture`
- **Compliance snapshots** — `compliance-snapshot:latest`
- **Policy files** — `ops/policies/financial-policies.yml`
- **Operational docs** — `ops/disaster-recovery/`, `ops/incident-response/`

## Integration with Procurement Pack

The RFP sections can be included in the signed Procurement Pack
by setting `includeRfp: true` in the export request:

```
POST /api/proof-center/export
Body: { "format": "zip", "includeRfp": true }
```

## Packages

- **`@nzila/platform-rfp-generator`** — Section definitions and rendering
- **`scripts/rfp-generate.ts`** — CLI entry point

## File Output

Default output: `docs/rfp/answers.md`

The script creates the output directory automatically if it doesn't exist.
