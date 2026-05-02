# Architecture Map

NzilaOS is decision infrastructure: a shared system for capturing, evaluating, proving, replaying, and governing organizational decisions across multiple domains.

## Operating Model

```text
Domain Interface -> Decision Core -> Policy + Authority -> Outcome + Proof -> Replay / Export / Audit
```

## Core Layers

| Layer | Responsibility |
|------|----------------|
| Domain interfaces | Product-specific input and output surfaces in `apps/*` |
| Decision core | Canonical decision model, registry, and enforcement helpers in `packages/decision-core` |
| Policy and authority | Control Plane policy evaluation and organization authority checks |
| Workflow execution | Orchestrator execution of approved workflows |
| Proof and observability | Console review, evidence export, and audit verification |

## Audit Guarantees

- Immutable retention: each NAR is persisted to Azure Blob with WORM-compatible retention metadata.
- Chain integrity: every non-genesis record requires a previous hash; scheduled jobs validate chain continuity.
- External verification: audit export packs include checksum, signature, and reproducible verification instructions.
- Auditor authority: token-based auditor access is org-scoped and read-only.

## App Roles

| Surface | Decision role |
|--------|----------------|
| Union Eyes | Labour intake, escalation, and member workflow decisions |
| FairCase / ABR | Legal and investigation decisions |
| Flow | Commerce approvals and exception decisions |
| Zonga | Rights, payout, and moderation decisions |
| Platform Admin | Tenant authority and policy activation decisions |
| Control Plane | Decision integrity, policy enforcement, and authority validation |
| Orchestrator API | Execution of approved workflows |
| Console | Decision proof review, replay, and operating risk review |

## Shared Decision Primitive

Every critical mutation should converge on this model:

```ts
type DecisionRecord = {
  id: string;
  organizationId: string;
  domain: 'labour' | 'legal' | 'commerce' | 'media' | 'education' | 'health' | 'platform';
  resourceType: string;
  resourceId: string;
  actor: {
    id: string;
    type: 'user' | 'system' | 'api';
    role?: string;
    authorityScope?: string[];
  };
  input: unknown;
  policy: {
    id: string;
    version: string;
    domain: string;
  };
  outcome: {
    status: 'approved' | 'rejected' | 'pending' | 'escalated';
    reasonCode?: string;
    explanationTrace?: string[];
  };
  proof?: {
    auditRecordId?: string;
    hash?: string;
    signature?: string;
    previousHash?: string;
    verified?: boolean;
  };
  createdAt: string;
}
```

## Reference Documents

- `docs/architecture/decision-infrastructure-map.md`
- `docs/governance/decision-coverage-inventory.md`
- `ARCHITECTURE.md`