# Security Overview

## Scope

Security posture for Nzila OS shared platform and flagship products.
This overview is factual and aligned to current implementation evidence.

## Identity and Access

- Primary auth system: @nzila/platform-auth
- Session model: Argon2id-hashed credentials with opaque server-side sessions
- Optional federation: Microsoft Entra ID SSO
- Authorization: org-scoped access and role-based checks per app

## Application Security Controls

- Input validation at API boundaries
- Dependency audit workflow and policy checks
- Controlled secrets in Azure Key Vault for deployed environments
- Least-privilege service configuration by workload

## Operational Security

- Incident escalation model documented in incident-response-summary.md
- Vulnerability intake and disclosure policy documented in vulnerability-disclosure-policy.md
- Evidence-first governance posture for production claims

## Current Boundaries

- No unsupported certification claims are made in this document.
- Security readiness is represented through evidence and control operation, not labels.
