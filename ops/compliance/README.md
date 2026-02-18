# Compliance

**Owner:** CISO / Platform Engineering  
**Review Cadence:** Quarterly

## Purpose

Central compliance hub for Nzila OS operational controls, evidence mapping,
and audit readiness documentation.

## Documents in This Directory

| Document | Description | Audience |
|---|---|---|
| [Required-Evidence-Map.md](Required-Evidence-Map.md) | Maps every operational control to evidence artifacts, storage, and verification | Auditors, CISO, Platform Eng |
| [Evidence-Storage-Convention.md](Evidence-Storage-Convention.md) | Azure Blob path conventions, retention classes, SAS policies | Platform Eng, Auditors |
| [Control-Test-Plan.md](Control-Test-Plan.md) | Periodic control test procedures (DR restore, access review, etc.) | Platform Eng, CISO |
| [Evidence-Pack-Index.schema.json](Evidence-Pack-Index.schema.json) | JSON schema for evidence pack index bundles | Developers, Automation |
| [Evidence-Pack-Index.example.json](Evidence-Pack-Index.example.json) | Filled example of an incident evidence pack | Developers, Auditors |

## Automation

- **Evidence Index Generator:** `tooling/scripts/generate-evidence-index.ts`
  - Generates evidence pack index JSON from a list of artifacts
  - See the script for usage instructions

## Key Concepts

- **Control → Evidence → Blob → Hash → Audit Trail** is the chain that proves controls operate
- Evidence lives in Azure Blob (`evidence` container), **never in git**
- Only generated index examples (JSON) are committed to the repo for reference
- SHA-256 hashing via `@nzila/blob` is the integrity mechanism
- `audit_events` hash chain provides immutable chronological proof

## References

- [Ops README](../README.md)
- [Blob Package](../../packages/blob/src/index.ts)
- [DB Schema — operations](../../packages/db/src/schema/operations.ts)
