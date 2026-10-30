# Outcome-driven delivery contract

An engineering result consists of four separately attributable records:

| Record | Required contents |
| --- | --- |
| Work identity | Product, canonical defect IDs, immutable baseline, owner and change request |
| Implementation | Patch/commit reference, files, grouped root cause and negative paths |
| Verification | Independent verifier, source SHA, artifact digest, test or runtime evidence |
| Release decision | Explicit authorized approver, target environment, decision and conditions |

## Failure modes that fail closed

- A positive-looking JSON field (\`done: true\`) never proves completion.
- Policy ALLOW alone is not verification.
- A proof for another workflow, step, organization, SHA or artifact is invalid.
- A verifier who is also the executing agent is not independent.
- Copying or deserializing a process-local proof does not mint authority.
- Staging evidence is not production evidence.
- An unobserved or canceled test does not count as PASS.
- An agent may record IMPLEMENTED work but not self-issue release authority.

Batch by shared root cause. Preserve every defect ID rather than inflating
closure counts by grouping. Use the canonical register as the denominator.

The workflow runner requires two independent capabilities from trusted host
wiring: (1) a policy ALLOW permit; (2) an evidence verification proof. Agent
claims, skill metadata and JSON copies never mint either one.
