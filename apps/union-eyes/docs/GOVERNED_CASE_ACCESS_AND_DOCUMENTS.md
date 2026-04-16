# Governed Case Access and Document Repository

## Scope

This document defines the Union Eyes implementation for:

1. Secondary LRO case access with primary ownership retained.
2. Governed document repository with mandatory privacy labels.
3. Universal search with auth-first filtering.
4. Auditable access and label actions.

No parallel subsystem is introduced. All behavior is implemented through active grievance and document paths.

## Secondary Case Access

### Model

- Table: `grievance_case_access_assignments`
- Roles:
  - `secondary_lro`
  - `reviewer`
  - `read_only`
- Status:
  - `active`
  - `revoked`
  - `expired`

### Rules

- Primary ownership remains with `grievances.unionRepId`.
- Only primary owner or `steward+` can grant/revoke collaborator access.
- Collaborators never inherit owner-only actions.
- Expired access is auto-marked by lifecycle checks.

### API

- `GET /api/grievances/[id]/access`
- `POST /api/grievances/[id]/access`
- `PATCH /api/grievances/[id]/access`

### Audits

Events recorded through case audit wrapper:

- `case.access_granted`
- `case.access_updated`
- `case.access_revoked`
- `case.access_expired`

## Governed Repository

### Model

- Document-level governance fields in `documents`:
  - `privacy_label` (required)
  - PII/sensitive flags
  - status and metadata
- New tables:
  - `document_versions`
  - `document_links`
  - `document_access_grants`
  - `document_search_index`

### Privacy Labels

- `public_internal`
- `team_confidential`
- `lro_confidential`
- `privileged`
- `case_restricted`
- `highly_sensitive`

### Policy Gate

`isDocumentVisibleByPolicy(...)` is used by:

- grievance detail document retrieval
- governed repository list/detail
- universal search documents group

Key behavior:

- Non-members: denied.
- Collaborators: default labels only unless additional scopes.
- `lro_confidential`: requires `canViewPrivateDocuments`.
- `privileged`/`highly_sensitive`: requires explicit grant (or owner/steward policy path).

### APIs

- `GET/POST /api/documents/repository`
- `GET/PATCH /api/documents/repository/[id]`
- `POST /api/documents/repository/[id]/versions`

### Mandatory Label on Upload

Both grievance upload and repository upload now require `privacyLabel`.

## Universal Search

### API

- `GET /api/search/universal?q=...`

### Groups Returned

- cases
- documents
- members
- agreements
- tasksAndNotes

### Security

- Case visibility is filtered by effective case access.
- Document visibility is filtered by label policy + explicit grants.
- Results are not returned before authorization checks.

## UI Surfaces

- Grievance detail console:
  - Primary LRO visibility
  - Collaborator assignment/revoke controls
  - Governed document list with label chips
  - Label-required upload form
- Dashboard header:
  - universal search bar with grouped preview
- Dashboard documents page:
  - governed repository tab
  - label filters
  - upload form with mandatory label
  - version append action

## Audit Semantics

- Access lifecycle actions are case-audited.
- Case attachment upload is case-audited.
- Label changes are case-audited when document links to grievance.
