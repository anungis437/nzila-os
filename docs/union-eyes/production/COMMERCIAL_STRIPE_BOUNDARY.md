# Union Eyes — Stripe and the client-commercial boundary

**Status: boundary document only.** No client-commercial billing is built or enabled by this lane.
It exists so the proven payment controls are reused correctly, and so the old assumption that Union
Eyes must collect member dues at launch is not carried forward.

## 1. Frozen scope

| Item                                  | Decision                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Member dues collection in UE          | **Not initial launch scope**                                                                                            |
| Member dues payment UI                | **Do not build** (the registry already lists `UE-DUES-DIRECT-PAYMENT` as `DISABLED`; the form is not rendered anywhere) |
| Member dues Stripe flow               | **Dormant optional capability**, kept and proven, off by default                                                        |
| Stripe primary purpose                | **Client-commercial management** (the paying actor is a client organization, union or local, not a member)              |
| Client self-service payment at launch | **Not required** (post-launch commercial enablement)                                                                    |

The dormant dues capability answers `501 NOT_IMPLEMENTED` on its three initiation routes
(`POST /api/portal/dues/pay`, `POST /api/dues/create-payment-intent`, legacy
`POST /api/payments/checkout/create`) unless a deployment sets `UE_MEMBER_DUES_PAYMENTS=1`. The switch is
independent of Stripe configuration, so enabling Stripe for client billing can never turn member dues
payment on as a side effect. The verified-webhook settlement path stays live and idempotent. The
infrastructure template does not set the flag.

## 2. Doctrine

```
Stripe reports external financial events.
Nzila / Union Eyes owns: customer identity, commercial state, contract state,
                         entitlements, product authorization, audit and provenance.

STRIPE DOES NOT OWN product authorization, tenant identity, UE roles, or member access.
payment status MAY INFORM entitlement evaluation; it MUST NOT bypass authorization.
```

```
Stripe subscription active
  -> verified commercial event ingested
  -> Nzila commercial state updated
  -> entitlement policy evaluated
  -> UE product capability enabled or disabled
(never: Stripe subscription active -> route authorization granted directly)
```

The payment security boundary is unchanged:
`authenticated client action -> server-owned commercial/payment intent -> payment provider -> verified
provider event -> server-owned state transition -> audit`. A client request is never settlement
authority; "client says paid" never marks anything paid.

## 3. What already exists in source (assessed, not extended)

| Existing source                                                                                                                                                                                        | Role in the future model                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db/schema/domains/finance/platform-billing.ts`: `billing_accounts`, `subscription_plans`, `org_subscriptions`, `platform_invoices`, `platform_payments`, `payment_allocations`, `billing_adjustments` | Org-level commercial state (one `billing_account` per organization today)                                                                         |
| `db/schema/domains/finance/contracts.ts`: `org_entitlements` (feature key, status, expiry, usage limit, `granted_by`/`revoked_by`)                                                                     | The Nzila-owned entitlement decision                                                                                                              |
| `services/platform-economics/entitlement-guard.ts`: `requireEntitlement`, `checkModuleEntitlement`                                                                                                     | Product authorization reads `org_entitlements`, never Stripe                                                                                      |
| `app/api/payments/webhooks/stripe/route.ts` + `billing-service.reconcileExternalInvoicePayment`                                                                                                        | Verified `payment_intent.succeeded` / `invoice.paid` reconcile a platform invoice by server-held `platform_invoice_id`                            |
| ICRA and workbook purchase handling in the same webhook                                                                                                                                                | Existing one-off commercial purchases (HubSpot sync)                                                                                              |
| `cron/billing-lifecycle`                                                                                                                                                                               | **Held at 501**: invoice generation and state changes are cross-organization financial writes that need separate owner authority; none is granted |

The doctrine above already matches how entitlements work today. The proven dues controls are the
reusable pattern for the commercial case.

## 4. Preserved, reusable controls (proven; not re-run in this lane)

Stripe signature verification; provider-originated webhook delivery; idempotent settlement and
duplicate-event protection; tampered-metadata rejection; server-owned amount, organization and
payer/customer binding; canonical audit; exactly-once financial mutation; fail-closed provider
handling. Evidence: staging revision `r13`/earlier (8/8 provider-delivery proof, 8/8 real
PaymentIntent proof) and the native dues suites.

## 5. Future commercial objects (document only)

| Object                             | Purpose                                                   | Authority owner  | Relation to UE Organization                                                                                                    | Relation to Stripe                                     | Key invariant                                                                    |
| ---------------------------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| ClientAccount                      | Commercial customer identity (a union, local or customer) | Nzila commercial | May map to one or more Organizations (today: one `billing_account` per organization; a many-to-one mapping is a future change) | Optional `customer` reference                          | Identity is Nzila-owned; a Stripe customer never defines tenant membership       |
| CommercialAgreement / Subscription | Commercial terms and state                                | Nzila commercial | Applies to the Organizations of a ClientAccount                                                                                | Mirrors a Stripe subscription when one exists          | Only a verified event or an authorized Nzila action changes state                |
| ProductPlan                        | Purchasable offering                                      | Nzila product    | None                                                                                                                           | Optional `price`/`product` reference                   | Plans do not grant access by themselves                                          |
| CommercialEntitlement              | The product-access decision                               | Nzila/UE policy  | Scopes capabilities per Organization (`org_entitlements`)                                                                      | None                                                   | Derived by policy from commercial state; never set by a webhook handler directly |
| CommercialInvoice                  | Amount owed                                               | Nzila commercial | Billed to a ClientAccount, attributed to Organizations                                                                         | Optional hosted invoice                                | Totals are server-computed                                                       |
| CommercialPayment                  | Money received                                            | Nzila finance    | Allocated to invoices                                                                                                          | Settlement evidence is a verified PaymentIntent/charge | Exactly-once, amount, currency and binding validated                             |
| CommercialRefund                   | Money returned                                            | Nzila finance    | Linked to a payment                                                                                                            | Verified refund event                                  | Cannot exceed the settled amount                                                 |
| PaymentProviderReference           | External identifiers                                      | Nzila finance    | None                                                                                                                           | The Stripe object ids                                  | Unique per provider object; never used for authorization                         |
| CommercialEvent                    | Ingested provider or internal event                       | Nzila platform   | None                                                                                                                           | Stripe event id                                        | Idempotent by event id                                                           |
| CommercialAudit                    | Provenance of every commercial mutation                   | Nzila platform   | Chained per Organization (canonical audit)                                                                                     | None                                                   | Same-transaction audit; failure rolls back                                       |

## 6. Initial launch requirement for Stripe

**Not required.** No initial-launch journey in the new stack depends on Stripe: the member-facing
dues payment surface is disabled, `cron/billing-lifecycle` is held at 501, and the existing
platform-invoice and ICRA purchase paths are served by the existing production stack, which keeps
running alongside the new one. Configuring live Stripe is therefore a gate only if a client-commercial
payment is selected for the initial rollout (see R-13 in the production package).

## 7. Out of scope here

Subscription management UI, a full invoicing product, a CRM, revenue recognition, a tax engine,
collections, a new accounting subsystem. These are a separately scoped post-launch lane.
