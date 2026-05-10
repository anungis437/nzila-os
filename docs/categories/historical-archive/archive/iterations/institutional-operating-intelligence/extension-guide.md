# Extension Guide — Adding a Cognition Engine

> **Bar is high.** Cognition engines are governance-bearing components. Most
> features should plug into an existing engine rather than introduce a new one.

## Checklist

- [ ] RFC reviewed by platform + governance owners.
- [ ] New engine maps to an existing canonical domain (no domain expansion).
- [ ] Engine is purely organizational; passes `assertLaborSafe` with
      `scopeOfObservation: 'organizational' | 'departmental' | 'role_cohort' | 'process'`.
- [ ] Engine returns `InstitutionalExplainabilityEnvelope<T>`.
- [ ] Engine is built via `defineCognitionEngine(...)`.
- [ ] Engine is registered with `cognitionRegistry`.
- [ ] Lifecycle policy declared (`experimental | stable | deprecated | retired`).
- [ ] Tests cover: envelope shape, governance assertion, confidence mapping.
- [ ] Documented in `architecture.md` engine map.

## Skeleton

```ts
import { defineCognitionEngine } from '@nzila/institutional-cognition-core';

export const myEngine = defineCognitionEngine<MyPayload>({
  engineId: 'my-engine',
  engineVersion: '1.0.0',
  domain: 'governance',
  compute: async (organizationId) => {
    // ...gather organizational evidence...
    return {
      payload: { /* ... */ },
      confidenceScore: 70,
      evidence: [],
      reasoning: [],
      assumptions: [],
      governanceImplications: [],
      interpretationGuidance: 'Plain-language guidance for the reviewer.',
    };
  },
});
```

## Anti-patterns

- Defining cognition types locally instead of importing from the kernel.
- Returning raw payloads (no envelope).
- Bypassing the SDK and constructing envelopes by hand "for performance".
- Adding sentiment/scoring of identified individuals.
- Inventing new domain or concept names.
