# Org Commerce Configuration Reference

> **Package**: `@nzila/platform-commerce-org`
> **Sub-path exports**: `/types`, `/schemas`, `/defaults`, `/service`, `/audit`,
> `/pricing`, `/payments`, `/suppliers`, `/catalog`, `/branding`, `/workflows`, `/utils`

## Configuration Types

### OrgCommerceSettings

| Field | Type | Default (ShopMoiCa) | Description |
|-------|------|---------------------|-------------|
| `orgId` | `string (UUID)` | — | Organisation identifier |
| `currency` | `string (3 chars)` | `CAD` | ISO 4217 currency code |
| `locale` | `string` | `en-CA` | BCP 47 locale for formatting |
| `quotePrefix` | `string` | `SQ` | Quote reference prefix |
| `invoicePrefix` | `string` | `INV` | Invoice reference prefix |
| `poPrefix` | `string` | `PO` | Purchase order prefix |
| `orderPrefix` | `string` | `ORD` | Production order prefix |
| `quoteValidityDays` | `number (1–365)` | `30` | Days before quote auto-expires |
| `shareLinkExpiryDays` | `number (1–90)` | `7` | Days before share link expires |
| `taxConfig` | `OrgTaxConfig` | GST+QST | Tax jurisdiction + tax lines |
| `defaultShippingPolicy` | `string` | `FOB Origin` | Default shipping terms |

### OrgQuotePolicy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minMarginPercent` | `number (0–100)` | `15` | Minimum acceptable margin |
| `approvalRequiredBelowMargin` | `boolean` | `true` | Require approval below floor |
| `maxDiscountWithoutApproval` | `number (0–100)` | `25` | Max discount % without approval |
| `autoExpireQuotesAfterDays` | `number` | `30` | Auto-expire setting |
| `allowManualPriceOverride` | `boolean` | `false` | Allow manual price entry |
| `approvalThreshold` | `number` | `10,000` | Total above which approval is required |
| `requireEvidenceForInvoice` | `boolean` | `true` | Require evidence pack for invoicing |
| `marginFloors` | `Record<tier, number>` | `{15, 25, 35}` | Per-tier margin floors |

### OrgPaymentPolicy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `depositRequired` | `boolean` | `true` | Whether deposit is required |
| `defaultDepositPercent` | `number` | `30` | Deposit percentage |
| `depositRequiredBeforeProduction` | `boolean` | `true` | Gate production on deposit |
| `allowPartialPayments` | `boolean` | `true` | Allow partial payments |
| `defaultPaymentTerms` | `string` | `Net 30` | Payment terms label |
| `defaultPaymentTermsDays` | `number` | `30` | Days until payment due |
| `defaultLeadTimeDays` | `number` | `14` | Default production lead time |
| `paymentInstructions` | `string` | — | Instructions for clients |

### OrgSupplierPolicy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preferredSupplierIds` | `string[]` | `[]` | Preferred supplier list |
| `supplierSelectionStrategy` | `enum` | `BALANCED` | `LOWEST_COST`, `FASTEST`, `BALANCED`, `MANUAL` |
| `qualityWeight` | `number` | `0.3` | BALANCED strategy weight |
| `leadTimeWeight` | `number` | `0.3` | BALANCED strategy weight |
| `costWeight` | `number` | `0.4` | BALANCED strategy weight |

### OrgCatalogPolicy

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultMarkupStrategy` | `enum` | `FIXED_PERCENT` | `FIXED_PERCENT`, `TIERED`, `MANUAL` |
| `defaultFixedMarkupPercent` | `number` | `40` | Fixed markup percentage |
| `enableInternalSkuMapping` | `boolean` | `false` | Enable SKU remapping |
| `defaultDecorationRule` | `string` | `Standard` | Default decoration rule |
| `categoryMappings` | `Record<string, string>` | `{}` | External→internal category map |

### OrgBrandingConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `displayName` | `string` | `ShopMoiCa` | Customer-facing company name |
| `companyLegalName` | `string` | `ShopMoiCa Inc.` | Legal entity name |
| `logoInitials` | `string` | `SM` | Two-letter logo initials |
| `primaryColour` | `string` | `#ef4444` | Brand primary colour (hex) |
| `address` | `string` | — | Business address |
| `city` | `string` | `Montreal` | City |
| `province` | `string` | `QC` | Province/state |
| `country` | `string` | `Canada` | Country |
| `quoteFooterText` | `string?` | — | Custom footer for quotes |

### OrgCommunicationTemplates

| Field | Type | Description |
|-------|------|-------------|
| `quoteEmail` | `EmailTemplate` | Email sent with quotes |
| `invoiceEmail` | `EmailTemplate` | Email sent with invoices |
| `paymentReminderEmail` | `EmailTemplate` | Payment reminder email |
| `depositRequestEmail` | `EmailTemplate` | Deposit request email |
| `approvalRequestEmail` | `EmailTemplate` | Approval request email |
| `revisionNotificationEmail` | `EmailTemplate` | Revision notification email |

## Service API

### Read (returns defaults when no DB row exists)

```ts
getOrgSettings(orgId: string): Promise<OrgCommerceSettings>
getOrgQuotePolicy(orgId: string): Promise<OrgQuotePolicy>
getOrgPaymentPolicy(orgId: string): Promise<OrgPaymentPolicy>
getOrgSupplierPolicy(orgId: string): Promise<OrgSupplierPolicy>
getOrgCatalogPolicy(orgId: string): Promise<OrgCatalogPolicy>
getOrgBranding(orgId: string): Promise<OrgBrandingConfig>
getOrgCommunicationTemplates(orgId: string): Promise<OrgCommunicationTemplates>
getOrgCommerceConfig(orgId: string): Promise<OrgCommerceConfig>
```

### Write (Zod-validated, returns change event)

```ts
upsertOrgSettings(orgId, input, actorId)
  : Promise<{ settings: OrgCommerceSettings; changeEvent: OrgConfigChangeEvent }>

upsertOrgQuotePolicy(orgId, input, actorId)
  : Promise<{ quotePolicy: OrgQuotePolicy; changeEvent: OrgConfigChangeEvent }>

// ... same pattern for all 7 config types
```

## Domain Utilities

| Module | Functions |
|--------|-----------|
| `pricing` | `calculateTaxes`, `getCombinedTaxRate`, `formatCurrency`, `evaluateMargin` |
| `payments` | `calculateDepositAmount`, `calculateDueDate`, `isProductionGated` |
| `suppliers` | `rankSuppliers` (4 strategies + preferred boost) |
| `catalog` | `applyMarkup` (3 strategies), `resolveCategory`, `mapSku`, `getDecorationRule` |
| `branding` | `resolveLogoInitials`, `resolveCopyrightNotice`, `resolveFooterText` |
| `workflows` | `generateQuoteRef/InvoiceRef/PoRef`, `calculateExpiryDate`, `isQuoteExpired`, `requiresApproval` |
| `audit` | `buildConfigChangeEvent`, `getEventType`, `getSensitiveFields` |
| `utils` | `renderTemplate`, `diffConfig` |
