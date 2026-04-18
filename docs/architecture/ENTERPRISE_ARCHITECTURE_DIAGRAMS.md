# Enterprise Architecture Diagram Guide

## Purpose

This document defines the diagram set used in enterprise due diligence and procurement discussions.
It does not claim architecture capabilities beyond current implementation evidence.

## Diagram Set

1. Product and Platform Context
- Shows top-level products and shared platform services.
- Source references:
  - governance/portfolio/product-catalog.json
  - nzila-truth-manifest.json

2. Identity and Access Architecture
- Shows @nzila/platform-auth, Argon2id session model, and optional Entra SSO path.
- Source references:
  - docs/governance/enterprise-readiness.md
  - docs/governance/security-overview.md

3. Workflow and Orchestration Architecture
- Shows application workflow dispatch to orchestrator-api and execution lifecycle.
- Source references:
  - apps/orchestrator-api/src/contract.ts
  - apps/union-eyes/lib/orchestrator-dispatch.ts
  - apps/flow/lib/orchestrator-dispatch.ts

4. Data and Audit Architecture
- Shows operational DB tables, event trails, and evidence-pack outputs.
- Source references:
  - packages/db/src/schema/
  - docs/governance/audit-logging-model.md

5. Deployment and Operations Architecture
- Shows managed cloud deployment model and operational governance boundaries.
- Source references:
  - docs/buyers/deployment-models.md
  - docs/governance/bcp-dr-overview.md

## Required Diagram Metadata

Each diagram must include:
- Date and version
- Author/owner
- Source-of-truth files
- Assumptions and out-of-scope notes

## Update Policy

- Update diagrams on any major architecture change affecting identity, data flow, or deployment topology.
- Diagrams must be reviewed as part of enterprise buyer pack refresh before external sharing.
