# Platform Package Boundaries

**Owner:** Platform Team  
**Last Updated:** 2026-03-11  
**Status:** Active

---

## Purpose

Nzila OS has two categories of shared code. This guide clarifies when to reach for
each and prevents duplication.

## The Two Layers

| Layer | Prefix | Location | Purpose |
|-------|--------|----------|---------|
| **Runtime SDKs** | `@nzila/*` | `packages/{os-core,ai-sdk,ml-sdk,db,blob,…}` | App-facing APIs consumed directly by the 24 apps |
| **Platform packages** | `@nzila/platform-*` | `packages/platform-*` | Cross-cutting platform infrastructure — ontology, governance, observability, events |

## Decision Guide

```
Is it consumed directly by an app's feature code?
  ├── YES → use @nzila/* SDK (os-core, ai-sdk, ml-sdk, db, blob, etc.)
  └── NO
       Is it cross-vertical infrastructure (ontology, events, observability, governance)?
         ├── YES → use @nzila/platform-*
         └── NO
              Is it domain-specific logic shared between apps in one vertical?
                ├── YES → use a domain package (commerce-core, agri-core, mobility-*)
                └── NO  → evaluate if a new package is justified (see "Creating New Packages")
```

## Rules

### 1. Apps MUST use SDKs, not platform internals

Apps consume `@nzila/ai-sdk` and `@nzila/ml-sdk` — never `@nzila/ai-core` or `@nzila/ml-core`.
This is enforced by `tooling/contract-tests/ai-integration.test.ts`.

### 2. Platform packages are for platform infrastructure

A `platform-*` package provides cross-cutting capabilities that multiple verticals need:

- **Entity types** → `platform-ontology`
- **AI governance** → `platform-governed-ai`
- **Observability hooks** → `platform-observability`
- **Evidence proofs** → `platform-proof`, `platform-evidence-pack`
- **Event streaming** → `platform-event-fabric`

Platform packages do NOT contain vertical business logic.

### 3. Domain packages stay domain-scoped

Commerce logic lives in `commerce-*`, agriculture in `agri-*`, mobility in `mobility-*`.
Domain packages may depend on `platform-*` for cross-cutting concerns.

### 4. Dependency direction

```
Apps → SDKs (@nzila/*)
Apps → Domain packages (commerce-*, agri-*, mobility-*)
SDKs → Platform packages (@nzila/platform-*)
Domain packages → Platform packages (@nzila/platform-*)
Platform packages → Platform packages (within same tier)
```

**Never:** Platform packages → Apps, Platform packages → Domain packages.

## Package Tiers

| Tier | Meaning | Stability | Examples |
|------|---------|-----------|----------|
| **Foundational** | Core abstractions; breaking changes need migration plan | Stable | `platform-ontology`, `platform-event-fabric`, `platform-proof` |
| **Service** | Higher-level capabilities built on foundational | Semi-stable | `platform-knowledge-registry`, `platform-cost`, `platform-deploy` |
| **Utility** | Shared helpers; lower stability expectations | Flexible | `platform-utils`, `platform-validation`, `platform-rfp-generator` |

## Creating New Packages

Before creating a new `platform-*` package:

1. **Check the ownership registry** — `governance/platform-package-owners.yaml`
2. **Verify no overlap** — Is the capability already covered by an existing package?
3. **Confirm cross-vertical need** — If only one vertical needs it, it's a domain package
4. **Assign an owner team and steward** — Every platform package must have both
5. **Add an API surface contract test** — `tooling/contract-tests/platform-api-surface.test.ts`

## FAQ

**Q: Should I import `platform-ontology` types directly in my app?**  
A: Yes — ontology types are foundational and safe to import everywhere.

**Q: My feature needs a new cross-cutting concern. New platform package?**  
A: First check if it fits in an existing package. If not, discuss with the platform
team steward listed in `governance/platform-package-owners.yaml`.

**Q: Can a platform package depend on `os-core`?**  
A: Yes — `os-core` is a runtime SDK that platform packages may depend on for
telemetry, config, and policy primitives.
