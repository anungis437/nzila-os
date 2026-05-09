# tooling/runtime-governance/policies

Doctrine policy fixtures loaded into the in-memory `DoctrinePolicyRegistry` at process startup.

A policy is a JSON file declaring at minimum:

```json
{
  "id": "ue.route.case-list",
  "version": "1",
  "domain": "route",
  "doctrineCitations": [
    { "document": "docs/nzila-ip/pilot-discipline.md" }
  ],
  "rule": "describe the human-readable rule"
}
```

Hot-reload of this directory is rejected. Policy changes require a redeploy and a fresh attestation.
