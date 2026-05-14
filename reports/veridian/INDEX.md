---
platform: veridian-care
type: index
generated: 2026-04-27
status: pilot-ready
---

# Veridian Care — Report Index

This directory contains procurement and trust artifacts for the Veridian Care platform.

## Commercial Pack

| Document | Purpose |
|---|---|
| [pilot-pack.md](./pilot-pack.md) | 90-day pilot overview and onboarding path |
| [security-one-pager.md](./security-one-pager.md) | Security posture summary for procurement |
| [privacy-consent-architecture.md](./privacy-consent-architecture.md) | Consent engine and privacy architecture |
| [interoperability-architecture.md](./interoperability-architecture.md) | Connector and integration architecture |
| [operational-controls-matrix.md](./operational-controls-matrix.md) | Controls with evidence sources and cadences |
| [roi-framework.md](./roi-framework.md) | ROI model and value quantification |

## Release Records

Staging releases: `staging-release-YYYY-MM-DD.md`
Production releases: `production-release-YYYY-MM-DD.md`

## Release Frontmatter Schema

All release notes must include:

```yaml
platform: veridian-care
type: staging-release | production-release
date: YYYY-MM-DD
environment: staging | production
app: veridian-care | veridian-admin | veridian-site
status: draft | approved | superseded
approvedBy: (role, not name)
```

## Legal

All documents use designed-for, aligned-with, supports, pilot-ready, and integration-ready language.
No fake certifications, no fake compliance badges, no real patient records.
