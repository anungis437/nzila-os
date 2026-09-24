# ⚠ Unsafe Claims — Buyer Risk Register

> Generated: 2026-09-24T13:02:14.003Z

These claims appear in customer-facing materials but lack supporting code evidence.
Each must be resolved before being included in procurement packs.

## Evidence scope of this report

Static repository inspection only. What that can establish:

- DESIGN — the claim is documented in a repository artifact
- IMPLEMENTED — supporting code/configuration exists in the working tree
- TESTED — only where the cited evidence for a claim names a test file

What it cannot establish, and must not be read as:

- DEPLOYED — no environment, image digest or release is inspected
- RUNTIME-VERIFIED — nothing is executed against a running system
- OPERATIONALLY PROVEN — no operational record is read
- Customer availability — entitlement/tenant state is not inspected
- Production readiness — readiness gates live in their own programme documents
- Procurement-safe truth — publishing a claim requires the evidence layers above

**Residual limitation:** This generator distinguishes evidence layers only as far as static repository inspection allows. Separating TESTED from IMPLEMENTED per claim, and attaching deployment/runtime evidence, would require a broader redesign (per-claim test attribution plus an environment evidence source). Until then, treat every status below as an implementation-evidence statement, never as a readiness or buyer-facing safety statement.

No registered claim is currently `docs-only` or `unsupported`: every claim in the registry
has code or configuration evidence in the working tree. That is an implementation-evidence
result only. It is not a buyer-facing safety conclusion, and it does not establish that any
claim is deployed, runtime-verified, operationally proven, available to customers, or
production-ready — none of those layers are inspected here. It is also silent about any
claim that is not in the registry.
