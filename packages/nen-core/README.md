# @nzila/nen-core

Black Enterprise Network domain primitives for consortium participation, explicit partner approvals, and exact economic allocations.

- Authenticated organization and permissions **must** come from Nzila platform-auth and policy enforcement. Caller-supplied roles are not an authentication mechanism.
- No bank receipts, legal signatures, ownership certifications or live contracts are created here.
- All financial values are integer cents and all shares are basis points.
- A business partner may see only its own allocation; buyer and lead see the disclosed team.
- Persist decisions in an authorized, append-only transaction store before real use.

Validate with `pnpm --filter @nzila/nen-core test` and `pnpm --filter @nzila/nen-core typecheck`.
