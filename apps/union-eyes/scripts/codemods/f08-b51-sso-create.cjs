const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}
edit('app/api/enterprise/sso/providers/route.ts', [
  ["import { AUTH_TENANT_ASSIGNABLE_ROLES } from '@nzila/db/auth-storage-authority';\n", "import { AUTH_TENANT_ASSIGNABLE_ROLES } from '@nzila/db/auth-storage-authority';\nimport { validateSsoProviderInput } from '@/lib/sso/provider-input';\n"],
  [
    "    if (!name || !providerType || !attributeMapping) {\n      throw ApiError.badRequest('name, providerType, and attributeMapping are required');\n    }\n",
    "    if (!name || !providerType || !attributeMapping) {\n      throw ApiError.badRequest('name, providerType, and attributeMapping are required');\n    }\n\n    // A provider is created disabled and without auto-provisioning unless the administrator asks otherwise, and one that is enabled\n    // must be complete for its type.\n    const validated = validateSsoProviderInput(body as Record<string, unknown>, enabled === true);\n",
  ],
  [
    "        name,\n        providerType,\n        samlEntityId,\n        samlSsoUrl,\n        samlCertificate,\n        oidcIssuer,\n        oidcClientId,\n        oidcClientSecret: encryptedOidcClientSecret,\n        attributeMapping,\n        roleMapping,\n        autoProvision: autoProvision ?? true,\n        enabled: enabled ?? true,",
    "        name: validated.name,\n        providerType: validated.providerType,\n        samlEntityId: validated.samlEntityId,\n        samlSsoUrl: validated.samlSsoUrl,\n        samlCertificate: validated.samlCertificate,\n        oidcIssuer: validated.oidcIssuer,\n        oidcClientId: validated.oidcClientId,\n        oidcClientSecret: encryptedOidcClientSecret,\n        attributeMapping,\n        roleMapping,\n        autoProvision: autoProvision ?? false,\n        enabled: enabled ?? false,",
  ],
  ["details: { providerType, autoProvision: autoProvision ?? true, enabled: enabled ?? true, roleMapping: roleMapping ?? null },", "details: { providerType, autoProvision: autoProvision ?? false, enabled: enabled ?? false, roleMapping: roleMapping ?? null },"],
  ["    const encryptedOidcClientSecret = oidcClientSecret\n      ? await encryptSecret(oidcClientSecret)\n      : oidcClientSecret;", "    const encryptedOidcClientSecret = validated.oidcClientSecret\n      ? await encryptSecret(validated.oidcClientSecret)\n      : undefined;"],
])
