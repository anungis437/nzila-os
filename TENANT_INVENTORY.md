# Tenant Inventory

Canonical tenant and organization inventory for Nzila OS governance.

## Authority

- Primary source: organization records in the platform database.
- Derived reporting sources: control-plane governance exports.
- Document owner: platform-core.

## Current operating mode

This document is the canonical policy anchor for tenant inventory.
Runtime inventory values are generated from governed data exports and attached to release evidence packs.

## Required fields for each tenant record

- organization_id
- legal_name
- operating_name
- jurisdiction
- data_residency_region
- primary_contact_role
- status (active, suspended, archived)
- created_at
- updated_at

## Controls

- Tenant inventory changes require audit trail entries.
- Cross-org access to inventory details is prohibited.
- Exported inventory snapshots must be evidence-sealed for compliance reviews.

## References

- docs/platform/STATUS_AUTHORITY_MODEL.md
- docs/platform/portfolio-matrix.md
- docs/platform/runtime-classification.md
