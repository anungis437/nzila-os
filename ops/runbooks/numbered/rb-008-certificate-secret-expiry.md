# Runbook: Certificate / Secret Expiry

**ID:** RB-008
**Severity:** P1–P2
**Category:** Security / Infrastructure
**Owner:** Platform Engineering / CISO
**Last Updated:** 2026-03-03

---

## Symptoms

- TLS certificate expired → users see browser security warning
- API keys / OAuth tokens expired → integration failures
- ChatOps alert: "Certificate expiry warning: {domain}"
- Console → Integrations shows auth failures
- Application logs: "CERT_HAS_EXPIRED" or "401 Unauthorized"

## Impact

- **TLS expiry (P1):** All users blocked from accessing the application
- **API key expiry (P2):** Specific integrations fail, DLQ backlog grows
- **OAuth token expiry (P2):** Org-specific integration disruption

## Diagnosis

1. **Check TLS certificate:**
   ```bash
   echo | openssl s_client -connect {domain}:443 2>/dev/null | openssl x509 -noout -dates
   ```

2. **Check Azure managed certificates:**
   ```bash
   az webapp config ssl list --resource-group <rg> --query "[].{name:name, expires:expirationDate}"
   ```

3. **Check integration credentials:**
   - Console → Integrations → {Provider} → Health Check.
   - Look for `401` or `403` in recent integration events.

4. **Check Key Vault secrets:**
   ```bash
   az keyvault secret list --vault-name <vault> --query "[].{name:id, expires:attributes.expires}"
   ```

## Remediation

### TLS Certificate
1. **If Azure-managed:** Auto-renewal should handle this. Check DNS.
   ```bash
   az webapp config hostname list --webapp-name <app> --resource-group <rg>
   ```
2. **If custom cert:** Upload renewed certificate.
   ```bash
   az webapp config ssl upload --certificate-file <path> --certificate-password <pwd> \
     --name <app> --resource-group <rg>
   ```
3. Verify: `curl -I https://{domain}` — should show 200 with valid cert.

### API Keys
1. Rotate the key in the provider's dashboard.
2. Update in Azure Key Vault:
   ```bash
   az keyvault secret set --vault-name <vault> --name <key-name> --value <new-value>
   ```
3. Restart affected services to pick up new value.
4. Test with health check.

### OAuth Tokens
1. Re-authenticate via Console → Integrations → {Provider} → Re-authorize.
2. Verify token refresh is working.
3. Check token expiry configuration for the provider.

## Prevention

- Monitor certificate expiry — alert 30 days before.
- Monitor API key / secret expiry — alert 14 days before.
- Use Azure Key Vault with auto-rotation where supported.
- Quarterly secret rotation audit.
- OAuth refresh token logic in all integration adapters.

## Audit

- All credential rotations create audit event: `secret.rotated`.
- Certificate renewals logged with old/new expiry dates.
- Key Vault access logs retained for compliance.
