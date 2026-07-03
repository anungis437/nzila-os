# Production Incident Response Runbook

As of 2026-07-03. Scope: `nzila-canada-prod-env` (union-eyes, web, partners).

## Detect

- Health: `curl -I https://app.unioneyes.app/`, `https://www.nzilaventures.com/`,
  `https://partners.nzilaventures.com/api/ready`.
- Logs (dedicated prod Log Analytics `nzila-canada-prod-law`):
  ```
  az containerapp logs show -n <app> -g nzila-canada-prod-rg --tail 200
  ```
- Alerts route to action group `ue-prod-ops-alerts` (prod-rg).

## Triage

1. Confirm scope (which app/domain, error class, since when).
2. Check the active revision + recent deploy:
   `az containerapp revision list -n <app> -g nzila-canada-prod-rg -o table`.
3. Check the prod DB health for union-eyes/partners:
   `az postgres flexible-server show -n nzila-os-union-eyes-prod-db -g nzila-canada-prod-rg`.

## Mitigate

- Bad deploy → **roll back** to prior known-good digest/revision (see
  `production-rollback.md`).
- Data incident → point-in-time restore (30-day PITR).
- Auth/secret incident → rotate the affected secret in the ACA secret store /
  `nzila-canada-prod-kv`, then restart the revision.

## Severity

- SEV1: production domain down / data at risk. SEV2: degraded. SEV3: minor.

## Owners / contacts

- Primary: platform-ops. Approver / escalation: repo owner / sole operator.

## Standing security follow-ups

- Rotate the `nzilacanadastore` storage key (was plaintext on staging partners).
- Rotate the Cloudflare API token used for DNS cutover.
