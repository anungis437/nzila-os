# GLOSSARY.md — Nzila Commerce Engine

> Canonical term definitions for the Commerce domain.
> All code, docs, and APIs **must** use these terms consistently.

---

## Core Terms

### org

The root organisational aggregate in NzilaOS. Every business entity, user, and
data record belongs to exactly one org. In the database, the scoping column is
`org_id` (the Nzila convention for org identity). Never use "tenant."

### membership

A user's relationship to an org. Defines role (`owner`, `admin`, `manager`,
`member`, `viewer`) and granular permissions. A user may belong to multiple orgs
but operates within one org context at a time.

### quote_version

An immutable snapshot of a priced quote. Quotes are versioned — each revision
creates a new `quote_version` with its own line items, pricing, tax breakdown,
and approval flags. The latest version is the active one; prior versions are
retained for audit.

### order_lock

The moment a quote is accepted and an Order is created from the locked
`quote_version` snapshot. The Order locks pricing, tax, and line items so they
cannot change retroactively. The locked snapshot is the source of truth for
invoicing, fulfilment, and disputes.

### evidence_pack

A sealed collection of evidence artefacts (PDFs, sync receipts, approval records)
produced at lifecycle milestones. Each artefact is SHA-256 hashed; the pack is
Merkle-root sealed for tamper detection. Evidence packs are org-scoped and
immutable once sealed.

### sync_receipt

An evidence artefact recording the outcome of an external integration sync job
(e.g., Zoho CRM customer sync, Zoho Books invoice push). Contains:

- Provider name, job ID, timestamp
- Records synced / failed counts
- Redacted request/response snapshot
- Status (success / partial / failed)

Stored as an `evidence_artifact` with type `sync_receipt`.

---

## Lifecycle Terms

### opportunity

A pre-quote lead or sales prospect. May convert to a Quote or be marked `lost`.

### quote

A formal pricing proposal sent to a customer, comprising one or more line items,
a pricing tier (budget/standard/premium), tax breakdown, and validity period.

### approval

A gate requiring explicit manager/admin authorisation before a quote can become
an order. Triggered when margin is below floor or discount exceeds threshold.

### order

The confirmed commercial agreement created from an accepted quote_version.
The Order is the fulcrum entity — it connects quoting, fulfilment, and invoicing.

### fulfilment

The process of delivering goods/services against an Order. Includes inventory
reservation, production tasks, quality checks, packaging, and shipping.

### delivery

Confirmation that goods have reached the customer. May trigger milestone-based
invoicing or final invoice issuance.

### invoice

A financial document requesting payment from the customer, created from an Order.
Supports partial payments, overdue tracking, disputes, refunds, and credit notes.

### credit_note

An accounting adjustment reducing the amount owed on an invoice. Created via
the refund or dispute resolution flow.

---

## Technical Terms

### outbox_event

A domain event written to the `outbox_events` table within the same database
transaction as the state change. A background worker polls the outbox and
dispatches events to saga handlers, ensuring at-least-once delivery.

### saga

A multi-step orchestration flow that coordinates cross-entity state changes.
Each step writes audit events and produces evidence. If a step fails,
compensation actions revert prior steps to prevent orphaned states.

### compensation

A rollback action triggered when a saga step fails. For example, if invoice
creation fails after order creation, the compensation marks the order as
`needs_attention` and emits an audit event.

### idempotency_key

A client-supplied or system-generated key ensuring that replayed requests
(e.g., retried saga steps) do not create duplicate entities. Stored alongside
the entity and checked before creation.

---

*Part of [Nzila Commerce Engine](../README.md)*
