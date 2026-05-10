# Why Evidence-First Architecture

## The Problem

Enterprise platforms need audit trails that are:

- **Tamper-evident** — You can detect if someone modified a log after the fact
- **Complete** — Every state mutation is recorded
- **Queryable** — Auditors can trace any decision back to its evidence
- **Compliant** — Meets SOC 2 Type II, ISO 27001 evidence requirements

Traditional audit logging (append rows to a table) fails because:

- Rows can be silently deleted or modified
- No chain of custody between entries
- No way to verify completeness

## The Nzila Solution: Hash-Chained Evidence

Every state mutation in Nzila produces an **evidence entry** that includes:

```
entry_hash = SHA-256(payload + previous_hash)
```

This creates an append-only chain where:

- **Tampering is detectable**: Changing any entry breaks the hash chain
- **Completeness is verifiable**: Missing entries create gaps in the chain
- **Non-repudiation**: Each entry includes actor, timestamp, and org context

## Where Evidence Is Produced

| System | Evidence Type | Implementation |
|--------|--------------|----------------|
| AI Gateway | Request logs | `@nzila/ai-core/logging.ts` — hash-chained with AES-256-GCM encryption |
| AI Actions | Attestation | `@nzila/ai-core/actions/attestation.ts` — self-hashing evidence JSON |
| Commerce | Transactions | `@nzila/commerce-evidence` — trade evidence packs |
| ML Models | Inference runs | `@nzila/ml-core/evidence/collector.ts` — datasets, models, runs |
| Platform | Auth decisions | `@nzila/os-core/policy/zero-trust.ts` — authorization decision logs |
| OTel | Trace correlation | `@nzila/otel-core/evidence-correlation.ts` — W3C trace context in evidence |

## How It Works in Practice

```typescript
// Every AI request is logged with hash chaining
import { logAiRequest } from '@nzila/ai-core/logging';

// Each entry includes:
// - Request payload (encrypted if sensitive/regulated)
// - SHA-256 hash of (entry + previous_entry_hash)
// - Actor (userId, orgId)
// - Timestamp
// - Model/deployment used
```

## Verification

The compliance pipeline (`.github/workflows/compliance.yml`) runs daily evidence
collection that:

1. Snapshots current policy files with SHA-256 hashes
2. Verifies OTel instrumentation coverage across all 12 apps
3. Validates evidence chain integrity

## Design Decision: Why Not Blockchain?

A blockchain is overkill for our use case:

- Our evidence chain is within a single organization
- We don't need Byzantine fault tolerance
- SHA-256 hash chaining provides the same tamper-evidence
- Much simpler, faster, and cheaper

The key insight: **tamper-evidence** (detect modifications) is more valuable
than **tamper-proof** (prevent modifications) for enterprise compliance.
