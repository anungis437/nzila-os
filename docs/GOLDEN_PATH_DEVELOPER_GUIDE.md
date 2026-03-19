# Golden Path — Governed App Developer Guide

> How to create, configure, and ship a governance-compliant app in the Nzila OS monorepo.

## Quick Start

```bash
# Scaffold a new governed app
npx tsx tooling/golden-path/scaffold-governed-app.ts my-app --risk=medium --profile=commerce

# Install dependencies
pnpm install

# Run the app
pnpm dev --filter @nzila/my-app

# Validate governance compliance
pnpm validate:control:manifests
```

## What Gets Created

| File | Purpose |
|------|---------|
| `control-manifest.json` | Declares required governance controls, risk level, and policy profile |
| `app-architecture.meta.json` | Domain-core layer compliance tracking |
| `package.json` | App package configuration |
| `tsconfig.json` | TypeScript config extending base |
| `lib/enforcement.ts` | Pre-wired enforcement pipeline (for medium+ risk) |
| `app/api/health/route.ts` | Health endpoint (bypasses enforcement) |
| `app/page.tsx` | Root page |
| `app/layout.tsx` | Root layout |
| `.eslintrc.json` | ESLint config extending governance rules |
| `README.md` | App readme with governance status |

## Governance Control Levels

| Risk Level | Required Controls |
|------------|-------------------|
| **critical** | All 8 controls mandatory, no exceptions |
| **high** | enforcement, governance, audit, observability, security, contracts, events |
| **medium** | enforcement, governance, audit, observability, security, contracts, events |
| **low** | observability, security (others recommended) |
| **none** | observability, security (scaffold apps) |

## Wiring Enforcement

For apps that require enforcement (medium+ risk), customize `lib/enforcement.ts`:

```typescript
import { createEnforcedHandler, createContext, traceLayer, authLayer, governanceLayer, auditLayer } from '@nzila/enforcement'

// 1. Configure your auth provider
authLayer({
  extractActor: async (headers) => {
    // Verify JWT from Clerk/NextAuth/etc.
    const token = headers.authorization?.replace('Bearer ', '')
    if (!token) return null
    const decoded = await verifyToken(token)
    return {
      actorId: decoded.sub,
      tenantId: decoded.orgId,
      roles: decoded.roles,
    }
  },
})

// 2. Configure governance evaluation
governanceLayer({
  evaluate: async (ctx) => {
    // Wire to @nzila/governance canAccess()
    const result = await canAccess({
      actor: ctx.actorId,
      action: ctx.action,
      resource: ctx.resourceType,
    })
    return {
      outcome: result.allowed ? 'allow' : 'deny',
      reason: result.reason,
    }
  },
})

// 3. Configure audit recording
auditLayer({
  record: async (entry) => {
    // Wire to @nzila/audit appendEntry()
    await auditStore.append(entry)
  },
})
```

## Adding to CI

Your app is automatically covered by:
- **Contract tests** — `pnpm contract-tests` validates structural invariants
- **Control manifest validation** — `pnpm validate:control:manifests` checks CM-001..CM-009
- **Governance gates** — CI runs `pnpm validate:governance:gate` with fail-closed checks

## Policy Profiles

Assign a policy profile in `control-manifest.json` to apply vertical-specific governance:

| Profile | Category | Extra Requirements |
|---------|----------|-------------------|
| `union-eyes` | governance | Role graph, case evidence, litigation hold |
| `abr-insights` | advisory | Dual control, confidential reporting |
| `fintech` | fintech | Dual control, key lifecycle management |
| `commerce` | commerce | Standard controls |
| `agtech` | agtech | Standard controls |
| `media` | media | Standard controls |
| `advisory` | advisory | Standard controls |

## Exception Waivers

If a control cannot be immediately adopted, declare an exception with an expiry:

```json
{
  "exceptions": [
    {
      "control": "enforcement",
      "reason": "Migration in progress — legacy auth system",
      "expiresOn": "2026-06-30",
      "owner": "platform-team"
    }
  ]
}
```

**Immutable controls** cannot be waived: org-isolation, audit-emission, evidence-sealing, hash-chain-integrity, secret-scanning, dependency-audit, contract-tests, eslint-governance-rules.

## Checklist

- [ ] Scaffold app with `scaffold-governed-app.ts`
- [ ] Customize `lib/enforcement.ts` with real auth/governance/audit
- [ ] Add app to `governance/runtime-adoption-matrix.json`
- [ ] Run `pnpm validate:control:manifests` — all checks pass
- [ ] Run `pnpm contract-tests` — all tests pass
- [ ] Run `pnpm validate:governance:gate` — all gates pass
- [ ] Create PR, CI green, merge
