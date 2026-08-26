# Resend API Key — Rotation Request

**Status:** REQUIRED — pending Aubert Nungisa (sole authorized approver)
**Scope:** Union Eyes staging Resend API key
**Reason:** Precautionary rotation. During Wave 1 Phase A live-proof session (2026-07-21) the Resend API key was fetched via `az keyvault secret show ... --query value -o tsv` and loaded into a shell variable. While the value was not written to any committed file (confirmed by grep sweep for the `re_` prefix across `reports/`, `docs/`, logs) and did not appear in transcript output, the value transited the local shell environment. Standard hygiene calls for rotation.

## Why the agent did not auto-rotate
Rotating a Resend API key requires authenticated access to the Resend dashboard (or Resend Admin API with a parent org-scoped key that we do not possess). The agent has no such credentials. Rotation must be performed by an authorized human.

## Rotation procedure (for Aubert)

1. Sign in to Resend dashboard for the Union Eyes staging tenant.
2. Under **API Keys**, revoke the current staging key (identify by created date or team).
3. Create a new **sending** API key scoped to staging only.
4. Update Key Vault:
   ```powershell
   az keyvault secret set --vault-name nzila-staging-kv --name resend-api-key --value "<new_key>"
   ```
5. The container app is already bound to KV via `keyvaultref` (system-assigned managed identity `20d5f517-1f03-4ced-ae19-cfc32c4c2c13`, role **Key Vault Secrets User** on `nzila-staging-kv`), so the value flows automatically once a new revision starts.
6. Force a new revision to pick up the fresh secret:
   ```powershell
   az containerapp revision copy --name nzila-os-union-eyes-staging --resource-group nzila-canada-staging-rg --revision-suffix "resend-rot-<yymmddHHmm>"
   ```
7. Verify by running the deadline-reminder cron against a synthetic row addressed to `delivered@resend.dev` and confirming `status=sent` + a fresh `provider_message_id`.

## Container App binding (already in place — no action needed)
- `resend-api-key` container-app secret → `keyvaultref:https://nzila-staging-kv.vault.azure.net/secrets/resend-api-key`
- `identityref:system` — resolved by the container app's system-assigned managed identity
- Unversioned URL — new KV versions flow automatically on next revision start

## Evidence to capture after rotation
- KV new-version identifier (last URL segment)
- Container app revision name (new)
- One successful worker run using the new key (record `provider_message_id`, not the key)

## Non-negotiable
- Do **not** paste the key into any file, script, chat transcript, PR description, or ticket.
- Do **not** email or Slack the key. Use KV only.
- Confirm rotation is complete by running the standard smoke: `/api/version` + one authenticated deadline-reminder run.
