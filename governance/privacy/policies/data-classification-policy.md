# Data Classification Policy

**Doc ID:** DCP-2026-001
**Version:** 1.0
**Owner:** Privacy Lead / CISO
**Status:** ACTIVE
**Next review:** 2027-04-28

## 1. Purpose

Establish a uniform scheme for classifying all data that Nzila Ventures
creates, collects, processes, or stores, so that protection controls are
proportionate to sensitivity.

## 2. Scope

All data in Nzila OS systems regardless of format (database, file, log,
backup, in-transit message) and location (Azure Canada Central primary;
Azure East US/East US 2 for AI inference).

## 3. Classification scheme

| Tier | Label | Description | Examples |
|------|-------|-------------|----------|
| 4 | **Restricted** | PHI, payment data, secrets; unauthorized disclosure causes severe harm | Member health complaints (union-eyes), PHI; payment card data; Argon2id password hashes; Azure key material |
| 3 | **Confidential** | PII or business-confidential; unauthorized disclosure causes material harm | Member identifiers, contact info, employer info; financial records (cfo); commercial deal terms |
| 2 | **Internal** | Non-public, low-harm if disclosed | Internal docs, runbooks, non-PII telemetry, code |
| 1 | **Public** | Approved for unrestricted release | Marketing site copy, published policies, open-source code |

Default classification when unset: **Internal (2)**. PII is at minimum
**Confidential (3)**; PHI / payment data is **Restricted (4)**.

## 4. Roles & responsibilities

- **Surface Owner** — assigns classification to each data store under their app.
- **Privacy Lead** — arbitrates disputes; maintains the standard.
- **Platform Lead** — enforces protection controls per the standard.

## 5. Required actions

1. Every Postgres table, Blob container, queue, and log stream MUST have a
   classification recorded in `governance/privacy/data-inventory.json`
   (to be created) with `app`, `surface`, `tier`, `pii`, `phi`, `region`.
2. New stores MUST be classified before first production write.
3. Classification MUST be re-reviewed annually or on schema change touching
   personal data.

## 6. Noncompliance

Per [`../../security/APPLICATION_SECURITY_POLICY.md`](../../security/APPLICATION_SECURITY_POLICY.md) §8.

## 7. Related

- [Data Classification Standard](data-classification-standard.md) — control mapping per tier
- [Data Retention Policy](data-retention-policy.md)
