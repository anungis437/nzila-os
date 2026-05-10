# Evidence Packs — Architecture

> Package: `@nzila/platform-evidence-pack`

## Overview

Orchestrated evidence pack export with tamper-verification. Builds on the existing `@nzila/os-core/evidence` seal infrastructure to provide pack lifecycle management, multi-format export, integrity verification, and retention policy enforcement.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│              Evidence Pack Platform                    │
│                                                       │
│  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │  Orchestrator     │  │  Exporter                 │ │
│  │  (lifecycle)      │  │  (JSON / ZIP bundle)      │ │
│  └──────┬───────────┘  └───────────┬───────────────┘ │
│         │                          │                 │
│  ┌──────▼──────────────────────────▼───────────────┐ │
│  │              Verifier                            │ │
│  │  (digest recompute, Merkle root, per-artifact)   │ │
│  └──────────────────────┬──────────────────────────┘ │
│                         │                            │
│  ┌──────────────────────▼──────────────────────────┐ │
│  │            Retention Manager                     │ │
│  │  (standard / extended / regulatory / permanent)  │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

## Pack Lifecycle

```
 draft → sealed → exported → verified → expired
   │                                       │
   └───────────────────────────────────────┘
                 (retention)
```

## Modules

### Orchestrator

- **createPack**: Zod validation, auto pack ID generation, artifact attachment
- **sealPack**: SHA-256 digest over canonicalized pack index + Merkle root over artifact hashes
- **getPack / listPacks**: Query by org
- **updateStatus**: Lifecycle state transitions

### Exporter

- **JSON export**: Pretty-printed pack index with metadata
- **ZIP bundle**: Base64-encoded artifact content, error isolation per artifact
- Requires sealed pack (rejects draft packs)

### Verifier

- Recomputes pack digest from canonical JSON
- Recomputes Merkle root from artifact SHA-256 hashes
- Verifies individual artifact integrity
- Returns per-artifact verification details

### Retention Manager

4 retention classes with configurable policies:

| Class | Default Retention | Archive | Delete |
|---|---|---|---|
| `standard` | 365 days | No | Yes |
| `extended` | 1,095 days (3 years) | Yes | No |
| `regulatory` | 2,555 days (7 years) | Yes | No |
| `permanent` | ∞ | No | No |

## Cryptographic Integrity

| Mechanism | Implementation |
|---|---|
| Pack digest | SHA-256 of canonicalized (sorted keys, stripped seal) JSON |
| Merkle root | Binary Merkle tree over ordered artifact SHA-256 hashes |
| Artifact integrity | SHA-256 hash of each artifact blob |
| Canonical JSON | Deterministic key ordering, no whitespace |

## Test Coverage

22 tests across 4 test files:

- Orchestrator: 8 tests (create, seal, lifecycle, validation)
- Verifier: 4 tests (valid pack, tampered digest, tampered artifact, missing seal)
- Exporter: 3 tests (JSON export, ZIP bundle, reject unsealed)
- Retention: 7 tests (policy evaluation, archive, delete, permanent retention)
