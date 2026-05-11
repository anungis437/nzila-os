# Third-Party Risk Register

> Scope: All external vendors, cloud providers, SaaS tools, and open-source supply chain dependencies that Nzila OS relies on in production.
> Reviewed: Quarterly. Owner: Platform Engineering + Security.

---

## Risk Tiers

| Tier | Criteria | Review frequency |
|---|---|---|
| **Critical** | Production data in scope; outage causes user-visible failure | Quarterly |
| **High** | Significant blast radius; sensitive config or credentials | Semi-annual |
| **Medium** | Dev/staging only or limited blast radius | Annual |
| **Low** | Tooling, CLI, no production data | On major version changes |

---

## Cloud Infrastructure

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Microsoft Azure** | Container Apps, PostgreSQL Flexible, Blob Storage, Key Vault | Critical | PII, financial records | Canada Central | DPA signed; PIPEDA compliant; Microsoft Azure Canada data boundary commitment |
| **Microsoft Azure** | Azure OpenAI (East US / East US 2) | Critical | Prompt content (must be anonymised) | US (exception) | No training commitment (DPA); PII scrubbing enforced in `packages/ai-core/` |
| **Microsoft Azure** | Azure Active Directory / Entra ID | Critical | Auth tokens, group memberships | US | Microsoft 365 DPA; token claims only — no PII in JWT payload |
| **Microsoft GitHub** | Actions, Packages, Code Hosting | High | Source code, CI secrets | US (runners) | No production data in CI; secrets via GitHub Secrets + OIDC |

## Authentication & Identity

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Microsoft Entra** | SSO, group-based RBAC | Critical | User identity, group memberships | US (AAD) | Minimal claims; `activeOrgId` resolved app-side — never stored |

## Security & Compliance Tooling

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Snyk** | Dependency vulnerability scanning | High | Package manifests, lock files | US | No source code sent; manifests only; org `anungis437`; OAuth token scoped to scan |
| **Trivy** (Aqua Security) | Container image CVE scanning | High | Container layer manifests | Local / GitHub Actions runner | Open-source; no data leaves runner |
| **GitHub Dependabot** | Dependency alerts | Medium | Package manifests | US (GitHub) | Public advisory DB; no PII |

## Payments

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Stripe** | Payment processing (Zonga) | Critical | Card data (tokenised), transaction records | US + Canada | PCI-DSS SAQ A; Stripe handles all card data — Nzila never stores raw card numbers; webhook signatures verified |

## Media & Storage

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Azure Blob Storage** | Media uploads, evidence packs, exports | Critical | Binary media, compliance evidence | Canada | Encryption at rest (AES-256); managed identity access; no public blobs |

## Monitoring & Observability

| Vendor | Service | Tier | Data in scope | Residency | Mitigations |
|---|---|---|---|---|---|
| **Azure Application Insights** | APM, distributed traces | High | Request metadata, structured logs | Canada / US (configured) | PII scrubbing in logger middleware; `cloud_RoleName` only — no user IDs in spans |
| **Azure Log Analytics** | Log aggregation, KQL queries | High | Structured log events | Canada | Same PII controls as App Insights |

## Open-Source Supply Chain

High-criticality packages monitored via Snyk + pnpm audit:

| Package | Usage | Risk | Mitigation |
|---|---|---|---|
| `next` | All apps | Critical — RCE/XSS vectors | Pinned; `pnpm overrides` for CVE patches; Dependabot alerts |
| `drizzle-orm` | DB layer | High — query injection surface | Parameterised queries enforced; no string interpolation |
| `argon2` | Password hashing | Critical — must not downgrade | Locked version; OWASP params enforced in `@nzila/platform-auth` |
| `secrets.js-grempe` | Shamir threshold crypto | High — break-glass path | Version pinned; no upgrade without security review |
| `jose` | JWT verification | High — auth bypass if misconfigured | Algorithm allowlist enforced (`RS256` only) |
| `@azure/identity` | Managed identity auth | High | Official Microsoft SDK; auto-updated via Dependabot |

---

## Supply Chain Controls

### Dependency Integrity

- `pnpm-lock.yaml` committed and enforced in CI (`pnpm install --frozen-lockfile`)
- All packages resolved via public npm registry; no private mirrors without approval
- `pnpm audit --audit-level=high` run in every CI pipeline (Dependency Audit workflow #336)
- Snyk scan: `snyk test --all-projects --severity-threshold=high`
- Active waivers tracked in `tooling/security/supply-chain-policy.ts` `ACTIVE_WAIVERS`

### Container Image Supply Chain

- Trivy scans Dockerfile and layers for CRITICAL CVEs before every merge to main
- Base images pinned by digest where possible; no `latest` tags in production
- `.trivyignore` for documented false positives only — each entry requires a comment and expiry date

### Infra-as-Code Supply Chain

- Azure Container Apps deployed via `az containerapp update` — no third-party Terraform providers in critical path
- Secrets injected via Azure Key Vault references — never baked into images

---

## Vendor Incident Notification

If a vendor suffers a breach or discloses a vulnerability affecting our use:

1. Assess scope within 4 hours of notification
2. If production data affected: open Sev 1 incident (see `ALERTING_RUNBOOK.md`)
3. If credentials affected: rotate immediately via Key Vault; no grace period
4. If CVE in dependency: patch within 24 h (Critical) or 1 week (High) per `SECURITY.md`

---

## Review Log

| Quarter | Reviewer | Changes |
|---|---|---|
| Q2 2026 | Platform Engineering | Initial register created |

Next review: Q3 2026
