# Evidence Pack Lifecycle & Sealed Integrity

> **Invariants**: INV-14 (Draft in-memory only), INV-15 (Seal-once), INV-16 (Redaction re-seal), INV-17 (verify-pack CLI)

## Status State Machine

```
  draft ──→ sealed ──→ verified
                  ╲         │
                   ╲        ▼
                    ╲──→ expired
```

| Transition          | Trigger                    |
|---------------------|----------------------------|
| draft → sealed      | `draft.seal()` — one-shot  |
| sealed → verified   | `markVerified()` in DB     |
| sealed → expired    | `markExpired()` in DB      |
| verified → expired  | `markExpired()` in DB      |

All other transitions throw `LifecycleTransitionError`.

## Key Rule: Drafts Never Leave Memory (INV-14)

An `EvidencePackDraft` is an in-memory builder. It has no DB row, no blob.
Only after `draft.seal()` produces a `SealedEvidencePack` can the pack be
persisted via `processEvidencePack()` or `persistSealedEvidencePack()`.

```ts
const draft = createEvidencePackDraft({ packId, orgId, ... })
draft.addArtifact(artifact1)
draft.addArtifact(artifact2)
const sealed = draft.seal()
// sealed.status === 'sealed', sealed.seal is a SealEnvelope
```

## Key Rule: Seal-Once (INV-15)

Calling `draft.seal()` a second time throws `SealOnceViolationError`.
After sealing:

- `draft.addArtifact()` → throws `DraftMutationError`
- `draft.seal()` → throws `SealOnceViolationError`
- The returned `SealedEvidencePack` is `Object.freeze()`-ed

## Key Rule: Redaction Re-Seal (INV-16)

When producing a redacted copy for partner/public audiences, `redactAndReseal()`
strips PII fields, removes restricted artifact types, then generates a **fresh
seal** over the redacted content. The original pack digest is preserved as
`originalPackDigest` for provenance.

```ts
const { index, seal } = redactAndReseal(sealedIndex, 'partner')
// index.redactedFor === 'partner'
// index.originalPackDigest links back to the source pack
// seal covers the redacted content
```

## verify-pack CLI (INV-17)

```bash
npx tsx packages/os-core/src/evidence/verify-pack.ts <pack-index.json> \
  [--hmac-key <key>] [--artifacts-dir <dir>] [--json]
```

Checks:

1. Seal integrity (digest + Merkle root)
2. HMAC signature (if key provided)
3. Artifact file hashes (if `--artifacts-dir` provided)

Exit 0 = all pass, Exit 1 = failure, Exit 2 = usage error.

Programmatic API: `import { verifyPackIndex } from '@nzila/os-core/evidence/verify-pack'`

## Persistence Gate

Before writing any evidence pack to DB/Blob, call:

```ts
assertSealed(pack) // throws if pack.status !== 'sealed' or seal missing
```

Or use the type guard:

```ts
if (isSealedEvidencePack(pack)) {
  // TypeScript narrows to SealedEvidencePack
}
```

## Contract Tests

| Test ID | File | What it proves |
|---------|------|----------------|
| INV-14 | `evidence-lifecycle.test.ts` | Draft is memory-only, cannot persist |
| INV-15 | `evidence-lifecycle.test.ts` | Re-seal throws, addArtifact after seal throws |
| INV-16 | `evidence-lifecycle.test.ts` | Redacted copies get fresh seal |
| INV-17 | `evidence-lifecycle.test.ts` | verify-pack validates/invalidates correctly |
| INV-12 | `evidence-seal-mandatory.test.ts` | Unsealed persistence blocked |
| INV-13 | `evidence-seal-mandatory.test.ts` | verifySeal CI functional |

## Files Changed (PR-03)

| File | Change |
|------|--------|
| `packages/os-core/src/evidence/lifecycle.ts` | **NEW** — State machine, draft builder, SealOnceViolationError |
| `packages/os-core/src/evidence/verify-pack.ts` | **NEW** — CLI + programmatic verification |
| `packages/os-core/src/evidence/redaction.ts` | Added `redactAndReseal()` |
| `packages/os-core/src/evidence/types.ts` | Added `seal` field to `EvidencePackResult` |
| `packages/os-core/src/evidence/generate-evidence-index.ts` | Returns `seal` in result |
| `packages/os-core/src/evidence/index.ts` | Re-exports lifecycle, redaction, verify-pack symbols |
| `packages/os-core/package.json` | Added export entries for lifecycle, verify-pack, seal |
| `tooling/contract-tests/evidence-lifecycle.test.ts` | **NEW** — 48 tests for INV-14/15/16/17 |
| `CODEOWNERS` | Added platform+security ownership for evidence modules |
