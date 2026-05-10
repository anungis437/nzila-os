# Compliance Snapshots — Architecture

> Package: `@nzila/platform-compliance-snapshots`

## Overview

Immutable, SHA-256 hash-chained compliance snapshots for audit readiness. Each snapshot captures the full compliance posture of an org at a point in time, and is cryptographically chained to its predecessor to form a tamper-evident audit trail.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│           Compliance Snapshots Platform                │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Collector    │  │  Hash Chain  │  │  Verifier   │ │
│  │  (controls)   │  │  (SHA-256)   │  │  (integrity)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼──────┐ │
│  │              Snapshot Generator                   │ │
│  │    collect → chain → persist → status update      │ │
│  └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

## Hash Chain Model

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Snap v1  │ ──▶ │ Snap v2  │ ──▶ │ Snap v3  │
│ prev: ∅  │     │ prev: h1 │     │ prev: h2 │
│ hash: h1 │     │ hash: h2 │     │ hash: h3 │
└──────────┘     └──────────┘     └──────────┘
```

Each chain entry stores:

- `snapshotHash`: SHA-256 of the canonical snapshot JSON
- `previousHash`: Hash of the prior entry (null for genesis)
- Breaking any link invalidates all subsequent entries

## Control Families

9 compliance control families:

| Family | Domain |
|---|---|
| `access` | Access control policies and reviews |
| `change-mgmt` | Change management processes |
| `incident-response` | Incident detection and response |
| `dr-bcp` | Disaster recovery and business continuity |
| `integrity` | Data and system integrity |
| `sdlc` | Software development lifecycle |
| `retention` | Data retention and disposal |
| `data-governance` | Data classification and handling |
| `security-operations` | Security monitoring and operations |

## Modules

### Collector

- Fetches compliance controls from configured sources via `CollectorPorts`
- Computes summary statistics: compliant, non-compliant, partial, not-assessed
- Calculates compliance score: `(compliant + partial × 0.5) / assessed × 100`
- Validates snapshot against Zod schema

### Hash Chain

- `computeSnapshotHash(snapshot)`: Deterministic SHA-256 via canonical JSON (sorted keys)
- `SnapshotChain.append(snapshot)`: Links to previous entry's hash
- `SnapshotChain.verify(orgId)`: Validates entire chain linkage
- Genesis entry has `previousHash: null`

### Generator

- Orchestrates: collect → persist → chain → status update
- Auto-increments version per org
- Returns both snapshot and chain entry

### Verifier

- **Snapshot verification**: Recompute hash, match against chain entry
- **Chain verification**: Validate all links + recompute individual hashes
- Detects: missing snapshots, tampered content, broken chain links

## Compliance Score Formula

$$\text{score} = \frac{\text{compliant} + 0.5 \times \text{partial}}{\text{total} - \text{notAssessed}} \times 100$$

## Test Coverage

29 tests across 4 test files:

- Collector: 6 tests (summary computation, collection, metadata, empty controls)
- Chain: 10 tests (hashing, genesis, linkage, verification, tampering)
- Generator: 6 tests (lifecycle, versioning, chaining, retrieval)
- Verifier: 7 tests (snapshot verification, chain verification, tampering detection)
