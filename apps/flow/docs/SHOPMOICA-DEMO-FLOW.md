# Shop Moi Ça — Demo Walkthrough

## Overview

End-to-end demo scenario for the **Shop Moi Ça** use case in Flow. This
walkthrough covers the full customer journey from browsing to fulfillment,
suitable for stakeholder demos and QA validation.

## Prerequisites

- Flow application running locally (`pnpm dev:flow`) or accessible on staging.
- Staging database seeded with demo data (see [STAGING_SEED_GUIDE.md](STAGING_SEED_GUIDE.md)).
- Demo user account: `demo@shopmoica.test` (or create one via the UI).
- Products catalog populated with at least 3 sample items.

## Demo Steps

### 1. Create Customer

1. Navigate to **Customers → New Customer**.
2. Enter customer details:
   - Name: `Marie Dupont`
   - Email: `marie@example.com`
   - Company: `Boutique Marie`
3. Save. Verify the customer appears in the customer list.

### 2. Browse Products

1. Navigate to **Products**.
2. Show the catalog with categories, pricing, and availability.
3. Highlight search and filtering capabilities.

### 3. Request Quote

1. Click **New Quote** from the customer detail page.
2. Add 2–3 line items from the product catalog.
3. Adjust quantities and review the total.
4. Send the quote — status changes from `draft` to `sent`.
5. Show the email notification (or log entry).

### 4. Approve Quote → Order

1. Simulate customer accepting the quote (via customer portal or admin action).
2. Quote status moves to `accepted`.
3. An Order is auto-created in `created` state.
4. Confirm the order (simulate payment) — status moves to `confirmed`.

### 5. Track Production

1. Navigate to the order detail page.
2. Show production jobs created automatically.
3. Advance a job: `queued → in_progress → completed`.
4. When all jobs complete, the order moves to `fulfilled`.

### 6. Fulfillment

1. Mark the order as shipped / delivered.
2. Order status moves to `delivered`.
3. Show the delivery confirmation and audit trail.

## Reset Instructions

To reset the demo environment for a fresh run:

```sql
-- Remove demo data (run against staging DB)
DELETE FROM production_jobs WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email = 'marie@example.com'));
DELETE FROM order_line_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email = 'marie@example.com'));
DELETE FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE email = 'marie@example.com');
DELETE FROM quote_line_items WHERE quote_id IN (SELECT id FROM quotes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'marie@example.com'));
DELETE FROM quotes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'marie@example.com');
DELETE FROM customers WHERE email = 'marie@example.com';
```

Or re-run the seed script: `pnpm flow:seed-demo`

## Notes

- The demo takes approximately 10–15 minutes for a full walkthrough.
- Pause between steps to explain domain concepts to the audience.
- The quote expiry timer is set to 7 days by default; for demo purposes it won't trigger during the session.
