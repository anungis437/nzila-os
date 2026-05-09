# Django Canonical Authority Formalization

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document formalizes Django as the canonical operational schema
authority for Union Eyes (and, by extension, the Nzila ecosystem
where Django backends are present).

---

## 1. Statement

Django is the only canonical owner of institutional operational entities.

This statement is constitutive: any other ORM, tool, or process that
attempts to own an institutional operational entity is operating
outside canonical authority and must be reconciled.

---

## 2. Business Entity Authority

The following are Django-owned by definition. New entries are added
via PR.

- Identity & access: users, sessions, MFA, password reset tokens
- Organizations & memberships: organizations, organization_members,
  organization_users
- Unions: unions, locals, certifications
- Members: profiles, employment, segments
- Grievances: grievances, grievance approvals, grievance documents
- Bargaining: negotiations, proposals, mandates
- Claims: claims, claim deadlines, claim documents
- Compliance: audit logs, compliance reports, defensibility packs
- Billing & dues: dues transactions, autopay settings, invoices
- Communication: messaging, notifications, calendar
- Documents & evidence: documents, reports, attestations (canonical)
- Knowledge: knowledge_base, knowledge_base_articles
- Governance (canonical): governance entities, congress memberships,
  committee workspaces

The Django app boundaries (`apps/union-eyes/backend/<app>/models.py`)
are the operational truth.

---

## 3. Canonical Entity Governance Rules

- A canonical entity has exactly one Django app that owns it.
- The owning app's `models.py` is the source of truth.
- Schema changes are authored as Django migrations
  (`manage.py makemigrations <app>`) and reviewed in the same PR as
  the model change.
- Cross-app FKs are permitted; cross-ORM FKs from canonical to
  non-canonical are prohibited (see canonical topology §3).

---

## 4. Migration Authority

- Django migrations live under
  `apps/union-eyes/backend/<app>/migrations/`.
- Django migration ordering is canonical and authoritative.
- No other tool may create files in those directories.
- No other tool may produce `ALTER` statements affecting Django-owned
  tables.

---

## 5. Runtime Ownership

- Canonical entities are read and written by Django services and by
  Next.js routes that connect through governed query layers.
- Drizzle reads of canonical entities are permitted only as projections
  (read-side cache hydration). Drizzle writes to canonical entities
  are prohibited.

---

## 6. Operational Legitimacy Implications

- An environment is operationally legitimate when its Django migrations
  are applied to head and the corresponding migration log is intact.
- Bootstrap from a canonical snapshot (see
  [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md))
  is the only legitimate way to materialize the canonical zone outside
  of native Django migrate.

---

## 7. Attestation Implications

- The bootstrap attestation row written by `db:bootstrap` records the
  snapshot digest used (if any). For environments that bootstrapped
  via snapshot, that digest is the operator-verifiable identity of the
  canonical zone at materialization time.
- A future Django attestation hook (out of scope for this phase) should
  capture the post-`migrate` head migration tag per app and write it
  alongside the bootstrap attestation.

---

## 8. Release Governance Implications

- A release that mutates a canonical entity is a Django-migration
  release.
- A release that only adds a Drizzle cache projection is a scoped
  Drizzle release.
- A release that does both is a two-PR governance event (see
  [orm-authority-governance.md §3](./orm-authority-governance.md)).
