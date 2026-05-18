# Union Eyes — Public-Safe Architecture Summary

> **Audience:** External reviewers, buyers, integration partners.
> **Scope:** High-level architecture summary safe for external distribution.
> **Caveats:** This document does not include internal system credentials, third-party
> API keys, private infrastructure topology details, or client-specific configurations.
> Detailed architecture documentation is available to qualified buyers under NDA.

---

## Overview

Union Eyes is a governed institutional operating platform designed for labour organisations,
unions, and associations. It is built to support:

- Member representation and casework management
- Grievance and claims tracking
- Finance and dues administration
- Education and organising workflows
- Governance and compliance operations
- Communications and document management
- Analytics and reporting

The platform is designed with institutional trust, data privacy, and governed operations
as foundational architectural requirements.

---

## Application Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) with server-side rendering |
| API layer | Next.js API routes with role-based governance wrappers |
| Database | PostgreSQL with Drizzle ORM |
| Authentication | Server-side session management |
| Internationalisation | Canadian English and French (primary); Italian and Portuguese (secondary) |
| Runtime environment | Node.js |

---

## Governance Architecture

Union Eyes includes a layered governance architecture built across ten implementation waves:

| Wave | Capability |
|------|-----------|
| 1 | Database migration lineage and SHA-256 manifest |
| 2 | 800+ route governance registry |
| 3 | Runtime middleware activation with layered rate limiting |
| 4 | Route policy orchestration engine |
| 5 | Server-side RBAC enforcement (985 tests) |
| 6 | Public-experience governance primitives |
| 7 | Governance policy orchestration and federation inheritance |
| 8 | Governance observability and evidence correlation |
| 9 | Governance digital twin and operational simulation fabric |
| 10 | Sovereign federation execution fabric |

All governance layers operate in shadow mode unless explicitly noted. No governance layer
blocks production operations autonomously.

---

## Role Architecture

The platform supports the following role-based experience lanes:

| Role | Primary Surface |
|------|----------------|
| Member | Intake submission, status tracking, inbox |
| Steward | Casework, priorities, work management |
| Staff | Administrative operations, case support |
| Executive | Leadership intelligence, reporting |
| Governance | Policy, audit, and compliance surfaces |
| Admin | Platform administration and configuration |

---

## Federation Architecture

Union Eyes is designed to support federated labour organisations with multiple governance
tiers. The federation sovereignty layer models national, regional, local, affiliate, and
coalition units with:

- Delegated authority chains
- Sovereignty mode classification
- Conflict detection and classification
- Continuity sharing semantics
- AI governance jurisdiction per tier

This layer operates entirely in shadow mode and does not alter production data.

---

## Evidence and Auditability

Union Eyes is designed to produce verifiable evidence for procurement and governance review:

- **Generated reports:** Route registry, governance simulation summary, federation sovereignty summary
- **CI governance gates:** 6 automated governance validation checks
- **Trust center:** Buyer-readable evidence documents and machine-readable manifest
- **Migration manifest:** SHA-256 lineage of all database schema changes
- **Audit ledgers:** Three separate ledgers (observability, simulation, sovereignty) with
  retention governance

---

## What This Platform Is Not

| Not | Why it matters |
|-----|---------------|
| A legal advice platform | AI features are advisory; no binding legal determinations |
| A fully autonomous governance system | All governed decisions require human authorisation |
| A blockchain or distributed ledger | Governance is centralised and institutionally controlled |
| A certification-holder | No certifications are claimed beyond what is documented in the evidence manifest |

---

*For detailed procurement evidence, see [PROCUREMENT_EVIDENCE_MAP.md](./PROCUREMENT_EVIDENCE_MAP.md).*
*For the machine-readable evidence manifest, see `reports/trust-center-evidence-manifest.json`.*
