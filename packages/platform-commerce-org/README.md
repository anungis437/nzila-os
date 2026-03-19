# @nzila/platform-commerce-org

Org-native commerce configuration with schemas, defaults, domain utilities, and service layer. Covers branding, pricing, payments, suppliers, catalog, and workflow configuration per organization.

## Capabilities

| Area | Functions |
|------|-----------|
| **Service** | `getOrgSettings` — org commerce configuration resolution |
| **Branding** | `resolveLogoInitials` — org branding and logo utilities |
| **Pricing** | `calculateTaxes`, `calculateDepositAmount` — pricing and tax calculations |
| **Payments** | Payment method configuration per org |
| **Suppliers** | Supplier management and org-scoped supplier settings |
| **Catalog** | Catalog configuration and product taxonomy |
| **Workflows** | Commerce workflow definitions per org |
| **Audit** | Configuration change audit trail |

## Source Layout

```
src/
├── audit.ts
├── branding.ts
├── catalog.ts
├── defaults.ts
├── payments.ts
├── pricing.ts
├── schemas.ts
├── service.ts
├── suppliers.ts
├── types.ts
├── utils.ts
├── workflows.ts
├── index.ts
└── __tests__/
```

## Exports

- `.` — barrel exports
- `./types` — commerce org type definitions
- `./schemas` — Zod validation schemas
- `./defaults` — default org configuration
- `./branding` — branding utilities
- `./pricing` — pricing and tax engine
- `./payments` — payment configuration
- `./suppliers` — supplier management
- `./catalog` — catalog configuration
- `./workflows` — workflow definitions
- `./audit` — audit trail
- `./utils` — utility functions
- `./service` — core service layer
