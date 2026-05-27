# Package Ownership & Classification — Nzila OS

> Anti-entropy guardrail: every shared package must have a declared owner,
> category, stability level, and allowed dependents.

## Categories

| Code | Meaning |
|------|---------|
| `PLATFORM_CORE` | Foundational platform infrastructure used by most apps and packages |
| `DOMAIN_SHARED` | Shared domain logic serving a specific vertical (commerce, agri, mobility, trade) |
| `APP_SUPPORT` | Packages that exist to support one or a small number of apps |
| `APP_LOCAL_EXTRACTION` | Logic extracted from a single app that has not yet been promoted to shared |
| `DEPRECATED` | Scheduled for removal; replacement documented |

## Stability Levels

| Level | Meaning |
|-------|---------|
| `STABLE` | Production-hardened; breaking changes require RFC |
| `EVOLVING` | Actively developed; breaking changes possible with notice |
| `EXPERIMENTAL` | May be removed or restructured without notice |
| `DEPRECATED` | No new features; migration path documented |

## Package Registry

### Platform Core

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/os-core` | platform | STABLE | apps/*, packages/* | Core OS primitives |
| `@nzila/db` | platform | STABLE | apps/*, packages/* | Database client + schema |
| `@nzila/config` | platform | STABLE | apps/*, packages/* | Shared configuration |
| `@nzila/org` | platform | STABLE | apps/*, packages/* | Org context + multi-tenancy |
| `@nzila/blob` | platform | STABLE | apps/*, packages/* | Blob storage abstraction |
| `@nzila/ui` | platform | STABLE | apps/* | Shared UI component library |
| `@nzila/otel-core` | platform | STABLE | apps/*, packages/platform-* | OpenTelemetry base config |
| `@nzila/secrets` | platform | STABLE | apps/*, packages/platform-* | Secret management |
| `@nzila/evidence` | platform | STABLE | apps/*, packages/* | Evidence pack sealing + verification |
| `@nzila/platform-utils` | platform | STABLE | apps/*, packages/* | Cross-cutting platform utilities |
| `@nzila/platform-policy-engine` | platform | STABLE | apps/*, packages/* | Policy evaluation engine |
| `@nzila/platform-governance` | platform | STABLE | apps/*, packages/platform-* | Governance status + audit timeline |
| `@nzila/platform-observability` | platform | STABLE | apps/*, packages/* | Observability hooks + metrics |
| `@nzila/platform-events` | platform | STABLE | apps/*, packages/* | Event emission + consumption |
| `@nzila/platform-event-fabric` | platform | EVOLVING | apps/*, packages/platform-* | Advanced event routing + orchestration |
| `@nzila/platform-evidence-pack` | platform | STABLE | apps/*, packages/* | Evidence pack generation |
| `@nzila/platform-export` | platform | STABLE | apps/*, packages/* | Data export pipelines |
| `@nzila/platform-metrics` | platform | STABLE | apps/*, packages/* | Metrics collection + aggregation |
| `@nzila/platform-performance` | platform | STABLE | apps/*, packages/* | Performance budgets + monitoring |
| `@nzila/platform-isolation` | platform | STABLE | apps/*, packages/platform-* | Org isolation enforcer |
| `@nzila/platform-proof` | platform | STABLE | apps/*, packages/platform-* | Proof generation + verification |
| `@nzila/platform-feature-flags` | platform | EVOLVING | apps/*, packages/* | Feature flag evaluation |
| `@nzila/platform-environment` | platform | STABLE | apps/*, packages/platform-* | Environment management |
| `@nzila/platform-deploy` | platform | EVOLVING | apps/*, packages/platform-* | Deployment orchestration |
| `@nzila/platform-change-management` | platform | EVOLVING | apps/*, packages/platform-* | Change request lifecycle |
| `@nzila/platform-compliance-snapshots` | platform | STABLE | apps/*, packages/platform-* | Compliance snapshot generation |
| `@nzila/platform-procurement-proof` | platform | STABLE | apps/*, packages/platform-* | Procurement evidence packs |
| `@nzila/platform-assurance` | platform | STABLE | apps/*, packages/platform-* | Assurance + audit attestation |
| `@nzila/platform-validation` | platform | STABLE | scripts/*, tooling/* | Architecture + doc validation |
| `@nzila/platform-rfp-generator` | platform | STABLE | apps/control-plane | RFP document generation |
| `@nzila/platform-ops` | platform | STABLE | apps/*, scripts/* | Operational tooling |
| `@nzila/platform-rum` | platform | EXPERIMENTAL | apps/* | Real user monitoring |
| `@nzila/platform-cost` | platform | EVOLVING | apps/control-plane, packages/platform-* | Cost attribution + FinOps |
| `@nzila/platform-marketplace` | platform | EVOLVING | apps/control-plane, apps/web | Marketplace integration |
| `@nzila/data-lifecycle` | platform | EVOLVING | apps/*, packages/* | Data retention + lifecycle |
| `@nzila/tools-runtime` | platform | STABLE | apps/*, packages/* | Shared runtime utilities |

### AI / Intelligence

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/ai-core` | ai-platform | STABLE | packages/ai-*, packages/platform-ai-*, apps/* | Core AI primitives |
| `@nzila/ai-sdk` | ai-platform | STABLE | apps/*, packages/* | AI SDK for app consumption |
| `@nzila/ai-registry` | ai-platform | EVOLVING | packages/platform-ai-*, apps/control-plane | AI/ML model registry |
| `@nzila/ml-core` | ai-platform | STABLE | packages/ml-*, packages/platform-* | ML pipeline core |
| `@nzila/ml-sdk` | ai-platform | STABLE | apps/*, packages/* | ML SDK for app consumption |
| `@nzila/platform-intelligence` | ai-platform | EVOLVING | apps/*, packages/platform-* | Cross-app intelligence + signals |
| `@nzila/platform-ai-query` | ai-platform | EVOLVING | apps/*, packages/platform-* | NL query with evidence |
| `@nzila/platform-anomaly-engine` | ai-platform | EVOLVING | apps/*, packages/platform-* | Anomaly detection engine |
| `@nzila/platform-agent-workflows` | ai-platform | EVOLVING | apps/*, packages/platform-* | Event-driven agent workflows |
| `@nzila/platform-ai-governance` | ai-platform | EVOLVING | apps/*, packages/platform-* | Model registry + prompt governance |
| `@nzila/platform-ai-contract` | ai-platform | STABLE | packages/platform-ai-*, packages/ai-* | Canonical AI output schemas |
| `@nzila/platform-governed-ai` | ai-platform | EVOLVING | apps/*, packages/platform-* | Governed AI wrapper |
| `@nzila/platform-reasoning-engine` | ai-platform | EXPERIMENTAL | packages/platform-* | Reasoning + chain-of-thought |
| `@nzila/platform-semantic-search` | ai-platform | EVOLVING | apps/*, packages/platform-* | Semantic search index |
| `@nzila/platform-context-orchestrator` | ai-platform | EVOLVING | packages/platform-* | Context window orchestration |
| `@nzila/platform-knowledge-registry` | ai-platform | EVOLVING | packages/platform-* | Knowledge graph registry |
| `@nzila/platform-decision-engine` | ai-platform | EVOLVING | apps/*, packages/platform-* | Decision evaluation engine |
| `@nzila/platform-decision-graph` | ai-platform | EVOLVING | apps/*, packages/platform-* | Decision dependency graph |
| `@nzila/platform-ontology` | ai-platform | EVOLVING | packages/platform-* | Domain ontology definitions |
| `@nzila/platform-entity-graph` | ai-platform | EVOLVING | packages/platform-* | Entity relationship graph |
| `@nzila/platform-data-fabric` | ai-platform | EXPERIMENTAL | packages/platform-* | Cross-domain data fabric |
| `@nzila/mobility-ai` | ai-platform | EVOLVING | apps/mobility*, packages/mobility-* | Mobility-specific AI |

### Commerce Domain

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/commerce-core` | commerce | STABLE | apps/*, packages/commerce-* | Commerce domain model |
| `@nzila/commerce-db` | commerce | STABLE | packages/commerce-*, apps/flow, apps/web | Commerce database |
| `@nzila/commerce-events` | commerce | STABLE | packages/commerce-*, apps/* | Commerce event contracts |
| `@nzila/commerce-state` | commerce | STABLE | packages/commerce-*, apps/* | Commerce state machines |
| `@nzila/commerce-services` | commerce | STABLE | apps/*, packages/commerce-* | Commerce service layer |
| `@nzila/commerce-audit` | commerce | STABLE | packages/commerce-*, apps/* | Commerce audit trail |
| `@nzila/commerce-evidence` | commerce | STABLE | packages/commerce-*, apps/* | Commerce evidence packs |
| `@nzila/commerce-governance` | commerce | STABLE | packages/commerce-*, apps/* | Commerce governance rules |
| `@nzila/commerce-observability` | commerce | STABLE | packages/commerce-* | Commerce telemetry |
| `@nzila/commerce-integration-tests` | commerce | STABLE | (test only) | Commerce integration tests |
| `@nzila/platform-commerce-org` | commerce | STABLE | apps/*, packages/commerce-* | Org-scoped commerce config |
| `@nzila/pricing-engine` | commerce | STABLE | apps/flow, apps/web, packages/commerce-* | Pricing calculation engine |
| `@nzila/payments-stripe` | commerce | STABLE | apps/*, packages/commerce-* | Stripe payment integration |
| `@nzila/fx` | commerce | STABLE | apps/*, packages/commerce-* | Foreign exchange rates |
| `@nzila/tax` | commerce | STABLE | apps/*, packages/commerce-* | Tax calculation |
| `@nzila/qbo` | commerce | EVOLVING | apps/cfo, packages/commerce-* | QuickBooks Online integration |
| `@nzila/finops` | commerce | EVOLVING | apps/cfo, packages/platform-cost | FinOps metrics + cost analysis |

### Agri Domain

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/agri-core` | agri | EVOLVING | apps/*, packages/agri-* | Agri domain model |
| `@nzila/agri-db` | agri | EVOLVING | packages/agri-*, apps/* | Agri database |
| `@nzila/agri-events` | agri | EVOLVING | packages/agri-*, apps/* | Agri event contracts |
| `@nzila/agri-intelligence` | agri | EVOLVING | packages/agri-*, apps/* | Agri AI insights |
| `@nzila/agri-traceability` | agri | EVOLVING | packages/agri-*, apps/* | Agri supply chain traceability |
| `@nzila/agri-adapters` | agri | EVOLVING | packages/agri-*, apps/* | Agri external adapters |

### Mobility Domain

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/mobility-core` | mobility | EVOLVING | apps/mobility*, packages/mobility-* | Mobility domain model |
| `@nzila/mobility-programs` | mobility | EVOLVING | apps/mobility*, packages/mobility-* | Mobility programs |
| `@nzila/mobility-compliance` | mobility | EVOLVING | apps/mobility*, packages/mobility-* | Mobility compliance |
| `@nzila/mobility-family` | mobility | EVOLVING | apps/mobility*, packages/mobility-* | Family case management |
| `@nzila/mobility-case-engine` | mobility | EVOLVING | apps/mobility*, packages/mobility-* | Case workflow engine |

### Trade Domain

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/trade-core` | trade | EVOLVING | apps/trade, packages/trade-* | Trade domain model |
| `@nzila/trade-db` | trade | EVOLVING | packages/trade-*, apps/trade | Trade database |
| `@nzila/trade-cars` | trade | EVOLVING | apps/trade, packages/trade-* | Vehicle trade module |
| `@nzila/trade-adapters` | trade | EVOLVING | packages/trade-*, apps/trade | Trade external adapters |

### Integration Platform

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/integrations-core` | integrations | STABLE | packages/integrations-*, apps/* | Integration engine core |
| `@nzila/integrations-db` | integrations | STABLE | packages/integrations-* | Integration state store |
| `@nzila/integrations-runtime` | integrations | STABLE | apps/* | Integration runtime executor |
| `@nzila/integrations-hubspot` | integrations | EVOLVING | apps/*, packages/integrations-* | HubSpot adapter |
| `@nzila/integrations-m365` | integrations | EVOLVING | apps/*, packages/integrations-* | Microsoft 365 adapter |
| `@nzila/integrations-whatsapp` | integrations | EVOLVING | apps/*, packages/integrations-* | WhatsApp adapter |
| `@nzila/platform-integrations-control-plane` | integrations | EVOLVING | apps/control-plane | Integration control plane UI |
| `@nzila/crm-hubspot` | integrations | EVOLVING | apps/*, packages/integrations-* | CRM HubSpot bridge |
| `@nzila/webhooks` | integrations | STABLE | apps/*, packages/integrations-* | Webhook dispatch + receive |

### Communications

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/comms-email` | comms | STABLE | apps/*, packages/* | Email dispatch |
| `@nzila/comms-sms` | comms | STABLE | apps/*, packages/* | SMS dispatch |
| `@nzila/comms-push` | comms | EVOLVING | apps/*, packages/* | Push notification dispatch |
| `@nzila/chatops-slack` | comms | EVOLVING | apps/*, packages/* | Slack ChatOps integration |
| `@nzila/chatops-teams` | comms | EVOLVING | apps/*, packages/* | Teams ChatOps integration |

### App Support

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `@nzila/nacp-core` | nacp | EVOLVING | apps/nacp-exams | NACP exam domain logic |
| `@nzila/zonga-core` | zonga | EVOLVING | apps/zonga | Zonga domain logic |
| `@nzila/analytics` | platform | EVOLVING | apps/* | Analytics helpers |
| `@nzila/cli` | platform | EVOLVING | scripts/*, tooling/* | CLI tooling |

### Scaffold / Tooling

| Package | Owner | Stability | Allowed Dependents | Notes |
|---------|-------|-----------|--------------------|-------|
| `nzila-scripts-book-template` | platform | STABLE | (external repos) | Scripts Book scaffold template |

## Machine-Readable Metadata

Every package under `packages/` must contain a `package.meta.json` file with the following schema:

```json
{
  "owner": "platform | ai-platform | commerce | agri | mobility | trade | integrations | comms | nacp | zonga",
  "category": "PLATFORM_CORE | DOMAIN_SHARED | APP_SUPPORT | APP_LOCAL_EXTRACTION | DEPRECATED",
  "stability": "STABLE | EVOLVING | EXPERIMENTAL | DEPRECATED",
  "allowed_dependents": ["apps/*", "packages/platform-*"],
  "forbidden_dependents": [],
  "replacement_for": null,
  "deprecated": false,
  "deprecation_note": null
}
```

## Validation

Run `pnpm exec tsx scripts/package-ownership-check.ts` to verify all packages have valid metadata.

## Change Process

1. New packages require a `package.meta.json` before merge
2. Category changes require platform team review
3. Deprecation must include `replacement_for` and `deprecation_note`
4. Forbidden dependents are enforced in CI
