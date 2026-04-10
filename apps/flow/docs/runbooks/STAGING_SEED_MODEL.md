# Flow — Staging Seed Model

> Canonical reference for the demo/staging data model used in the Flow application.
> All seed data follows the multi-org architecture with org-scoped isolation.

## Organizations

| Org                | ID (seed)            | Purpose                                   |
| ------------------ | -------------------- | ----------------------------------------- |
| **ShopMoiCa**      | `org-shopmoica`      | Full-service promotional products company |
| **PromoNorth**     | `org-promonorth`     | Competitor org for multi-org demos        |

## Customers

| Name             | Org         | Email                          | Company           |
| ---------------- | ----------- | ------------------------------ | ----------------- |
| Alice Johnson    | ShopMoiCa   | alice@bigcorp.com              | BigCorp Inc       |
| Bob Tremblay     | ShopMoiCa   | bob@techstartup.io             | TechStartup       |
| Carol Williams   | ShopMoiCa   | carol@eventplanners.ca         | EventPlanners Co  |
| David Chen       | ShopMoiCa   | david@retailchain.com          | RetailChain       |
| Eva Martinez     | ShopMoiCa   | eva@nonprofitorg.org           | NonProfit Org     |

## Products

| Name                     | SKU            | Base Price | Category        |
| ------------------------ | -------------- | ---------- | --------------- |
| Custom Baseball Cap      | CAP-001        | $12.50     | Headwear        |
| Embroidered Polo Shirt   | POLO-001       | $28.00     | Apparel         |
| Branded Tote Bag         | TOTE-001       | $8.50      | Bags            |
| Custom USB Drive 16GB    | USB-016        | $6.00      | Tech            |
| Printed Water Bottle     | BOTTLE-001     | $15.00     | Drinkware       |

## Vendors (Suppliers)

| Name             | Contact          | Lead Time | Specialty               |
| ---------------- | ---------------- | --------- | ----------------------- |
| CapMaster Inc    | caps@capmaster   | 10 days   | Headwear, embroidery    |
| PrintPro Co      | info@printpro    | 7 days    | Screen printing, DTG    |
| TechGadgets Ltd  | sales@techgadget | 14 days   | USB, tech accessories   |

## Vendor-Product Links

| Vendor         | Product              | Vendor SKU   | Vendor Cost | Rank |
| -------------- | -------------------- | ------------ | ----------- | ---- |
| CapMaster Inc  | Custom Baseball Cap  | CM-CAP-STD   | $5.50       | 1    |
| PrintPro Co    | Embroidered Polo     | PP-POLO-EMB  | $14.00      | 1    |
| PrintPro Co    | Branded Tote Bag     | PP-TOTE-STD  | $3.50       | 1    |
| TechGadgets    | Custom USB Drive     | TG-USB-16    | $2.80       | 1    |
| PrintPro Co    | Printed Water Bottle | PP-BTL-PRNT  | $7.00       | 1    |

## Quote Scenarios

| Ref          | Customer       | Status    | Lines | Total    | Scenario                           |
| ------------ | -------------- | --------- | ----- | -------- | ---------------------------------- |
| QT-DEMO-001  | Alice Johnson  | accepted  | 3     | $5,750   | Large corporate order, 50% deposit |
| QT-DEMO-002  | Bob Tremblay   | sent      | 2     | $1,200   | Pending client review              |
| QT-DEMO-003  | Carol Williams | draft     | 1     | $425     | Event giveaway quote in progress   |
| QT-DEMO-004  | Alice Johnson  | rejected  | 2     | $3,800   | Revised → rejected, re-quoted      |
| QT-DEMO-005  | David Chen     | accepted  | 4     | $12,500  | Multi-product retail order         |
| QT-DEMO-006  | Eva Martinez   | sent      | 1     | $800     | Non-profit small batch             |
| QT-DEMO-007  | Carol Williams | revision  | 2     | $2,100   | Client requested changes           |

## Order Lifecycle Demos

| Ref          | Customer       | Status         | Payment Status   | Production Status | Scenario                      |
| ------------ | -------------- | -------------- | ---------------- | ----------------- | ----------------------------- |
| ORD-DEMO-001 | Alice Johnson  | in_production  | partially_paid   | in_production     | Deposit paid, caps in print   |
| ORD-DEMO-002 | David Chen     | confirmed      | pending_deposit  | —                 | Awaiting 30% deposit          |
| ORD-DEMO-003 | Alice Johnson  | shipped        | paid             | completed         | Full shipment en route        |

## Purchase Order Scenarios

| Ref          | Vendor        | Order        | Status    | Scenario                   |
| ------------ | ------------- | ------------ | --------- | -------------------------- |
| PO-DEMO-001  | CapMaster Inc | ORD-DEMO-001 | confirmed | Caps in production         |
| PO-DEMO-002  | PrintPro Co   | ORD-DEMO-001 | sent      | Polo shirts pending vendor |
| PO-DEMO-003  | TechGadgets   | ORD-DEMO-002 | draft     | Blocked by deposit gate    |

## Production Jobs

| Order        | Vendor        | Status         | Proof Required | Scenario                  |
| ------------ | ------------- | -------------- | -------------- | ------------------------- |
| ORD-DEMO-001 | CapMaster Inc | in_production  | Yes (approved) | Caps being manufactured   |
| ORD-DEMO-001 | PrintPro Co   | pending_proof  | Yes            | Polo proof not yet sent   |
| ORD-DEMO-003 | CapMaster Inc | completed      | Yes (approved) | Already shipped           |

## Shipments

| Order        | Status    | Carrier  | Tracking       | Scenario            |
| ------------ | --------- | -------- | -------------- | ------------------- |
| ORD-DEMO-003 | shipped   | Purolator| PUR-12345-CA   | En route to client  |

## Payment Records

| Order        | Status          | Amount Due | Amount Paid | Deposit % | Scenario               |
| ------------ | --------------- | ---------- | ----------- | --------- | ---------------------- |
| ORD-DEMO-001 | partially_paid  | $5,750     | $2,875      | 50%       | Deposit received       |
| ORD-DEMO-002 | pending_deposit | $12,500    | $0          | 30%       | Awaiting deposit       |
| ORD-DEMO-003 | paid            | $5,750     | $5,750      | 50%       | Fully paid             |

## Domain Events (sample)

| Entity Type | Entity ID    | Event Type         | Actor        |
| ----------- | ------------ | ------------------ | ------------ |
| quote       | QT-DEMO-001  | quote_accepted     | alice@bigcorp|
| order       | ORD-DEMO-001 | order_created      | system       |
| order       | ORD-DEMO-001 | deposit_required   | system       |
| order       | ORD-DEMO-001 | payment_received   | system       |
| order       | ORD-DEMO-001 | po_created         | admin        |
| order       | ORD-DEMO-001 | production_started | admin        |
| order       | ORD-DEMO-003 | shipment_created   | admin        |

## Notes

- All seed data uses deterministic UUIDs derived from the ref fields above.
- Seed data is idempotent — running the seed script multiple times produces the same state.
- The `demoSeed.ts` file in `apps/flow/lib/` contains the runtime seed implementation.
- Multi-org isolation is enforced: ShopMoiCa data never leaks to PromoNorth queries.
