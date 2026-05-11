# Reference: Package Catalogue

All packages in the Nzila OS monorepo, organized by domain.

## Core Platform

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/os-core` | Platform core: auth, policy, RBAC, telemetry, classification | Library |
| `@nzila/db` | Drizzle ORM schema and queries | Library |
| `@nzila/ui` | Shared React component library | Library |
| `@nzila/blob` | Azure Blob Storage client | Library |
| `@nzila/config` | Shared configuration | Library |

## AI / ML

| Package | Description | Role |
|---------|-------------|------|
| `@nzila/ai-core` | AI Control Plane: gateway, policy, redaction, budgets | Server-only |
| `@nzila/ai-sdk` | Client AI SDK — **mandatory entry point** | Client SDK |
| `@nzila/ml-core` | ML model registry and evidence | Server-only |
| `@nzila/ml-sdk` | Client ML SDK | Client SDK |
| `@nzila/ai-registry` | Model cards, NIST RMF, governance lifecycle | Library |

## Observability

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/otel-core` | Enhanced OTel: spans, cost attribution, SLOs | Library |
| `@nzila/platform-observability` | Lightweight metrics, health, correlation | Library |

## Security

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/secrets` | Azure Key Vault, secret rotation, scanning | Library |

## Commerce

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/commerce-core` | Commerce domain logic | Library |
| `@nzila/commerce-db` | Commerce database schema | Library |
| `@nzila/commerce-audit` | Commerce audit trails | Library |
| `@nzila/commerce-events` | Commerce event bus | Library |
| `@nzila/commerce-governance` | Commerce governance policies | Library |
| `@nzila/commerce-evidence` | Commerce evidence packs | Library |
| `@nzila/commerce-observability` | Commerce metrics | Library |

## Agriculture

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/agri-core` | Agriculture domain logic | Library |
| `@nzila/agri-db` | Agriculture database schema | Library |
| `@nzila/agri-adapters` | External service adapters | Library |
| `@nzila/agri-events` | Agriculture event bus | Library |
| `@nzila/agri-intelligence` | Agriculture AI/ML models | Library |
| `@nzila/agri-traceability` | Supply chain traceability | Library |

## Tooling

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/tools-runtime` | AI tool execution runtime | Library |
| `@nzila/analytics` | Analytics and reporting | Library |
| `@nzila/cli` | CLI tooling | CLI |

## Integrations

| Package | Description | Type |
|---------|-------------|------|
| `@nzila/chatops-slack` | Slack ChatOps integration | Library |
| `@nzila/chatops-teams` | Teams ChatOps integration | Library |

## Architecture Invariants

1. **SDK-only access**: Apps use `ai-sdk` / `ml-sdk`, never `ai-core` / `ml-core` directly
2. **Org scoping**: All queries include `orgId` — enforced by `os-core/policy`
3. **Evidence-first**: State mutations produce hash-chained evidence
4. **Stack authority**: Django apps don't mutate via Drizzle; Node apps don't use Django ORM
5. **Content vs Governance**: Apps read from `content/`, never from `governance/`
