# Governance Evidence Ledger

> **Status:** Canonical runtime governance · **Layer:** Append-only evidence substrate · **Inherits:** [../nzila-assurance/governance-evidence-pipeline-architecture.md](../nzila-assurance/governance-evidence-pipeline-architecture.md), [../nzila-assurance/automated-governance-evidence-system.md](../nzila-assurance/automated-governance-evidence-system.md)

The **governance evidence ledger** is the append-only substrate that holds the authoritative record of every governance-bearing event, decision, attestation, and review across Nzila products. It is the system of record that makes assurance defensible at any future moment.

---

## 1. Posture

The ledger:

- **Is append-only** at the record level
- **Is content-addressable** for tamper-evidence
- **Is release-linked** and **environment-linked**
- **Is doctrine-cited** — every record references the doctrine policy or attestation class it bears on
- **Is retention-governed** per class
- **Is access-governed** — not all records are universally readable
- **Is anti-surveillance-safe** — refuses individual-resolving payloads

The ledger is the institution's memory of how it actually behaved.

---

## 2. Defined Properties

### 2.1 Evidence Immutability
- Records are never edited in place
- Corrections are entered as superseding records citing the prior record and the reason
- Audit trail of supersession is itself ledgered

### 2.2 Evidence Traceability
- Each record traces forward to certifications, attestations, and packages it supports
- Each record traces backward to source surface, originating change, reviewer
- Each record traces laterally to related records bearing on the same subject

### 2.3 Release-Linked Evidence
- Every record carries the release id under which the originating event occurred
- Release id binds to the [runtime attestation pipeline](runtime-attestation-pipeline.md) manifest

### 2.4 Deployment-Linked Evidence
- Deployment-class records bind to the deployment manifest, environment identity, and approval chain

### 2.5 Governance-Linked Evidence
- Governance review records carry verdict, dimension findings, reviewer role, and forum identity

### 2.6 Attestation Lineage
- Generated attestations cite the underlying ledger records that supported issuance
- Superseding attestations cite the superseded id and reason

### 2.7 Evidence Retention Governance
- Retention windows are class-bound (per [governance telemetry architecture](governance-telemetry-architecture.md) §7)
- Retention beyond purpose is itself a doctrine defect
- Retention prior to purpose-bound horizon is itself a doctrine defect (no premature pruning)

---

## 3. Record Shape

```ts
interface LedgerRecord {
  readonly id: string                    // ULID
  readonly contentHash: string           // sha-256 over canonical payload
  readonly type: GovernanceEvidenceType
  readonly subject: EvidenceSubject
  readonly scope: EvidenceScope
  readonly releaseId: string
  readonly environment: string
  readonly doctrineCitation?: DoctrineCitation
  readonly payload: EvidencePayload      // schema-validated
  readonly emittedAt: string
  readonly ingestedAt: string
  readonly supersedes?: string           // prior record id, if correction
  readonly supersededBy?: string         // populated by later record (forward link)
  readonly retentionClass: RetentionClass
  readonly accessClass: AccessClass
  readonly signature?: LedgerSignature
}
```

---

## 4. Anti-Surveillance Constraints

The ledger refuses, by construction:

- Individual identifiers in payload outside aggregation-safe hashes
- Free-form behavioral attribution
- Personal text snippets beyond what the source already governs
- Cross-environment correlation that resolves individuals
- Universally-readable sensitive class records (access governance applies)

---

## 5. Future-Compatible Architecture

The ledger is designed to evolve toward:

- **Signed evidence** — record signature envelopes (signer role, key provenance, signing time, content hash)
- **Cryptographic verification** — content-hash-based external verifiability
- **Tamper-evident logs** — integration with industry-standard transparent logs
- **External audit compatibility** — exportable audit trail surfaces in standard formats
- **Verifiable retention proofs** — proofs that retention horizons were honored
- **Verifiable supersession chains** — chained correction proofs

The architecture does not depend on any single ledger technology. Substrate is pluggable.

---

## 6. Storage Posture

Storage choice is operational, not doctrinal. The ledger may be implemented atop:

- Append-only relational tables with content-hash indexing
- Object storage with manifest indexing
- Future integration with verifiable log services

Choice is governed at architectural review and recorded in the assurance readiness review.

---

## 7. Access Discipline

- Public class records are openly readable
- Governance-only class records require steward role
- Regulator-grade records require specific reviewer roles or external counterparty contracts
- Access events are themselves ledgered (access on the ledger is a governance event)

---

## 8. Anti-Patterns

- In-place edits ("just fix the typo")
- Selective retention ("we don't need that one")
- Universal readability ("just expose it all")
- Marketing extraction
- Premature pruning to reduce storage cost
- Retention beyond purpose
- Surveillance-grade payload bloat
- Ledgering for the appearance of governance without binding to attestations

---

## 9. Discipline

The ledger is the institution's memory. A memory that is editable is a memory that cannot be trusted. A memory that surveils is a memory that destroys trust. A memory that forgets prematurely is a memory that cannot defend the past.

The ledger is built to be the institution's honest, lasting, governance-safe memory — and through that, the substrate of every external assurance act.
