# NACP Exams

> DRC-native national education and examination infrastructure. Modeled on the
> Congolese schooling hierarchy: **national → province → subdivision → pool →
> examination centre → school → candidate**. Examination integrity, anomaly
> detection, and anti-corruption controls are capabilities within this
> education-system product, not its market category.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Radix primitives + Framer Motion
- **Port:** 3005

## Quick Start

```bash
cd apps/nacp-exams && pnpm dev
```

No `.env.example` — see `@nzila/os-core` env schema for required variables.

## Key Packages

- `@nzila/nacp-core` — NACP domain logic
- `@nzila/ai-sdk` / `@nzila/ml-sdk` — AI-assisted exam features
- `@nzila/commerce-audit` / `@nzila/commerce-state` — audit trail & state management
- `@nzila/blob` — file/document storage

## Domain

DRC national education and examination administration — provincial and
subdivision administration (Kinshasa, Kongo Central, Kwilu, Nord-Kivu,
Sud-Kivu and beyond), pool and examination-centre operations, school and
candidate registries, examiner and marking workflows, attendance, results,
appeals, certificates, OMR and handwriting processing, and public candidate
services. Examination-integrity, anomaly detection, and anti-corruption
controls are features of the education system, not the vertical. AI/ML
assists question generation, marking, and analytics.

## Environment Variables

See `.env.example` in this directory for required variables (`AUTH_SECRET`, `DATABASE_URL`, Entra SSO config).
