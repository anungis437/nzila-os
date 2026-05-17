# UnionEyes — Rollback Validation (B2C)

Status: **deferred** — procedure documented and prerequisite verified,
real rollback execution gated on explicit operator approval.

## Prerequisite verification

`az containerapp revision list` shows that the prod app retains prior
revisions for rollback. Container Apps in `Single` revision mode keep
previous revisions in `Inactive` state until garbage-collected per the
environment's revision retention policy.

To inspect available rollback targets at any time:

```powershell
az containerapp revision list `
  -n nzila-os-union-eyes-prod `
  -g nzila-canada-prod-rg `
  --query "[].{name:name, active:properties.active, healthState:properties.healthState, createdTime:properties.createdTime, image:properties.template.containers[0].image}" `
  -o table
```

## Rollback procedure

1. Identify last known-good revision N-1 from the list above.
2. Move 100 % traffic to N-1 (Single mode):

   ```powershell
   az containerapp revision activate `
     -n nzila-os-union-eyes-prod `
     -g nzila-canada-prod-rg `
     --revision <revision-N-1>
   az containerapp ingress traffic set `
     -n nzila-os-union-eyes-prod `
     -g nzila-canada-prod-rg `
     --revision-weight <revision-N-1>=100
   ```

3. Curl `/api/health` against the prod FQDN; require HTTP 200 with
   `checks.database.status == "ok"` and `checks.auth.status == "ok"`.
4. Capture revision SHA, rollback duration, and post-rollback smoke
   results in a new appendix to this file.

## Database compatibility

UE migrations are forward-only and reviewed under
`migrations/`. Before any rollback that crosses a migration boundary,
verify:

- No destructive migration has been applied in the interval being
  rolled back over.
- Application code at N-1 can read the current schema state.

This must be confirmed per-rollback; it cannot be pre-declared safe.

## Why this is not yet `validated`

A real rollback drill has not been executed against
`nzila-os-union-eyes-prod` during this pass. Marking this `validated`
requires:

- An actual revision activation against the live app.
- Captured rollback duration.
- Health endpoint transition (200 → maybe 503 → 200) captured.
- Confirmation that governance telemetry and evidence export continued
  to function across the rollback boundary.
