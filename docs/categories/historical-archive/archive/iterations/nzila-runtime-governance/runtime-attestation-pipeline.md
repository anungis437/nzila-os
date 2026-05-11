# Runtime Attestation Pipeline

> **Status:** Canonical runtime governance · **Layer:** Continuous attestation · **Inherits:** [../nzila-assurance/continuity-governance-attestation-model.md](../nzila-assurance/continuity-governance-attestation-model.md), [../nzila-assurance/governance-evidence-pipeline-architecture.md](../nzila-assurance/governance-evidence-pipeline-architecture.md)

The **runtime attestation pipeline** continuously generates governance attestation artifacts at deployment time, release time, and across the operating life of each release. Attestations are not narrative — they are typed, evidence-bound, release-linked, environment-linked artifacts.

---

## 1. Posture

The pipeline:

- **Generates** attestations at deterministic moments (release, deployment, environment provisioning, pilot activation)
- **Binds** every attestation to a release id and an environment identity
- **Cites** every supporting evidence record
- **Signs** at C4-targeted classes (signing infrastructure binding per assurance readiness review)
- **Refuses** to attest beyond cited evidence
- **Refuses** to attest in marketing register

An attestation that is generated without evidence is a future governance liability.

---

## 2. Generated Attestation Classes

- Deployment attestations
- Doctrine compliance attestations
- Continuity governance attestations
- Pilot-safety attestations
- AI governance attestations
- Environment legitimacy attestations

Each maps to a certification class in [institutional-certification-framework](../nzila-assurance/institutional-certification-framework.md).

---

## 3. Required Implementation Surfaces

Materialized in [packages/runtime-attestation](../../packages/runtime-attestation):

- **Signed attestation models** — typed shapes with optional signature envelopes
- **Attestation manifests** — per-release manifests that enumerate generated attestations
- **Immutable evidence references** — content-addressable references into the [governance evidence ledger](governance-evidence-ledger.md)
- **Release-linked attestations** — every attestation carries the immutable release id
- **Environment-linked attestations** — every attestation carries the verified environment identity

---

## 4. Required Output Shape

Minimal example:

```json
{
  "releaseId": "UE-2026-05-09-001",
  "environment": "pilot",
  "continuityGovernanceStatus": "verified",
  "deploymentLegitimacy": "verified",
  "pilotBoundaryStatus": "verified"
}
```

Canonical envelope:

```ts
interface RuntimeAttestation {
  readonly id: string
  readonly class: AttestationClass
  readonly releaseId: string
  readonly environment: string
  readonly subject: AttestationSubject
  readonly verdict: 'verified' | 'partial' | 'unverified' | 'rejected'
  readonly citedEvidence: readonly EvidenceReference[]
  readonly issuedBy: AttestationIssuer
  readonly issuedAt: string
  readonly window: { from: string; to: string }
  readonly signature?: AttestationSignature
}
```

---

## 5. Issuance Discipline

- An attestation is issued only when its required evidence set is present in the ledger
- A `partial` verdict is issued when partial evidence is present, with cited gaps
- An `unverified` verdict is issued when required evidence is absent
- A `rejected` verdict is issued when contrary evidence is present
- Marketing-grade attestations are categorically refused

---

## 6. Lifecycle

| Moment | Generated Attestations |
|--------|------------------------|
| Pre-deploy gate | Doctrine compliance, AI governance, pilot-safety |
| Deploy | Deployment, environment legitimacy |
| Post-deploy stabilization window | Continuity governance |
| Per pilot activation | Pilot-safety |
| Per environment provisioning | Environment legitimacy |
| Standing review cycle | Refresh of all classes per scope |

---

## 7. Signing Posture

Signing is layered:

- **Unsigned (today)** — typed, ledgered, citation-bearing artifacts; usable at C2–C3
- **Signed (next)** — signature envelope binding signer role, key provenance, signing time, subject hash; usable at C4
- **Externally verifiable (future)** — public verifiability via standard transparency primitives; required for C5

Tier claims must not exceed signing posture.

---

## 8. Immutability

Generated attestations are append-only at the artifact level. Corrections are entered as superseding attestations citing the prior id and the reason for supersession. In-place edits are forbidden.

---

## 9. Distribution

Attestations are surfaced to:

- Procurement evidence packs ([../nzila-assurance/procurement-assurance-framework.md](../nzila-assurance/procurement-assurance-framework.md))
- Standing readiness review ([../nzila-assurance/assurance-readiness-review.md](../nzila-assurance/assurance-readiness-review.md))
- Internal stewardship surfaces (governance-readable, calm)
- External certification engagements (when signing posture binds)

Attestations are not surfaced to marketing collateral.

---

## 10. Anti-Patterns

- Aspirational `verified` verdicts beyond cited evidence
- Generated-but-unstored attestations (no ledger reference)
- Cross-environment attestations (one attestation purporting to cover multiple environments)
- Attestation generation absent supporting governance event flow
- Marketing weaponization
- In-place editing of issued attestations
- Signing claimed where signing infrastructure is not bound

---

## 11. Discipline

Attestation is the institutional act of saying *here is what we have verified, here is the evidence, here is the scope, here is the issuer.* Said honestly, sustained continuously, it is the substrate of certifiable institutional trust.

Said loosely, it becomes the substrate of eventual external rejection. The pipeline is built to make the honest attestation the structurally easier one.
