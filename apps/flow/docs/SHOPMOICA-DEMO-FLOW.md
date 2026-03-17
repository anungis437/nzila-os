# ShopMoiCa Demo Flow Guide

> Run-book for demonstrating the end-to-end ShopMoiCa.ca quote lifecycle.

## Prerequisites

- Shop Quoter running at `http://localhost:3007`
- Demo seed loaded (`seedDemo()` from `lib/demoSeed.ts`)
- Clerk auth configured with demo users

## Demo Quotes

| Ref | Customer | Status | Story |
|-----|----------|--------|-------|
| SQ-2026-001 | Tremblay & Fils | DRAFT | Fresh quote — show creation & editing |
| SQ-2026-002 | Bergeron Industriel | REVISION_REQUESTED | Revision flow — client asked for changes |
| SQ-2026-003 | Lavoie Imports | DEPOSIT_REQUIRED | Deposit gate — awaiting $5,850 (30%) |
| SQ-2026-004 | Gagnon Construction | READY_FOR_PO | Cleared for PO — deposit paid |
| SQ-2026-005 | Roy Distribution | IN_PRODUCTION | Active production — PO created |
| SQ-2026-006 | Tremblay & Fils | SHIPPED | In transit — follow-up order |
| SQ-2026-007 | Bergeron Industriel | CLOSED | Historical — full lifecycle complete |

## Walkthrough Script

### 1. Dashboard Overview (2 min)

- Navigate to `/quotes`
- Show status badges across all lifecycle stages
- Point out the analytics sidebar (47 quotes, 68% conversion)

### 2. Create a Quote (3 min)

- Open SQ-2026-001 (DRAFT)
- Show line items with Quebec tax calculation (GST 5% + QST 9.975%)
- **Submit for Review** → status changes to INTERNAL_REVIEW
- **Send to Client** → generates secure approval link

### 3. Client Portal (3 min)

- Open the approval link in an incognito window
- Show the branded quote view (no auth required)
- Demo **Accept** flow → quote moves to ACCEPTED
- Alternative: demo **Request Revision** with a message

### 4. Revision Flow (2 min)

- Show SQ-2026-002 (REVISION_REQUESTED)
- Point out the revision message in the sidebar
- Show "Address Revision" → takes quote back to DRAFT
- Edit and re-send

### 5. Payment / Deposit Gate (3 min)

- Show SQ-2026-003 (DEPOSIT_REQUIRED)
- Point out the deposit section: $5,850 / $19,500 (30%)
- Demo "Record Payment" → status advances to READY_FOR_PO
- Show PO readiness check (all green)

### 6. PO → Production → Shipping (3 min)

- Show SQ-2026-004 (READY_FOR_PO) → Create PO
- Show SQ-2026-005 (IN_PRODUCTION) → Mark Shipped
- Show SQ-2026-006 (SHIPPED) → Mark Delivered

### 7. Closed Lifecycle (1 min)

- Show SQ-2026-007 (CLOSED) with full timeline
- Walk through every event from creation to close-out

### 8. Audit & Evidence (2 min)

- Visit `/api/evidence/export`
- Show structured audit events for the demo quotes
- Explain the evidence pack for each transition

## Key Talking Points

- **Secure by default**: Share links are SHA-256 hashed, time-limited, single-use
- **Policy-enforced**: Deposit requirements block PO generation
- **Auditable**: Every transition is recorded with actor, timestamp, metadata
- **Quebec-ready**: GST/QST tax calculation built in
- **Zoho-integrated**: Quotes sync to CRM/Books/Inventory (configurable)
